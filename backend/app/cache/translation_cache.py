from __future__ import annotations

import time

from app.translation.ports import TranslationCache


class MemoryTranslationCache(TranslationCache):
    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, dict[str, object]]] = {}

    async def get(self, key: str) -> dict[str, object] | None:
        entry = self._entries.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            self._entries.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: dict[str, object], ttl_seconds: int) -> None:
        self._entries[key] = (time.time() + ttl_seconds, value)
