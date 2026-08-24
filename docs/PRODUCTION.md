# Production runbook

DealHound's $0 path uses user-provided listing data, NHTSA/vPIC one-VIN lookups, comparable-listing valuation, manual book-value entry, manual title/document review, and an in-app alert inbox. It never fabricates title evidence and never requires a paid automotive API.

## Required configuration

Set `APP_ACCESS_TOKEN` or `APP_USERS_JSON`, `DATABASE_URL`, and keep `ALLOW_UNAUTHENTICATED_LOCAL=false` anywhere other than explicitly local development. Authentication is mandatory for production. The browser signs in at `/login` and receives a same-origin HttpOnly session cookie; API clients may use `Authorization: Bearer <token>`.

Listings enter through pasted text, screenshots/notes, user-provided CSV, an explicitly allowlisted JSON/plain-text URL feed, or the optional licensed MarketCheck FSBO adapter. HTML pages and arbitrary hosts are rejected. Configure `ALLOWED_LISTING_URL_HOSTS` only for feeds you are authorized to access; otherwise paste the listing manually. When configured, `MARKETCHECK_SOURCE=facebook.com` narrows the MarketCheck search to Facebook-domain results exposed by your subscription; DealHound never logs into Facebook or scrapes Marketplace directly.

Title states are intentionally conservative: seller claims remain `SELLER_CLAIMS_CLEAN`, a user-recorded document review is `DOCUMENT_REVIEWED`, and only authoritative evidence may produce `HISTORY_CLEAN` or `VERIFIED`. A missing history provider is not an error on the $0 path; it means manual verification is required.

Valuation uses comparable listings (`comps`), a user-entered KBB/JD Power/private-party value (`manual-kbb-entry`), or an optional separately approved licensed adapter. Every saved valuation stores its provider and provenance basis. Search profiles require `KBB_GOOD` by default: comparable and MarketCheck proxy values remain exploratory and cannot qualify the default deal lane or create alerts.

For a live KBB lane, obtain KBB InfoDriver approval and configure the approved bridge described in [`docs/KBB-INTEGRATION.md`](KBB-INTEGRATION.md). The public KBB product page does not expose an undocumented endpoint contract; do not scrape KBB.com or treat a generic market-price provider as KBB.

For automated discovery, set `MARKETCHECK_API_KEY` and sync an active search profile from `/profiles`. The adapter applies ZIP/radius, make/model, year, mileage, price, and (when required) MarketCheck's `carfax_clean_title` filter before DealHound's own scoring and verification gates. MarketCheck's private-party feed is a licensed external dependency; it does not by itself prove a title state inside DealHound.

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

## Account and operations configuration

The first database account created through `/api/auth/signup` receives `OWNER`; later accounts receive `USER`. Owners can create invite tokens through `/api/auth/invite`. Configure `CRON_SECRET` and call `POST /api/cron/run` from the hosting scheduler every five minutes to enqueue and process active profiles. Configure `OBJECT_STORAGE_BASE_URL` and `OBJECT_STORAGE_TOKEN` for durable uploads; otherwise uploads use the local development directory and are not a production durability guarantee.

Configure `EMAIL_API_KEY` or `RESEND_API_KEY` and `EMAIL_FROM` for outbound email. Without them, alerts remain in the in-app inbox and optional webhook path. Set daily `USAGE_*_PER_DAY` ceilings before enabling paid providers.
