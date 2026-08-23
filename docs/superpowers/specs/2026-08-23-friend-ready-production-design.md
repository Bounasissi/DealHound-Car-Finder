# DealHound Friend-Ready Production Design

**Status:** Approved for implementation on 2026-08-23

## Goal

Make DealHound usable by a non-developer friend through a hosted, multi-user application while preserving the existing provider-neutral deal-evaluation pipeline and explicitly separating repository-complete work from external deployment and credential gates.

## Scope

The implementation covers every checklist item that can be implemented and verified in this repository: account and tenant isolation, provider/source reliability, durable job execution, alert preferences, missing-data explainability, inspection and offer workflows, uploads, feedback, health/admin visibility, security controls, documentation, and browser-oriented acceptance coverage.

The following remain external gates and are never represented as complete merely because code exists: a production URL, provisioned production services, live provider contracts/credentials, backup restore evidence, Sentry project configuration, legal/licensing decisions, and a friend-run acceptance test.

## Architecture

DealHound remains a Next.js App Router application with PostgreSQL and Drizzle. Existing domain functions remain the source of truth for parsing, valuation, repairs, scoring, fraud, and workflow rules. New application services sit at the route/repository boundary and use the authenticated user id for every tenant-owned query.

Authentication becomes database-backed. Passwords are hashed with Node's built-in `scrypt`; sessions store only a hash of a random opaque token and are delivered in a same-origin HttpOnly cookie. Users have `OWNER` or `USER` roles. Invitations and password-reset tokens are single-use, hashed, expiry-bound records. Existing static-token authentication remains a documented local/legacy compatibility path but is disabled for production account flows.

Recurring work is represented by database job records with a unique idempotency key, lock timestamps, attempts, retry-after timestamps, and terminal error state. A protected cron endpoint claims due jobs and runs source sync/evaluation with bounded retries. Per-user usage is persisted daily, while the existing in-process limiter remains a fast local guard.

Provider integrations stay replaceable. MarketCheck, vPIC, history, valuation, and outbound notification adapters expose timeout/error results that are recorded as degraded evidence rather than turning a listing into fabricated clean data. Uploads use a storage interface with a safe local filesystem implementation for development and an HTTP-compatible object-storage implementation for production configuration.

## Product surfaces

- `/login`, `/signup`, `/account`, `/invite`, and reset-token flow for account lifecycle.
- `/` deal inbox with score breakdown, confidence, missing-information next actions, and actionable empty/error states.
- `/ingest` accepts pasted text, URLs, CSV, screenshots, VIN, and explicit overrides without Facebook scraping.
- Listing detail adds inspection checklist, offer calculator, seller-question copy, feedback, and workflow transitions.
- `/admin` exposes users, jobs, provider health, usage, and retry controls to owners only.
- `/api/health` reports database, configured providers, storage, and job-runner status.

## Data model additions

Add `users`, `sessions`, `invitations`, `password_reset_tokens`, `user_preferences`, `usage_counters`, `jobs`, `inspections`, `inspection_items`, `offers`, `listing_feedback`, and `notification_deliveries`. Existing tenant-owned tables retain `owner_id`; new foreign keys and indexes enforce ownership and lookup performance.

## Security requirements

- Store password/session/invite/reset hashes only; never persist raw credentials or tokens.
- Use constant-time comparisons for legacy static tokens and token hashes.
- Validate all request bodies with Zod and enforce upload MIME/size limits.
- Keep provider credentials server-side; reject arbitrary URL fetches except existing explicit allowlists.
- Use durable per-user usage ceilings for listing imports, evaluations, provider calls, and jobs.
- Return not-found for cross-tenant resources so ids cannot be used as an oracle.
- Add tests for cross-user reads, writes, role checks, expired tokens, rate/usage limits, and upload rejection.

## Verification

Each workstream adds focused Vitest coverage first. Final verification runs lint, typecheck, all unit/integration tests, production build, migration checks, and a documented browser acceptance sequence. External gates are reported with the exact missing evidence.
