from __future__ import annotations

import asyncio
import time

from app.translation.ports import (
    LLMStreamEvent,
    ModelCapabilities,
    StreamDelta,
    StreamFinal,
    StreamStart,
    TranslationLLM,
    TranslationRequest,
)


class MockTranslationAdapter(TranslationLLM):
    provider = "mock"
    model = "mock-sonnet"
    capabilities = ModelCapabilities(
        streaming=True,
        glossary=True,
        json_mode=False,
        prompt_caching=False,
        max_context_tokens=8_000,
    )

    async def translate_stream(self, req: TranslationRequest):
        started = time.perf_counter()
        yield StreamStart(provider=self.provider, model=self.model)
        await asyncio.sleep(0)
        translated = f"[{req.target_lang}] {req.text}"
        halfway = max(1, len(translated) // 2)
        yield StreamDelta(text=translated[:halfway])
        await asyncio.sleep(0)
        yield StreamDelta(text=translated[halfway:])
        total_ms = int((time.perf_counter() - started) * 1000)
        yield StreamFinal(
            text=translated,
            finish_reason="stop",
            latency_first_token_ms=1,
            latency_total_ms=total_ms,
        )
