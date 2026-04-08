from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.auth.google_oauth import GoogleOAuthClient
from app.auth.session_service import SessionPrincipal, SessionService

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleAuthRequest(BaseModel):
    credential: str


class AuthUserResponse(BaseModel):
    session_id: str
    user_id: str
    google_sub: str
    email: str
    expires_at: int


class GoogleAuthResponse(BaseModel):
    token: str
    user: AuthUserResponse


@router.post("/google", response_model=GoogleAuthResponse)
async def google_login(request: Request, body: GoogleAuthRequest, response: Response) -> GoogleAuthResponse:
    google_client: GoogleOAuthClient = request.app.state.google_oauth_client
    session_service: SessionService = request.app.state.session_service
    try:
        identity = await google_client.verify_token(body.credential)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"google auth failed: {exc}") from exc

    token, principal = session_service.issue(identity.sub, identity.email)
    response.set_cookie("talk_session", token, httponly=True, samesite="lax")
    return GoogleAuthResponse(token=token, user=AuthUserResponse(**asdict(principal)))


@router.get("/session", response_model=AuthUserResponse)
async def session_info(request: Request) -> AuthUserResponse:
    session_service: SessionService = request.app.state.session_service
    token = request.cookies.get("talk_session")
    principal = session_service.verify(token or "")
    if not principal:
        raise HTTPException(status_code=401, detail="invalid session")
    return AuthUserResponse(**asdict(principal))
