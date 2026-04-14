# Go App Migration Notes

This subtree hosts the Go implementation that is being migrated in parallel while `backend/` remains the reference implementation.

Current scope implemented:
- health and metrics endpoints
- static serving and missing-dist fallback
- cookie-based auth/session flows
- local signup/login/logout/session restore
- guest auth flow
- Google token verification client seam
- WebSocket room chat with target-language updates
- SQLite persistence for messages, translations, and local users
- mock and Groq translation adapters
- parity-oriented Go tests derived from the Python backend behavior
