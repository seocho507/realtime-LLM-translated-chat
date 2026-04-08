import pytest

from app.cache.translation_cache import MemoryTranslationCache
from app.config import Settings
from app.observability.metrics import MetricsRegistry
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import StreamFinal, TranslationRequest
from app.translation.router import TranslationRouter
from app.translation.service import TranslationService


@pytest.mark.asyncio
async def test_translation_service_serves_cached_result_on_second_request():
    cache = MemoryTranslationCache()
    metrics = MetricsRegistry()
    service = TranslationService(
        settings=Settings(),
        router=TranslationRouter([MockTranslationAdapter()], default_provider="mock"),
        cache=cache,
        metrics=metrics,
    )
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="안녕하세요",
    )

    first_events = [event async for event in service.translate(request)]
    second_events = [event async for event in service.translate(request)]

    assert isinstance(first_events[-1], StreamFinal)
    assert isinstance(second_events[-1], StreamFinal)
    assert second_events[-1].cached is True
    assert metrics.counters["cache_hit_rate"] == 1
