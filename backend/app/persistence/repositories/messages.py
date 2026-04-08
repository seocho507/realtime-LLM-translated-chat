from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select, update

from app.persistence.models import Message, MessageTranslation


@dataclass(slots=True)
class TranslationRecord:
    target_lang: str
    translated_text: str | None
    provider: str | None
    model: str | None
    prompt_version: str = 'v1'
    cached: bool = False
    latency_first_token_ms: int | None = None
    latency_total_ms: int | None = None
    error_code: str | None = None


class MessageRepository:
    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    async def save_envelope(
        self,
        conversation_id: str,
        sender_id: str,
        client_msg_id: str,
        original_text: str,
        original_lang: str,
        status: str,
    ) -> int:
        async with self._session_factory() as session:
            message = Message(
                conversation_id=conversation_id,
                sender_id=sender_id,
                client_msg_id=client_msg_id,
                original_text=original_text,
                original_lang=original_lang,
                status=status,
            )
            session.add(message)
            await session.commit()
            await session.refresh(message)
            return message.id

    async def save_translation(self, message_id: int, record: TranslationRecord) -> None:
        async with self._session_factory() as session:
            session.add(
                MessageTranslation(
                    message_id=message_id,
                    target_lang=record.target_lang,
                    translated_text=record.translated_text,
                    provider=record.provider,
                    model=record.model,
                    prompt_version=record.prompt_version,
                    cached=record.cached,
                    latency_first_token_ms=record.latency_first_token_ms,
                    latency_total_ms=record.latency_total_ms,
                    error_code=record.error_code,
                )
            )
            await session.execute(
                update(Message)
                .where(Message.id == message_id)
                .values(status='translated' if not record.error_code else 'error')
            )
            await session.commit()

    async def get_message_by_client_id(self, client_msg_id: str) -> Message | None:
        async with self._session_factory() as session:
            result = await session.execute(select(Message).where(Message.client_msg_id == client_msg_id))
            return result.scalar_one_or_none()
