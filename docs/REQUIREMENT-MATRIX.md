# Friend-Readiness Requirement Matrix

| Checklist area | Repository evidence | Remaining proof |
| --- | --- | --- |
| Core scoring, VIN, valuation, repairs, title, profiles | Domain modules, routes, tests | Live provider credentials where desired |
| Accounts and isolation | Users/sessions/invites/reset schema, async auth, owner-scoped repo | Deployed cross-user browser test |
| Facebook ingestion | Manual text, URL allowlist, CSV, screenshots | Friend usability acceptance |
| Recurring search | Jobs, idempotency, retry state, cron route | Hosted cron configuration |
| Alerts | In-app persistence, webhook, preference thresholds, email adapter | Email provider/domain configuration |
| Inspection and offers | Checklist, offer calculator, routes, UI | Field acceptance |
| Health and admin | Health provider matrix, failed-job/usage endpoint | Monitoring/Sentry project evidence |
| Storage | MIME/size validation, owner-scoped local/HTTP adapter | Durable production bucket and restore test |
| Security/cost | Zod boundaries, server-only secrets, usage model, tenant filters | Deployed penetration/secret scan review |
| Documentation | Quickstart, import, profiles, scores, valuations, title, inspections, FAQ | Friend acceptance feedback |
| Legal/license | Disclaimers and provider provenance language | Intentional MIT/private/commercial decision |
