# Talk

## 1. Summary

Talk is a real-time translated chat application.
Users join the same room, send original messages, and receive translated output in their selected target language.
Original delivery is immediate. Translation is streamed after delivery.

## 2. Objectives

- Maintain message flow without waiting for translation completion
- Keep translation as a secondary layer, not a delivery prerequisite
- Preserve conversation continuity when translation fails
- Isolate model-provider dependencies from upper application layers

## 3. Scope

### 3.1 User-facing scope

- Guest entry
- Local account sign-up and sign-in
- Room join by room ID
- Per-user target language selection
- Original + translated message display
- Original-text fallback on translation failure

### 3.2 Backend scope

- FastAPI-based HTTP and WebSocket server
- Cookie-based session authentication
- Google token verification seam
- SQLite persistence for message envelopes and translations
- Translation cache
- Metrics endpoint
- Provider-agnostic translation routing
- Translation adapters:
  - `groq`
  - `mock`

### 3.3 Frontend scope

- React + Vite single-page application
- Room switch UI
- Target-language selection UI
- WebSocket-based live message updates
- Buffered rendering for translation deltas
- Session restore on app load

### 3.4 Parallel track

- `go-app/` contains a Go implementation under parity migration with the Python backend

## 4. Repository layout

```text
.
├─ backend/                         # Reference backend implementation
│  ├─ app/
│  │  ├─ api/                       # Auth / websocket endpoints
│  │  ├─ auth/                      # Session, password, google auth
│  │  ├─ cache/                     # Translation cache
│  │  ├─ orchestration/             # Message orchestration
│  │  ├─ persistence/               # Database, models, repositories
│  │  ├─ realtime/                  # Connection management
│  │  └─ translation/               # Ports, router, service, adapters
│  └─ tests/
├─ web/                             # React frontend
│  └─ src/
│     ├─ features/auth/
│     ├─ features/chat/
│     └─ components/ui/
├─ go-app/                          # Go migration track
├─ real-time-llm-translated-chat-architecture-plan.md
└─ Dockerfile
```

## 5. Runtime flow

1. Client connects to a room over WebSocket.
2. Client sets a target language.
3. Client sends a message.
4. Server accepts and distributes the original message.
5. Server groups room participants by target language.
6. Translation is produced per target-language group.
7. Client receives translation events in sequence:
   - `msg_start`
   - `msg_delta`
   - `msg_final`
8. Translation result and metadata are persisted.

## 6. Delivery model

### 6.1 Message delivery

- Original message delivery is not blocked by translation.
- Translation is streamed after the original message is available.
- Translation failure does not cancel original-message availability.

### 6.2 Translation model

- Upper layers depend on application-level translation contracts.
- Provider SDK details remain inside adapter implementations.
- Provider switching is handled through router and port boundaries.

## 7. Stack

### 7.1 Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Radix UI
- Vitest
- Testing Library

### 7.2 Backend reference implementation

- Python 3.11+
- FastAPI
- WebSocket
- SQLAlchemy
- aiosqlite
- httpx
- pytest
- pytest-asyncio

### 7.3 Backend migration track

- Go
- Gorilla WebSocket
- SQLite
- Go standard library centered implementation

## 8. Execution

### 8.1 Same-origin local run

Build the frontend first. FastAPI then serves the built frontend.

```bash
cd web
npm ci
npm run build

cd ../backend
uv sync --python 3.11 --extra dev
uv run uvicorn app.main:app --reload
```

Open:

- `http://localhost:8000`

### 8.2 Split frontend/backend run

Backend:

```bash
cd backend
uv sync --python 3.11 --extra dev
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
cd web
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Note:

- Frontend uses `window.location.origin` by default.
- When running on the Vite dev server, set `VITE_API_BASE_URL` explicitly.

### 8.3 Docker run

```bash
docker build -t talk .
docker run --rm -p 8000:8000 talk
```

## 9. Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./talk.db` | Python backend DB path |
| `DEFAULT_PROVIDER` | `groq` | Default translation provider |
| `DEFAULT_MODEL` | `openai/gpt-oss-20b` | Default translation model |
| `GROQ_API_KEY` | `""` | Groq API key |
| `GROQ_API_BASE_URL` | Groq endpoint | Groq endpoint override |
| `SESSION_SECRET` | development default | Session signing key |
| `SESSION_TTL_SECONDS` | `28800` | Session TTL |
| `SESSION_COOKIE_NAME` | `talk_session` | Session cookie name |
| `GOOGLE_CLIENT_ID` | `""` | Google token verification client ID |
| `GOOGLE_ALLOWED_DOMAIN` | `""` | Allowed Google Workspace domain |
| `TRANSLATION_CACHE_TTL_SECONDS` | `86400` | Translation cache TTL |
| `WEB_DIST_DIR` | `web/dist` | Built frontend path |
| `CORS_ALLOWED_ORIGINS` | localhost origins | CORS allowlist |
| `VITE_API_BASE_URL` | current origin | Frontend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | `""` | Frontend Google Identity client ID |

## 10. Verification

### 10.1 Frontend

```bash
cd web
npm ci
npm run test
npm run build
```

### 10.2 Python backend

```bash
cd backend
uv sync --python 3.11 --extra dev
uv run pytest
```

### 10.3 Go backend

```bash
cd go-app
go test ./...
```

## 11. Current status

Implemented:

- Real-time room connection
- Per-user target language selection
- Translation streaming UI
- Session-based entry flow
- SQLite persistence for messages and translations
- Provider abstraction boundary
- Go migration track

In progress:

- Go parity migration
- Additional providers
- Runtime configuration cleanup
- Deployment pipeline cleanup
- UI polish

## 12. Entry points

Recommended files for initial review:

- `backend/app/orchestration/message_orchestrator.py`
- `backend/app/translation/`
- `backend/app/api/ws.py`
- `web/src/features/chat/useChatSocket.ts`
- `web/src/features/chat/translationBuffer.ts`
- `go-app/`
- `real-time-llm-translated-chat-architecture-plan.md`
