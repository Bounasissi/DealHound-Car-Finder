#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_FILE:-}" || -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "BACKUP_FILE and RESTORE_DATABASE_URL are required" >&2
  exit 1
fi
pg_restore --list "$BACKUP_FILE" >/dev/null
pg_restore --no-owner --clean --if-exists --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -Atc 'select 1' | grep -qx 1
echo "Restore check passed"
