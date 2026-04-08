from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings


settings = get_settings()
app = FastAPI(title=settings.app_name)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": settings.default_provider}
