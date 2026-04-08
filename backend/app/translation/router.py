from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.translation.ports import ModelCapabilities, TranslationLLM, TranslationRequest


@dataclass(slots=True)
class ProviderHealth:
    available: bool = True
    reason: str | None = None


class TranslationRouter:
    def __init__(self, adapters: Iterable[TranslationLLM], default_provider: str) -> None:
        self._adapters = {adapter.provider: adapter for adapter in adapters}
        self._health = {provider: ProviderHealth() for provider in self._adapters}
        self._default_provider = default_provider

    def set_health(self, provider: str, available: bool, reason: str | None = None) -> None:
        if provider in self._health:
            self._health[provider] = ProviderHealth(available=available, reason=reason)

    def pick(self, request: TranslationRequest) -> TranslationLLM:
        candidates: list[TranslationLLM] = []
        for provider, adapter in self._adapters.items():
            health = self._health.get(provider, ProviderHealth())
            if not health.available:
                continue
            if self._supports_request(adapter.capabilities, request):
                candidates.append(adapter)

        if not candidates:
            return self._adapters[self._default_provider]

        candidates.sort(key=lambda adapter: (adapter.provider != self._default_provider, adapter.provider))
        return candidates[0]

    @staticmethod
    def _supports_request(capabilities: ModelCapabilities, request: TranslationRequest) -> bool:
        if request.glossary and not capabilities.glossary:
            return False
        return True
