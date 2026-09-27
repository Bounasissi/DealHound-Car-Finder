#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${DEALHOUND_BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 https://dealhound.example [optional DEALHOUND_SMOKE_TOKEN]" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

health="$(curl --fail-with-body --silent --show-error "$BASE_URL/api/health")"
printf '%s\n' "$health" | node -e '
let input = "";
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  if (!body.status || !body.database) throw new Error("health response is missing status/database");
  process.stdout.write(`health=${body.status} database=${body.database}\n`);
  if (body.release?.ready === true) process.stdout.write("release=ready\n");
  else process.stdout.write(`release=not-ready missing=${(body.release?.missing ?? []).join(",")}\n`);
});
'

unauth_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/listings/not-a-listing/evidence")"
if [[ "$unauth_status" != "401" ]]; then
  echo "Expected unauthenticated evidence request to return 401; got $unauth_status" >&2
  exit 1
fi
echo "unauthenticated-evidence=401"

if [[ -n "${DEALHOUND_SMOKE_TOKEN:-}" ]]; then
  auth_status="$(curl --silent --output /dev/null --write-out '%{http_code}' -H "Authorization: Bearer ${DEALHOUND_SMOKE_TOKEN}" "$BASE_URL/api/listings")"
  if [[ "$auth_status" != "200" ]]; then
    echo "Expected authenticated listings request to return 200; got $auth_status" >&2
    exit 1
  fi
  echo "authenticated-listings=200"
else
  echo "authenticated-listings=skipped (set DEALHOUND_SMOKE_TOKEN to run)"
fi
