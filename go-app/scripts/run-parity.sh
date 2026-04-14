#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/go/bin:$PATH"
cd "$(dirname "$0")/.."
go test ./...
python3 scripts/compare_http_parity.py
"$(dirname "$0")/compare_ws_parity.py"
python3 scripts/verify_shared_compat.py
