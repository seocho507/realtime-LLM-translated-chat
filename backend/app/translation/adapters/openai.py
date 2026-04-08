from __future__ import annotations

from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import ModelCapabilities


class OpenAITranslationAdapter(MockTranslationAdapter):
    provider = "openai"
    model = "gpt-4.1-mini"
    capabilities = ModelCapabilities(
        streaming=True,
        glossary=False,
        json_mode=True,
        prompt_caching=False,
        max_context_tokens=128_000,
    )
