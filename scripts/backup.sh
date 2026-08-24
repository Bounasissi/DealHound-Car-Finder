#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_DIR:-}" ]]; then
  echo "BACKUP_DIR must point to an approved durable backup target" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/dealhound-$stamp.dump"
pg_dump --format=custom --no-owner --file="$file" "$DATABASE_URL"
shasum -a 256 "$file" > "$file.sha256"
echo "Created $file and checksum $file.sha256"
