from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_google import router as auth_router
from app.api.ws import router as ws_router
from app.auth.google_oauth import HttpGoogleOAuthClient
from app.auth.session_service import SessionService
from app.config import get_settings
from app.orchestration.message_orchestrator import MessageOrchestrator
from app.realtime.connection_manager import ConnectionManager


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.session_service = SessionService(secret=settings.session_secret)
    app.state.google_oauth_client = HttpGoogleOAuthClient(
        client_id=settings.google_client_id,
        allowed_domain=settings.google_allowed_domain,
    )
    app.state.connection_manager = ConnectionManager()
    app.state.orchestrator = MessageOrchestrator(app.state.connection_manager)

    app.include_router(auth_router)
    app.include_router(ws_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "provider": settings.default_provider}

    return app


app = create_app()
