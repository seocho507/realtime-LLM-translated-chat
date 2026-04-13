import json

import httpx
import pytest

from app.translation.adapters.groq import GroqTranslationAdapter
from app.translation.errors import TranslationErrorCode
from app.translation.ports import StreamDelta, StreamError, StreamFinal, StreamStart, TranslationRequest


@pytest.mark.asyncio
async def test_groq_adapter_streams_start_delta_and_final():
    body = (
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":2}}\n\n'
        "data: [DONE]\n\n"
    ).encode("utf-8")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer test-key"
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["model"] == "openai/gpt-oss-20b"
        assert payload["stream"] is True
        return httpx.Response(200, content=body, headers={"Content-Type": "text/event-stream"})

    adapter = GroqTranslationAdapter(
        api_key="test-key",
        transport=httpx.MockTransport(handler),
    )
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="hello",
    )

    events = [event async for event in adapter.translate_stream(request)]

    assert isinstance(events[0], StreamStart)
    assert any(isinstance(event, StreamDelta) for event in events)
    assert isinstance(events[-1], StreamFinal)
    assert events[-1].text == "Hello world"
    assert events[-1].input_tokens == 12
    assert events[-1].output_tokens == 2


@pytest.mark.asyncio
async def test_groq_adapter_maps_rate_limit_errors():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            json={"error": {"message": "Rate limit exceeded", "type": "rate_limit_error"}},
        )

    adapter = GroqTranslationAdapter(
        api_key="test-key",
        transport=httpx.MockTransport(handler),
    )
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="hello",
    )

    events = [event async for event in adapter.translate_stream(request)]

    assert len(events) == 1
    assert isinstance(events[0], StreamError)
    assert events[0].code == TranslationErrorCode.RATE_LIMITED
    assert events[0].retryable is True
