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
python -m pip install -e ".[dev]"
pytest
```

### Frontend

```bash
cd web
npm install
npm run test
npm run build
```

