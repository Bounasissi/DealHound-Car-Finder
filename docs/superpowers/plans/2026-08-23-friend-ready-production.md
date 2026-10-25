# DealHound Friend-Ready Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and verify all friend-readiness requirements that are possible within the repository, with explicit evidence for external-only gates.

**Architecture:** Preserve the existing domain pipeline and add database-backed application services for identity, durable work, user workflows, uploads, notifications, and operations. Every tenant-owned repository method is scoped by the authenticated user id; provider failures become observable degraded states.

**Tech Stack:** Next.js App Router 15, React 19, TypeScript, Drizzle ORM, PostgreSQL, Zod, Vitest, Node `crypto`.

**Spec:** `docs/superpowers/specs/2026-08-23-friend-ready-production-design.md`

## Global Constraints

- Facebook remains user-assisted ingestion; no unauthorized scraping.
- Provider credentials and secrets remain server-only.
- Preserve existing uncommitted user changes and unrelated files.
- Do not claim hosted deployment, live credentials, restore testing, or friend acceptance without evidence.
- Protected migrations are append-only and must be run through the project migration runner.

### Task 1: Restore the provider/source baseline

**Files:**
- Modify: `src/sources/index.ts`
- Modify: `src/sources/marketcheck.ts`
- Test: `tests/sources.test.ts`

- [x] Fix the existing MarketCheck export/type wiring without removing the user's source tests.
- [x] Run `pnpm test tests/sources.test.ts` and `pnpm typecheck`; both must pass before proceeding.

### Task 2: Add database-backed identity and tenant lifecycle

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0005_friend_ready_identity.sql`
- Create: `src/lib/passwords.ts`
- Create: `src/lib/identity.ts`
- Modify: `src/lib/auth-token.ts`
- Modify: `src/lib/auth.ts`
- Create: `src/app/api/auth/signup/route.ts`
- Modify: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/invite/route.ts`
- Create: `src/app/api/auth/reset/route.ts`
- Create: `src/app/api/account/route.ts`
- Tests: `tests/identity.test.ts`, `tests/auth.test.ts`

- [x] Add users, sessions, invitations, reset tokens, and preferences with owner/user roles.
- [x] Hash passwords and opaque tokens with Node `scrypt`/SHA-256; make tokens single-use and expiry-bound.
- [x] Resolve sessions from the database before static-token compatibility.
- [x] Add signup, login, logout, invite, reset, and account-deletion route contracts.
- [x] Add cross-tenant and role tests before route implementation.

### Task 3: Add durable jobs, usage ceilings, and provider health

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0006_friend_ready_operations.sql`
- Create: `src/lib/jobs.ts`
- Create: `src/lib/usage.ts`
- Create: `src/app/api/cron/run/route.ts`
- Modify: `src/app/api/sources/sync/route.ts`
- Modify: `src/app/api/health/route.ts`
- Create: `src/app/api/admin/health/route.ts`
- Tests: `tests/jobs.test.ts`, `tests/usage.test.ts`, `tests/health.test.ts`

- [x] Implement claim/complete/fail/retry job state transitions with idempotency keys and lock expiry.
- [x] Persist daily per-user counters and reject configured ceilings with HTTP 429.
- [x] Protect cron with `CRON_SECRET` and expose provider/storage/job health without secrets.
- [x] Make source sync enqueueable and safe against duplicate jobs.

### Task 4: Implement alert preferences and delivery records

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0007_friend_ready_notifications.sql`
- Create: `src/lib/notification-preferences.ts`
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/evaluate.ts`
- Create: `src/app/api/preferences/route.ts`
- Tests: `tests/notifications.test.ts`

- [x] Add minimum score/margin, delivery mode, quiet hours, and digest preferences.
- [x] Preserve in-app alert persistence and record every delivery attempt.
- [x] Add an email adapter interface that is disabled unless explicitly configured.
- [x] Ensure provider delivery failure never changes the deal decision.

### Task 5: Add inspections, offers, missing information, and feedback

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0008_friend_ready_buying_workflow.sql`
- Create: `src/domain/missing-information.ts`
- Create: `src/domain/offers.ts`
- Create: `src/domain/inspections.ts`
- Create: `src/app/api/listings/[id]/inspection/route.ts`
- Create: `src/app/api/listings/[id]/offer/route.ts`
- Create: `src/app/api/listings/[id]/feedback/route.ts`
- Modify: `src/app/listings/[id]/page.tsx`
- Modify: `src/app/listings/[id]/actions.tsx`
- Tests: `tests/missing-information.test.ts`, `tests/offers.test.ts`, `tests/inspections.test.ts`

- [x] Add deterministic inspection checklist states and recalculate economics after inspection data.
- [x] Add asking/target/max-buy/worst-case offer calculations with auditable inputs.
- [x] Add missing VIN/title/trim/service-data next actions separate from deal score.
- [x] Add feedback capture tied to user, listing, evaluation, and timestamp.

### Task 6: Add uploads, documentation, and acceptance coverage

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/app/api/listings/[id]/photos/route.ts`
- Modify: `src/app/ingest/page.tsx`
- Create: `docs/QUICKSTART.md`
- Create: `docs/HOW-TO-IMPORT-FACEBOOK.md`
- Create: `docs/SEARCH-PROFILES.md`
- Create: `docs/DEAL-SCORES.md`
- Create: `docs/VALUATIONS.md`
- Create: `docs/TITLE-CHECKS.md`
- Create: `docs/INSPECTIONS.md`
- Create: `docs/FAQ.md`
- Create: `docs/FRIEND-ACCEPTANCE.md`
- Create: `tests/acceptance-contract.test.ts`

- [x] Validate MIME type, extension, byte size, and ownership for photo uploads.
- [x] Provide local storage for development and an explicit production storage contract.
- [x] Make the phone import path usable at 375px/390px without requiring a terminal.
- [x] Document all setup, limitations, degradation paths, and external release gates.

### Task 7: Final verification and audit

**Files:**
- Modify: `docs/PRODUCTION.md`
- Create: `docs/RELEASE-GATES.md`
- Create: `docs/REQUIREMENT-MATRIX.md`

- [x] Run migrations in a disposable local database.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] Confirm no secrets appear in tracked files and no cross-user route is unscoped.
- [x] Map every checklist item to repository evidence or an external/human-only gate.

The repository-complete work is verified. Hosted deployment, live licensed-provider credentials, production object storage, backup/restore evidence, monitoring provisioning, and friend acceptance remain explicitly external gates in `docs/RELEASE-GATES.md`.
