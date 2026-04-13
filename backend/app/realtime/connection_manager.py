from __future__ import annotations

from collections.abc import Iterable
from collections import defaultdict
from dataclasses import dataclass

from fastapi import WebSocket, WebSocketDisconnect


@dataclass(slots=True)
class RoomConnection:
    target_lang: str = "en"


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[WebSocket, RoomConnection]] = defaultdict(dict)

    async def connect(self, conversation_id: str, websocket: WebSocket, *, target_lang: str = "en") -> None:
        await websocket.accept()
        self._rooms[conversation_id][websocket] = RoomConnection(target_lang=target_lang)

    def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(conversation_id)
        if not room:
            return
        room.pop(websocket, None)
        if not room:
            self._rooms.pop(conversation_id, None)

    def update_target_lang(self, conversation_id: str, websocket: WebSocket, target_lang: str) -> None:
        room = self._rooms.get(conversation_id)
        if not room or not target_lang:
            return
        connection = room.get(websocket)
        if connection is None:
            return
        connection.target_lang = target_lang

    def snapshot_target_groups(self, conversation_id: str) -> dict[str, tuple[WebSocket, ...]]:
        grouped: dict[str, list[WebSocket]] = defaultdict(list)
        for websocket, connection in self._rooms.get(conversation_id, {}).items():
            grouped[connection.target_lang].append(websocket)
        return {target_lang: tuple(websockets) for target_lang, websockets in grouped.items()}

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        await self.send(conversation_id, tuple(self._rooms.get(conversation_id, {})), payload)

    async def send(self, conversation_id: str, websockets: Iterable[WebSocket], payload: dict) -> None:
        for websocket in tuple(websockets):
            try:
                await websocket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                self.disconnect(conversation_id, websocket)
