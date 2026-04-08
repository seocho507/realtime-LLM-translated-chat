from __future__ import annotations

from fastapi import Depends, Request

from app.auth.google_oauth import GoogleOAuthVerifier, GoogleTokenInfoVerifier
from app.auth.session_service import SessionService
from app.config import Settings, get_settings


def get_app_settings() -> Settings:
    return get_settings()


def get_google_verifier(settings: Settings = Depends(get_app_settings)) -> GoogleOAuthVerifier:
    return GoogleTokenInfoVerifier(
        client_id=settings.google_client_id,
        allowed_domain=settings.google_allowed_domain,
    )


def get_session_service(request: Request) -> SessionService:
    return request.app.state.session_service
