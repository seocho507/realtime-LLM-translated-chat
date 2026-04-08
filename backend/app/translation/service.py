from __future__ import annotations

import hashlib
from typing import AsyncIterator

from app.config import Settings
from app.observability.metrics import MetricsRegistry
from app.translation.ports import LLMStreamEvent, StreamFinal, TranslationCache, TranslationRequest, TranslationLLM
from app.translation.router import TranslationRouter


class NullTranslationCache(TranslationCache):
    async def get(self, key: str):
        return None

    async def set(self, key: str, value, ttl_seconds: int) -> None:  # noqa: ARG002
        return None


class TranslationService:
    def __init__(
        self,
        settings: Settings,
        router: TranslationRouter,
        cache: TranslationCache | None = None,
        metrics: MetricsRegistry | None = None,
    ) -> None:
        self._settings = settings
        self._router = router
        self._cache = cache or NullTranslationCache()
        self._metrics = metrics or MetricsRegistry()

    def build_cache_key(self, req: TranslationRequest, provider: str, model: str) -> str:
        text_hash = hashlib.sha256(req.text.strip().lower().encode("utf-8")).hexdigest()
        tone = req.tone or "default"
        prompt_ver = req.metadata.get("prompt_version", "v1")
        return f"tr:v2:{provider}:{model}:{req.source_lang}:{req.target_lang}:{tone}:{prompt_ver}:{text_hash}"

    async def translate(self, req: TranslationRequest) -> AsyncIterator[LLMStreamEvent]:
        adapter = self._router.pick(req)
        cache_key = self.build_cache_key(req, adapter.provider, adapter.model)
        cached = await self._cache.get(cache_key)
        if cached:
            self._metrics.increment("cache_hit_rate")
            yield StreamFinal(
                text=cached["text"],
                finish_reason="stop",
                cached=True,
                latency_first_token_ms=0,
                latency_total_ms=0,
            )
            return

        final_event: StreamFinal | None = None
        async for event in adapter.translate_stream(req):
            if isinstance(event, StreamFinal):
                final_event = event
            yield event

        if final_event:
            await self._cache.set(
                cache_key,
                {"text": final_event.text, "provider": adapter.provider, "model": adapter.model},
                self._settings.translation_cache_ttl_seconds,
            )
