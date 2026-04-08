from __future__ import annotations

from fastapi import Request

from app.auth.google_oauth import GoogleOAuthClient
from app.auth.session_service import SessionService


def get_google_verifier(request: Request) -> GoogleOAuthClient:
    return request.app.state.google_oauth_client


def get_session_service(request: Request) -> SessionService:
    return request.app.state.session_service
