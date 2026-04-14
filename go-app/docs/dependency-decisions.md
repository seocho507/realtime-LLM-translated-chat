# Dependency Decisions

Current bounded dependencies for `go-app/`:

- `github.com/gorilla/websocket`
  - Rationale: Go stdlib does not provide server WebSocket support.
- `github.com/mattn/go-sqlite3`
  - Rationale: `database/sql` requires a SQLite driver; this keeps the rest of persistence on stdlib APIs.
- `golang.org/x/crypto`
  - Rationale: stdlib does not provide scrypt needed to preserve current local-password hashing semantics.
