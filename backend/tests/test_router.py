from app.translation.adapters.anthropic import AnthropicTranslationAdapter
from app.translation.adapters.openai import OpenAITranslationAdapter
from app.translation.ports import TranslationRequest
from app.translation.router import TranslationRouter


def test_router_falls_back_to_openai_when_anthropic_is_unhealthy():
    router = TranslationRouter(
        [AnthropicTranslationAdapter(), OpenAITranslationAdapter()],
        default_provider="anthropic",
    )
    router.set_health("anthropic", available=False, reason="rate-limited")
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="안녕하세요",
    )

    adapter = router.pick(request)
    assert adapter.provider == "openai"
