# Production runbook

DealHound's $0 path uses user-provided listing data, NHTSA/vPIC one-VIN lookups, comparable-listing valuation, manual book-value entry, manual title/document review, and an in-app alert inbox. It never fabricates title evidence and never requires a paid automotive API.

## Required configuration

Set `APP_ACCESS_TOKEN` or `APP_USERS_JSON`, `DATABASE_URL`, and keep `ALLOW_UNAUTHENTICATED_LOCAL=false` anywhere other than explicitly local development. Authentication is mandatory for production. The browser signs in at `/login` and receives a same-origin HttpOnly session cookie; API clients may use `Authorization: Bearer <token>`.

Listings enter through pasted text, screenshots/notes, user-provided CSV, or an explicitly allowlisted JSON/plain-text URL feed. HTML pages and arbitrary hosts are rejected. Configure `ALLOWED_LISTING_URL_HOSTS` only for feeds you are authorized to access; otherwise paste the listing manually.

Title states are intentionally conservative: seller claims remain `SELLER_CLAIMS_CLEAN`, a user-recorded document review is `DOCUMENT_REVIEWED`, and only authoritative evidence may produce `HISTORY_CLEAN` or `VERIFIED`. A missing history provider is not an error on the $0 path; it means manual verification is required.

Valuation uses three free-compatible options: comparable listings (`comps`), a user-entered KBB/JD Power/private-party value (`manual-kbb-entry`), or an optional separately approved licensed adapter. Every saved valuation stores its provider and provenance note.

Alerts are always persisted to the in-app inbox. `ALERT_WEBHOOK_URL` is optional and can point to a free Discord webhook; delivery failures are recorded and retried without changing the deal decision.

## Release gate

Run:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then verify `GET /api/health` returns `status: ok`, authenticate a smoke-test request, ingest a user-supplied listing and CSV row, record a manual title note, add a comparable valuation, confirm provenance is visible, and confirm repeated evaluation creates at most one alert.

## Recovery

Take a database backup before migrations. Migrations are append-only files in `drizzle/` and are tracked by `_migrations`. If independent history evidence is unavailable, leave listings in an unverified/manual-review state; do not set `HISTORY_CLEAN` or `VERIFIED` merely because a seller says the title is clean.
