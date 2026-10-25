#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
[ -x "$PG_BIN/pg_ctl" ] || PG_BIN="$(brew --prefix)/opt/postgresql@17/bin"
"$PG_BIN/pg_ctl" -D .pgdata stop || true
