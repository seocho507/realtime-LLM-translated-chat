from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Literal, Protocol

Role = Literal["system", "user", "assistant"]
FinishReason = Literal["stop", "length", "error", "cancelled"]


@dataclass(slots=True)
class LLMMessage:
    role: Role
    content: str


@dataclass(slots=True)
class TranslationRequest:
    request_id: str
    source_lang: str
    target_lang: str
    text: str
    context: list[LLMMessage] = field(default_factory=list)
    tone: str | None = None
    glossary: dict[str, str] | None = None
    max_output_tokens: int = 1536
    temperature: float = 0.0
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class StreamStart:
    provider: str
    model: str


@dataclass(slots=True)
class StreamDelta:
    text: str


@dataclass(slots=True)
class StreamFinal:
    text: str
    finish_reason: FinishReason
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_first_token_ms: int | None = None
    latency_total_ms: int | None = None
    cached: bool = False


@dataclass(slots=True)
class StreamError:
    code: str
    message: str
    retryable: bool


LLMStreamEvent = StreamStart | StreamDelta | StreamFinal | StreamError


@dataclass(slots=True)
class ModelCapabilities:
    streaming: bool
    glossary: bool
    json_mode: bool
    prompt_caching: bool
    max_context_tokens: int | None


class TranslationLLM(Protocol):
    provider: str
    model: str
    capabilities: ModelCapabilities

    async def translate_stream(self, req: TranslationRequest) -> AsyncIterator[LLMStreamEvent]:
        ...


class TranslationCache(Protocol):
    async def get(self, key: str) -> dict[str, Any] | None:
        ...

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        ...
