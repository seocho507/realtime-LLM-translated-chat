from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth.session_service import SessionService
from app.orchestration.message_orchestrator import ChatInboundMessage, MessageOrchestrator
from app.realtime.connection_manager import ConnectionManager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/chat/{conversation_id}")
async def chat_socket(websocket: WebSocket, conversation_id: str) -> None:
    token = websocket.query_params.get("token") or websocket.cookies.get("talk_session")
    session_service: SessionService = websocket.app.state.session_service
    connection_manager: ConnectionManager = websocket.app.state.connection_manager
    orchestrator: MessageOrchestrator = websocket.app.state.orchestrator
    principal = session_service.verify(token or "")
    if not principal:
        await websocket.close(code=4401)
        return

    await connection_manager.connect(conversation_id, websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") != "send_message":
                continue
            message = ChatInboundMessage(
                client_msg_id=payload["client_msg_id"],
                text=payload["text"],
                source_lang=payload.get("source_lang", "auto"),
                target_lang=payload.get("target_lang", "en"),
            )
            await orchestrator.handle_message(conversation_id, principal, message)
    except WebSocketDisconnect:
        websocket.app.state.metrics.increment("ws_disconnect_rate")
        connection_manager.disconnect(conversation_id, websocket)
