# Real-Time LLM Translated Chat

Phased implementation of a provider-agnostic realtime chat service with:

- original-first delivery
- streaming translation updates
- Google OAuth2-backed session bootstrap
- persistence, metrics, and multi-provider readiness

## Layout

- `backend/` — FastAPI application
- `web/` — React + Vite frontend
- `real-time-llm-translated-chat-architecture-plan.md` — source architecture note

## Planned commands

### Backend

```bash
cd backend
uv sync --python 3.11 --extra dev
uv run pytest
```

### Frontend

```bash
cd web
npm ci
npm run test
npm run build
```

### Same-origin local run

```bash
cd web
npm ci
npm run build

cd ../backend
uv sync --python 3.11 --extra dev
uv run uvicorn app.main:app --reload
```

Then open `http://localhost:8000`.
