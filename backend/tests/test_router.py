from app.translation.adapters.groq import GroqTranslationAdapter
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import TranslationRequest
from app.translation.router import TranslationRouter


def test_router_falls_back_to_mock_when_groq_is_unhealthy():
    router = TranslationRouter(
        [GroqTranslationAdapter(api_key="test-key"), MockTranslationAdapter()],
        default_provider="groq",
    )
    router.set_health("groq", available=False, reason="rate-limited")
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="hello",
    )

    adapter = router.pick(request)
    assert adapter.provider == "mock"
