from fastapi.testclient import TestClient
import pytest

from app.auth.google_oauth import GoogleIdentity
from app.auth.session_service import SessionPrincipal
from app.cache.translation_cache import MemoryTranslationCache
from app.config import Settings
from app.main import create_app
from app.observability.metrics import MetricsRegistry
from app.orchestration.message_orchestrator import ChatInboundMessage, MessageOrchestrator
from app.translation.adapters.anthropic import AnthropicTranslationAdapter
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.router import TranslationRouter
from app.translation.service import TranslationService


class FakeGoogleOAuthClient:
    async def verify_token(self, credential: str) -> GoogleIdentity:
        if credential != "good-token":
            raise ValueError("bad token")
        return GoogleIdentity(sub="sub-123", email="user@example.com")


class FakeConnectionManager:
    def __init__(self) -> None:
        self.payloads: list[dict] = []

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        payload = {**payload, "conversation_id": conversation_id}
        self.payloads.append(payload)


class FakeMessageRepository:
    def __init__(self) -> None:
        self.envelopes: list[dict] = []
        self.translations: list[dict] = []

    async def save_envelope(self, **kwargs) -> int:
        self.envelopes.append(kwargs)
        return 1

    async def save_translation(self, message_id: int, record) -> None:
        self.translations.append({"message_id": message_id, "record": record})


def build_client() -> TestClient:
    app = create_app()
    app.state.google_oauth_client = FakeGoogleOAuthClient()
    return TestClient(app)


def test_google_login_issues_session_cookie():
    with build_client() as client:
        response = client.post("/api/auth/google", json={"credential": "good-token"})
        assert response.status_code == 200
        body = response.json()
        assert body["user"]["google_sub"] == "sub-123"
        assert response.cookies.get("talk_session")


@pytest.mark.asyncio
async def test_orchestrator_broadcasts_streaming_events_and_records_metrics():
    connection_manager = FakeConnectionManager()
    repository = FakeMessageRepository()
    metrics = MetricsRegistry()
    translation_service = TranslationService(
        settings=Settings(),
        router=TranslationRouter(
            [AnthropicTranslationAdapter(), MockTranslationAdapter()],
            default_provider="anthropic",
        ),
        cache=MemoryTranslationCache(),
        metrics=metrics,
    )
    orchestrator = MessageOrchestrator(connection_manager, translation_service, repository, metrics)
    principal = SessionPrincipal(
        session_id="s1",
        user_id="u1",
        google_sub="sub-123",
        email="user@example.com",
        expires_at=9999999999,
    )

    await orchestrator.handle_message(
        "room-1",
        principal,
        ChatInboundMessage(client_msg_id="m1", text="안녕하세요", source_lang="ko", target_lang="en"),
    )

    assert [payload["t"] for payload in connection_manager.payloads] == ["msg_start", "msg_delta", "msg_delta", "msg_final"]
    assert connection_manager.payloads[-1]["provider"] == "anthropic"
    assert repository.envelopes[0]["client_msg_id"] == "m1"
    assert repository.translations[0]["record"].translated_text.startswith("[en]")
    assert metrics.timings["original_delivery_ms"]
    assert metrics.timings["translation_full_ms"]
