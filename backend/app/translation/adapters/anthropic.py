from __future__ import annotations

from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import ModelCapabilities


class AnthropicTranslationAdapter(MockTranslationAdapter):
    provider = "anthropic"
    model = "claude-3-5-sonnet-latest"
    capabilities = ModelCapabilities(
        streaming=True,
        glossary=True,
        json_mode=False,
        prompt_caching=True,
        max_context_tokens=200_000,
    )
