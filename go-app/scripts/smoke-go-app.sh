#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/go/bin:$PATH"
cd "$(dirname "$0")/.."
go run ./cmd/server
