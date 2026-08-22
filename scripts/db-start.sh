#!/usr/bin/env bash
# Start the repo-local PostgreSQL cluster (idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
[ -x "$PG_BIN/pg_ctl" ] || PG_BIN="$(brew --prefix)/opt/postgresql@17/bin"

mkdir -p .pgsock
if [ ! -d .pgdata ]; then
  echo "No cluster found (.pgdata missing). Run: pnpm db:setup" >&2
  exit 1
fi

"$PG_BIN/pg_ctl" -D .pgdata -l .pgdata/server.log \
  -o "-p 5433 -k $(pwd)/.pgsock" status >/dev/null 2>&1 && {
  echo "PostgreSQL already running."
  exit 0
}
"$PG_BIN/pg_ctl" -D .pgdata -l .pgdata/server.log -o "-p 5433 -k $(pwd)/.pgsock" start
