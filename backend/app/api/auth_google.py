from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.auth.google_oauth import GoogleOAuthClient
from app.auth.session_service import SessionPrincipal, SessionService
from app.config import Settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleAuthRequest(BaseModel):
    credential: str


class GuestAuthRequest(BaseModel):
    display_name: str | None = None


class AuthUserResponse(BaseModel):
    session_id: str
    user_id: str
    auth_provider: str
    display_name: str
    google_sub: str | None
    email: str | None
    expires_at: int


class GoogleAuthResponse(BaseModel):
    user: AuthUserResponse


def _set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
        max_age=settings.session_ttl_seconds,
    )


@router.post("/google", response_model=GoogleAuthResponse)
async def google_login(request: Request, body: GoogleAuthRequest, response: Response) -> GoogleAuthResponse:
    google_client: GoogleOAuthClient = request.app.state.google_oauth_client
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    try:
        identity = await google_client.verify_token(body.credential)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"google auth failed: {exc}") from exc

    token, principal = session_service.issue(identity.sub, identity.email)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.post("/guest", response_model=GoogleAuthResponse)
async def guest_login(request: Request, body: GuestAuthRequest, response: Response) -> GoogleAuthResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    token, principal = session_service.issue_guest(body.display_name)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.get("/session", response_model=AuthUserResponse)
async def session_info(request: Request) -> AuthUserResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    token = request.cookies.get(settings.session_cookie_name)
    principal = session_service.verify(token or "")
    if not principal:
        raise HTTPException(status_code=401, detail="invalid session")
    return AuthUserResponse(**asdict(principal))
