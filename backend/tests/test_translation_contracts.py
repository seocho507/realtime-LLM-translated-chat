from app.translation.ports import StreamFinal, TranslationRequest
from app.translation.service import TranslationService
from app.translation.router import TranslationRouter
from app.translation.adapters.mock import MockTranslationAdapter
from app.config import Settings


def test_cache_key_contains_required_dimensions():
    service = TranslationService(
        settings=Settings(),
        router=TranslationRouter([MockTranslationAdapter()], default_provider="mock"),
    )
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="안녕하세요",
        tone="formal",
        metadata={"prompt_version": "v2"},
    )
    key = service.build_cache_key(request, "mock", "mock-sonnet")
    assert key.startswith("tr:v2:mock:mock-sonnet:ko:en:formal:v2:")


def test_stream_final_cached_flag_defaults_false():
    event = StreamFinal(text="hello", finish_reason="stop")
    assert event.cached is False
