from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Talk Backend")
    database_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./talk.db")
    default_provider: str = os.getenv("DEFAULT_PROVIDER", "mock")
    default_model: str = os.getenv("DEFAULT_MODEL", "mock-sonnet")
    session_secret: str = os.getenv("SESSION_SECRET", "dev-session-secret-change-me")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_allowed_domain: str = os.getenv("GOOGLE_ALLOWED_DOMAIN", "")
    translation_cache_ttl_seconds: int = int(os.getenv("TRANSLATION_CACHE_TTL_SECONDS", "86400"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
