import pytest

from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.ports import StreamDelta, StreamFinal, StreamStart, TranslationRequest


@pytest.mark.asyncio
async def test_mock_adapter_streams_start_delta_and_final():
    adapter = MockTranslationAdapter()
    request = TranslationRequest(
        request_id="req-1",
        source_lang="ko",
        target_lang="en",
        text="안녕하세요",
    )
    events = [event async for event in adapter.translate_stream(request)]
    assert isinstance(events[0], StreamStart)
    assert any(isinstance(event, StreamDelta) for event in events)
    assert isinstance(events[-1], StreamFinal)
    assert events[-1].text.startswith("[en]")
