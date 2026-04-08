from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.auth.google_oauth import GoogleIdentity
from app.cache.translation_cache import MemoryTranslationCache
from app.config import Settings
from app.main import create_app
from app.persistence.database import Database
from app.persistence.models import Base
from app.persistence.repositories.messages import MessageRepository, TranslationRecord
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import StreamFinal, StreamStart, TranslationRequest
from app.translation.router import TranslationRouter
from app.translation.service import TranslationService


@pytest.mark.asyncio
async def test_translation_service_replays_provider_metadata_on_cache_hit() -> None:
    cache = MemoryTranslationCache()
    service = TranslationService(
        settings=Settings(),
        router=TranslationRouter([MockTranslationAdapter()], default_provider="mock"),
        cache=cache,
    )
    request = TranslationRequest(
        request_id="req-cache",
        source_lang="ko",
        target_lang="en",
        text="안녕하세요",
    )

    first_pass = [event async for event in service.translate(request)]
    second_pass = [event async for event in service.translate(request)]

    assert any(isinstance(event, StreamFinal) and not event.cached for event in first_pass)
    assert isinstance(second_pass[0], StreamStart)
    assert second_pass[0].provider == "mock"
    assert isinstance(second_pass[-1], StreamFinal)
    assert second_pass[-1].cached is True


@pytest.mark.asyncio
async def test_message_repository_persists_envelope_and_translation() -> None:
    database = Database("sqlite+aiosqlite:///:memory:")
    await database.init_models(Base.metadata)
    repository = MessageRepository(database.session_factory)

    message_id = await repository.save_envelope(
        conversation_id="c1",
        sender_id="u1",
        client_msg_id="m1",
        original_text="안녕하세요",
        original_lang="ko",
        status="translating",
    )
    await repository.save_translation(
        message_id,
        TranslationRecord(
            target_lang="en",
            translated_text="Hello",
            provider="mock",
            model="mock-sonnet",
            cached=False,
        ),
    )
    stored = await repository.get_message_by_client_id("m1")

    assert stored is not None
    assert stored.id == message_id
    assert stored.status == "translated"
    await database.engine.dispose()


def test_websocket_broadcasts_original_then_translation_stream() -> None:
    class FakeGoogleOAuthClient:
        async def verify_token(self, credential: str) -> GoogleIdentity:
            if credential != "good-token":
                raise ValueError("bad token")
            return GoogleIdentity(sub="sub-123", email="user@example.com")

    app = create_app()
    app.state.google_oauth_client = FakeGoogleOAuthClient()
    client = TestClient(app)
    auth_response = client.post("/api/auth/google", json={"credential": "good-token"})
    token = auth_response.json()["token"]

    with client.websocket_connect(f"/ws/chat/room-stream?token={token}") as socket:
        socket.send_json(
            {
                "type": "send_message",
                "client_msg_id": "m-stream",
                "text": "안녕하세요",
                "source_lang": "ko",
                "target_lang": "en",
            }
        )
        payloads = [socket.receive_json() for _ in range(4)]

    assert payloads[0]["t"] == "msg_start"
    assert [payload["t"] for payload in payloads[1:]].count("msg_delta") == 2
    assert payloads[-1]["t"] == "msg_final"
