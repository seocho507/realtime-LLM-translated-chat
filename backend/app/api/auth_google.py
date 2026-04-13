from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.auth.google_oauth import GoogleOAuthClient
from app.auth.passwords import PasswordService
from app.auth.session_service import SessionService
from app.config import Settings
from app.persistence.repositories.users import UserRepository

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleAuthRequest(BaseModel):
    credential: str


class GuestAuthRequest(BaseModel):
    display_name: str | None = None


class LocalSignupRequest(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LocalLoginRequest(BaseModel):
    email: str
    password: str


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


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
    )


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _resolve_display_name(display_name: str | None, email: str) -> str:
    cleaned = (display_name or '').strip()
    if cleaned:
        return cleaned
    return email.split('@', 1)[0]


def _validate_local_credentials(email: str, password: str) -> None:
    if '@' not in email or not email.strip():
        raise HTTPException(status_code=400, detail='valid email is required')
    if len(password) < 8:
        raise HTTPException(status_code=400, detail='password must be at least 8 characters')


@router.post('/google', response_model=GoogleAuthResponse)
async def google_login(request: Request, body: GoogleAuthRequest, response: Response) -> GoogleAuthResponse:
    google_client: GoogleOAuthClient = request.app.state.google_oauth_client
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    try:
        identity = await google_client.verify_token(body.credential)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f'google auth failed: {exc}') from exc

    token, principal = session_service.issue(identity.sub, identity.email)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.post('/signup', response_model=GoogleAuthResponse)
async def signup_local_account(request: Request, body: LocalSignupRequest, response: Response) -> GoogleAuthResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    user_repository: UserRepository = request.app.state.user_repository
    password_service: PasswordService = request.app.state.password_service

    email = _normalize_email(body.email)
    _validate_local_credentials(email, body.password)
    existing = await user_repository.get_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail='account already exists')

    user = await user_repository.create_local_user(
        email=email,
        display_name=_resolve_display_name(body.display_name, email),
        password_hash=password_service.hash_password(body.password),
    )
    token, principal = session_service.issue_local(user.user_id, user.email, user.display_name)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.post('/login', response_model=GoogleAuthResponse)
async def login_local_account(request: Request, body: LocalLoginRequest, response: Response) -> GoogleAuthResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    user_repository: UserRepository = request.app.state.user_repository
    password_service: PasswordService = request.app.state.password_service

    email = _normalize_email(body.email)
    _validate_local_credentials(email, body.password)
    user = await user_repository.get_by_email(email)
    if not user or not password_service.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail='invalid email or password')

    token, principal = session_service.issue_local(user.user_id, user.email, user.display_name)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.post('/guest', response_model=GoogleAuthResponse)
async def guest_login(request: Request, body: GuestAuthRequest, response: Response) -> GoogleAuthResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    token, principal = session_service.issue_guest(body.display_name)
    _set_session_cookie(response, settings, token)
    return GoogleAuthResponse(user=AuthUserResponse(**asdict(principal)))


@router.post('/logout', status_code=204)
async def logout(request: Request, response: Response) -> Response:
    settings: Settings = request.app.state.settings
    _clear_session_cookie(response, settings)
    response.status_code = 204
    return response


@router.get('/session', response_model=AuthUserResponse)
async def session_info(request: Request) -> AuthUserResponse:
    session_service: SessionService = request.app.state.session_service
    settings: Settings = request.app.state.settings
    token = request.cookies.get(settings.session_cookie_name)
    principal = session_service.verify(token or '')
    if not principal:
        raise HTTPException(status_code=401, detail='invalid session')
    return AuthUserResponse(**asdict(principal))
