# Release Gates

## Repository gate

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and migrations pass on a clean checkout.

## Production gate

Evidence required: hosted URL, HTTPS, managed database, safe migrations, object storage, cron invocation, provider credentials, backups, one restore test, monitoring, and no required always-on local computer.

## Multi-user gate

Evidence required: owner signup, friend invite/acceptance, session revocation, reset flow, role enforcement, account deletion, and cross-user browser isolation.

## Human gate

The friend completes `FRIEND-ACCEPTANCE.md` without developer intervention. This cannot be inferred from unit tests.
