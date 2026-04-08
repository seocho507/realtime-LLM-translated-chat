from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, conversation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[conversation_id].add(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(conversation_id)
        if not room:
            return
        room.discard(websocket)
        if not room:
            self._rooms.pop(conversation_id, None)

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        for websocket in list(self._rooms.get(conversation_id, set())):
            await websocket.send_json(payload)
