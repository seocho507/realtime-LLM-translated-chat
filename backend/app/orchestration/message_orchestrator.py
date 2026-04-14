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
        target_groups = self._connection_manager.snapshot_target_groups(conversation_id)
        if not target_groups:
            return

        for target_lang in sorted(target_groups):
            await self._connection_manager.send(
                conversation_id,
                target_groups[target_lang],
                to_payload(
                    "msg_start",
                    id=message.client_msg_id,
                    original=message.text,
                    src=message.source_lang,
                    dst=target_lang,
                    status="translating",
                    sender_id=principal.user_id,
                    sender_display_name=principal.display_name,
                    sender_email=principal.email,
                ),
            )
        self._metrics.observe("original_delivery_ms", int((perf_counter() - original_started) * 1000))

        for target_lang in sorted(target_groups):
            await self._translate_for_target_group(
                conversation_id=conversation_id,
                message_id=message_id,
                client_msg_id=message.client_msg_id,
                text=message.text,
                source_lang=message.source_lang,
                target_lang=target_lang,
                websockets=target_groups[target_lang],
                persist=True,
            )

    async def _translate_for_target_group(
        self,
        conversation_id: str,
        message_id: int | None,
        client_msg_id: str,
        text: str,
        source_lang: str,
        target_lang: str,
        websockets,
        *,
        persist: bool,
    ) -> None:
        request = TranslationRequest(
            request_id=f"{client_msg_id}:{target_lang}",
            source_lang=source_lang,
            target_lang=target_lang,
            text=text,
            metadata={"prompt_version": "v1"},
        )
        provider: str | None = None
        model: str | None = None
        try:
            async for event in self._translation_service.translate(request):
                if isinstance(event, StreamStart):
                    provider = event.provider
                    model = event.model
                elif isinstance(event, StreamDelta):
                    await self._connection_manager.send(
                        conversation_id,
                        websockets,
                        to_payload("msg_delta", id=client_msg_id, text=event.text, dst=target_lang),
                    )
                elif isinstance(event, StreamFinal):
                    if event.latency_first_token_ms is not None:
                        self._metrics.observe("translation_ttft_ms", event.latency_first_token_ms)
                    if event.latency_total_ms is not None:
                        self._metrics.observe("translation_full_ms", event.latency_total_ms)
                    if persist and message_id is not None:
                        await self._message_repository.save_translation(
                            message_id,
                            TranslationRecord(
                                target_lang=target_lang,
                                translated_text=event.text,
                                provider=provider,
                                model=model,
                                cached=event.cached,
                                latency_first_token_ms=event.latency_first_token_ms,
                                latency_total_ms=event.latency_total_ms,
                            ),
                        )
                    await self._connection_manager.send(
                        conversation_id,
                        websockets,
                        to_payload(
                            "msg_final",
                            id=client_msg_id,
                            text=event.text,
                            provider=provider,
                            model=model,
                            dst=target_lang,
                        ),
                    )
                elif isinstance(event, StreamError):
                    await self._record_translation_error(
                        conversation_id=conversation_id,
                        message_id=message_id,
                        client_msg_id=client_msg_id,
                        target_lang=target_lang,
                        code=event.code,
                        provider=provider,
                        model=model,
                        websockets=websockets,
                        persist=persist,
                    )
        except Exception:
            await self._record_translation_error(
                conversation_id=conversation_id,
                message_id=message_id,
                client_msg_id=client_msg_id,
                target_lang=target_lang,
                code="translation_failed",
                provider=provider,
                model=model,
                websockets=websockets,
                persist=persist,
            )

    async def _record_translation_error(
        self,
        conversation_id: str,
        message_id: int,
        client_msg_id: str,
        target_lang: str,
        code: str,
        provider: str | None,
        model: str | None,
        websockets,
        *,
        persist: bool,
    ) -> None:
        self._metrics.increment("llm_provider_error_rate")
        if persist and message_id is not None:
            await self._message_repository.save_translation(
                message_id,
                TranslationRecord(
                    target_lang=target_lang,
                    translated_text=None,
                    provider=provider,
                    model=model,
                    error_code=code,
                ),
            )
        await self._connection_manager.send(
            conversation_id,
            websockets,
            to_payload("msg_error", id=client_msg_id, code=code, fallback="original_only", dst=target_lang),
        )
