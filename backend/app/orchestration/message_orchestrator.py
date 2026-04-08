from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter

from app.api.events import to_payload
from app.auth.session_service import SessionPrincipal
from app.observability.metrics import MetricsRegistry
from app.persistence.repositories.messages import MessageRepository, TranslationRecord
from app.realtime.connection_manager import ConnectionManager
from app.translation.ports import StreamDelta, StreamError, StreamFinal, StreamStart, TranslationRequest
from app.translation.service import TranslationService


@dataclass(slots=True)
class ChatInboundMessage:
    client_msg_id: str
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class MessageOrchestrator:
    def __init__(
        self,
        connection_manager: ConnectionManager,
        translation_service: TranslationService,
        message_repository: MessageRepository,
        metrics: MetricsRegistry,
    ) -> None:
        self._connection_manager = connection_manager
        self._translation_service = translation_service
        self._message_repository = message_repository
        self._metrics = metrics

    async def handle_message(
        self,
        conversation_id: str,
        principal: SessionPrincipal,
        message: ChatInboundMessage,
    ) -> None:
        original_started = perf_counter()
        message_id = await self._message_repository.save_envelope(
            conversation_id=conversation_id,
            sender_id=principal.user_id,
            client_msg_id=message.client_msg_id,
            original_text=message.text,
            original_lang=message.source_lang,
            status="translating",
        )
        await self._connection_manager.broadcast(
            conversation_id,
            to_payload(
                "msg_start",
                id=message.client_msg_id,
                original=message.text,
                src=message.source_lang,
                dst=message.target_lang,
                status="translating",
                sender_id=principal.user_id,
                sender_email=principal.email,
            ),
        )
        self._metrics.observe("original_delivery_ms", int((perf_counter() - original_started) * 1000))

        request = TranslationRequest(
            request_id=message.client_msg_id,
            source_lang=message.source_lang,
            target_lang=message.target_lang,
            text=message.text,
            metadata={"prompt_version": "v1"},
        )
        provider: str | None = None
        model: str | None = None
        async for event in self._translation_service.translate(request):
            if isinstance(event, StreamStart):
                provider = event.provider
                model = event.model
            elif isinstance(event, StreamDelta):
                await self._connection_manager.broadcast(
                    conversation_id,
                    to_payload("msg_delta", id=message.client_msg_id, text=event.text),
                )
            elif isinstance(event, StreamFinal):
                if event.latency_first_token_ms is not None:
                    self._metrics.observe("translation_ttft_ms", event.latency_first_token_ms)
                if event.latency_total_ms is not None:
                    self._metrics.observe("translation_full_ms", event.latency_total_ms)
                await self._message_repository.save_translation(
                    message_id,
                    TranslationRecord(
                        target_lang=message.target_lang,
                        translated_text=event.text,
                        provider=provider,
                        model=model,
                        cached=event.cached,
                        latency_first_token_ms=event.latency_first_token_ms,
                        latency_total_ms=event.latency_total_ms,
                    ),
                )
                await self._connection_manager.broadcast(
                    conversation_id,
                    to_payload(
                        "msg_final",
                        id=message.client_msg_id,
                        text=event.text,
                        provider=provider,
                        model=model,
                    ),
                )
            elif isinstance(event, StreamError):
                self._metrics.increment("llm_provider_error_rate")
                await self._message_repository.save_translation(
                    message_id,
                    TranslationRecord(
                        target_lang=message.target_lang,
                        translated_text=None,
                        provider=provider,
                        model=model,
                        error_code=event.code,
                    ),
                )
                await self._connection_manager.broadcast(
                    conversation_id,
                    to_payload("msg_error", id=message.client_msg_id, code=event.code, fallback="original_only"),
                )
