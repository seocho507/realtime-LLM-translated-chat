from __future__ import annotations

import pytest

from app.cache.translation_cache import MemoryTranslationCache
from app.config import Settings
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
