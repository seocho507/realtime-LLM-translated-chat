from __future__ import annotations

from enum import StrEnum


class TranslationErrorCode(StrEnum):
    RATE_LIMITED = "LLM_RATE_LIMITED"
    OVERLOADED = "LLM_OVERLOADED"
    AUTH_FAILED = "LLM_AUTH_FAILED"
    BAD_REQUEST = "LLM_BAD_REQUEST"
    PROVIDER_UNAVAILABLE = "LLM_PROVIDER_UNAVAILABLE"
    UNKNOWN = "LLM_UNKNOWN"
