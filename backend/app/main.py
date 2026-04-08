from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth_google import router as auth_router
from app.api.ws import router as ws_router
from app.auth.google_oauth import HttpGoogleOAuthClient
from app.auth.session_service import SessionService
from app.cache.translation_cache import MemoryTranslationCache
from app.config import get_settings
from app.observability.metrics import MetricsRegistry
from app.orchestration.message_orchestrator import MessageOrchestrator
from app.persistence.database import Database
from app.persistence.models import Base
from app.persistence.repositories.messages import MessageRepository
from app.realtime.connection_manager import ConnectionManager
from app.translation.adapters.anthropic import AnthropicTranslationAdapter
from app.translation.adapters.mock import MockTranslationAdapter
from app.translation.router import TranslationRouter
from app.translation.service import TranslationService


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = Database(settings.database_url)
        await database.init_models(Base.metadata)
        app.state.database = database
        app.state.message_repository = MessageRepository(database.session_factory)
        app.state.orchestrator = MessageOrchestrator(
            app.state.connection_manager,
            app.state.translation_service,
            app.state.message_repository,
            app.state.metrics,
        )
        yield
        await database.engine.dispose()

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    router = TranslationRouter(
        adapters=[AnthropicTranslationAdapter(), MockTranslationAdapter()],
        default_provider=settings.default_provider,
    )
    metrics = MetricsRegistry()
    app.state.metrics = metrics
    app.state.translation_service = TranslationService(
        settings=settings,
        router=router,
        cache=MemoryTranslationCache(),
        metrics=metrics,
    )
    app.state.session_service = SessionService(secret=settings.session_secret, ttl_seconds=settings.session_ttl_seconds)
    app.state.google_oauth_client = HttpGoogleOAuthClient(
        client_id=settings.google_client_id,
        allowed_domain=settings.google_allowed_domain,
    )
    app.state.connection_manager = ConnectionManager()

    app.include_router(auth_router)
    app.include_router(ws_router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "provider": settings.default_provider}

    @app.get("/metrics")
    async def metrics_view() -> dict:
        return {
            "counters": dict(app.state.metrics.counters),
            "timings": {key: values[:] for key, values in app.state.metrics.timings.items()},
        }

    return app


app = create_app()
