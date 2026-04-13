from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
import os
from pathlib import Path


def _parse_csv(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _parse_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "Talk Backend"))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./talk.db"))
    default_provider: str = field(default_factory=lambda: os.getenv("DEFAULT_PROVIDER", "groq"))
    default_model: str = field(default_factory=lambda: os.getenv("DEFAULT_MODEL", "openai/gpt-oss-20b"))
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    groq_api_base_url: str = field(
        default_factory=lambda: os.getenv("GROQ_API_BASE_URL", "https://api.groq.com/openai/v1/chat/completions")
    )
    session_secret: str = field(default_factory=lambda: os.getenv("SESSION_SECRET", "dev-session-secret-change-me"))
    session_ttl_seconds: int = field(default_factory=lambda: int(os.getenv("SESSION_TTL_SECONDS", "28800")))
    session_cookie_name: str = field(default_factory=lambda: os.getenv("SESSION_COOKIE_NAME", "talk_session"))
    session_cookie_secure: bool = field(default_factory=lambda: _parse_bool("SESSION_COOKIE_SECURE", False))
    session_cookie_samesite: str = field(default_factory=lambda: os.getenv("SESSION_COOKIE_SAMESITE", "lax"))
    google_client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""))
    google_allowed_domain: str = field(default_factory=lambda: os.getenv("GOOGLE_ALLOWED_DOMAIN", ""))
    translation_cache_ttl_seconds: int = field(
        default_factory=lambda: int(os.getenv("TRANSLATION_CACHE_TTL_SECONDS", "86400"))
    )
    web_dist_dir: str = field(
        default_factory=lambda: os.getenv(
            "WEB_DIST_DIR",
            str(Path(__file__).resolve().parents[2] / "web" / "dist"),
        )
    )
    cors_allowed_origins: tuple[str, ...] = field(
        default_factory=lambda: _parse_csv(
            os.getenv(
                "CORS_ALLOWED_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8000,http://127.0.0.1:8000",
            )
        )
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
