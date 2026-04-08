from __future__ import annotations

from dataclasses import dataclass

from app.api.events import to_payload
from app.auth.session_service import SessionPrincipal
from app.realtime.connection_manager import ConnectionManager


@dataclass(slots=True)
class ChatInboundMessage:
    client_msg_id: str
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class MessageOrchestrator:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._connection_manager = connection_manager

    async def handle_message(
        self,
        conversation_id: str,
        principal: SessionPrincipal,
        message: ChatInboundMessage,
    ) -> None:
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
