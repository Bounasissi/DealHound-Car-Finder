#!/usr/bin/env bash
# Initialize a repo-local PostgreSQL cluster and the dealhound database.
# Self-contained: data lives in ./.pgdata (gitignored). No system services.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
[ -x "$PG_BIN/postgres" ] || PG_BIN="$(brew --prefix)/opt/postgresql@17/bin"
[ -x "$PG_BIN/postgres" ] || { echo "PostgreSQL 17 not found. Set PG_BIN."; exit 1; }

mkdir -p .pgsock
if [ ! -d .pgdata ]; then
  echo "Initializing PostgreSQL cluster in .pgdata ..."
  "$PG_BIN/initdb" -D .pgdata -U dealhound --auth=trust -E UTF8 >/dev/null
fi

bash scripts/db-start.sh

export PATH="$PG_BIN:$PATH"
SOCK="$(pwd)/.pgsock"
if ! psql -h "$SOCK" -p 5433 -U dealhound -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='dealhound'" | grep -q 1; then
  createdb -h "$SOCK" -p 5433 -U dealhound dealhound
  echo "Created database 'dealhound'."
fi
echo "PostgreSQL ready: postgres://dealhound@localhost:5433/dealhound (socket: .pgsock)"
