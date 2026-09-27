# DealHound Final DoD Review — 2026-09-21

## A. Executive Result

FINAL STATUS: FAIL

Production Ready: NO

Core E2E Workflow: PASS

Financial Logic: PASS

Title/VIN Logic: PASS

Data Source Architecture: PASS

Security: PASS

Testing: PASS

Deployment: PASS

The implemented product supports the requested use case: manually supplied or approved-feed vehicle listings can be normalized, filtered, evaluated against a KBB-style Good value, adjusted for repairs, and ranked for low purchase-price-to-value opportunities. The core path is verified locally and through the deployed authenticated app. The full release DoD is not met because production scheduling, restore, monitoring, licensed valuation/inventory-provider proof, and independent human acceptance remain incomplete.

## B. Critical Findings

### P1-001 — Production operational gates are not complete

- Severity: P1
- Title: Scheduled jobs, production restore, and monitoring are not evidenced.
- Evidence: Hosted `GET /api/health` returns `release.mode=manual-user-assisted`, `ready=false`, and missing `scheduled-jobs`, `backup-restore`, and `monitoring`.
- Expected: A production release has functioning scheduled ingestion/alert jobs, a provider-confirmed backup and restore path, and actionable monitoring/alert ownership.
- Actual: The hosted deployment is healthy and authenticated, but those operational capabilities are not configured or proven.
- Impact: Price-drop refresh, alert delivery, unattended inventory freshness, incident detection, and recovery cannot be claimed as production-ready.
- Root cause: Provider credentials, scheduler ownership, monitoring destination, and hosted restore evidence are not yet available in the current environment.
- Required remediation: Configure and verify scheduled jobs, provider-backed backups/restores, and monitoring with retained run evidence; configure licensed KBB/valuation and inventory sources where required.
- Verification required: Successful scheduled run, alert/job evidence, monitored health signal, restore rehearsal from the production backup mechanism, and current provider/source evidence.

### P1-002 — Independent release acceptance is incomplete

- Severity: P1
- Title: Two-account isolation and photo evidence readback lack independent human acceptance.
- Evidence: Owner-authenticated live acceptance verified listing intake, valuation, repairs, title-state rejection, filtering, and rejection workflow. A second-user/friend acceptance pass was not completed. Photo upload/readback was not executed because file selection requires an explicit action-time user confirmation.
- Expected: Independent authenticated acceptance confirms account isolation and the complete evidence-upload path.
- Actual: Repository isolation tests and unauthenticated authorization checks pass, but human acceptance evidence is missing.
- Impact: The release cannot claim complete multi-user privacy or end-to-end photo evidence behavior.
- Root cause: Human/account boundary and local-file selection are non-delegable acceptance steps.
- Required remediation: Run the two-account acceptance script and complete an authenticated private object-storage upload/readback with a non-sensitive test image.
- Verification required: Retained account A/account B evidence, private-object authorization evidence, and successful image readback in the intended listing context.

## C. Medium and Low Findings

### P2 — Photo evidence extraction is not fully automated

The hosted UI provides private photo evidence controls and a manual evidence path. Remote object-storage upload/readback is now covered by authorization-aware tests and always uses the authenticated application proxy, but OCR, VIN/title extraction confidence, and hosted live readback were not fully proven. Manual notes remain the source of truth unless independently verified.

### P2 — Provider outage, scheduler, and monitoring evidence is focused/local only

Graceful fallback behavior is covered by repository tests and manual-provider modes. Live provider outage handling and production scheduler/monitoring behavior remain unverified.

### P3 — Direct favicon ICO route remains absent

`/favicon.svg` is available and the metadata is configured, but direct `/favicon.ico` returns 404. This is cosmetic and does not block the core workflow.

## D. Requirement Coverage Matrix

| Requirement | Status | Evidence / gap |
|---|---|---|
| Listing intake | PASS | Manual paste/CSV and authenticated hosted intake verified. |
| VIN | PASS | Normalization and mismatch/missing-VIN tests pass; live VIN was displayed but not independently decoded during final acceptance. |
| Title | PASS | Conservative title states, hard rejection, and live `DOCUMENT_REVIEWED` rejection verified. |
| Valuation | PASS | Manual KBB Good value and comps normalization verified; licensed provider credentials remain absent. |
| Repair engine | PASS | Repair ranges, expected reserve, and recomputation verified locally and live. |
| Deal economics | PASS | Ask/value, all-in/value, margin, and scenarios verified. |
| Scoring | PASS | Scoring and gating tests pass. |
| Search/filter | PASS | Profile/filter behavior verified locally and in the hosted UI. |
| Alerts | CONDITIONAL | Data model and application paths exist; scheduled delivery and monitoring are not proven. |
| Seller workflow | PASS | Listing workflow and rejection path verified. |
| Outcome tracking | PASS | Repository coverage exists; independent production outcome acceptance remains limited. |
| Security | CONDITIONAL | Authenticated ownership checks, private evidence authorization, and unauthenticated 401 behavior pass; two-account human acceptance remains open. |
| Observability | FAIL | Hosted health is honest but explicitly reports monitoring as missing. |
| Deployment | PASS | Hosted Site version 12 deployed successfully; health returns 200. |

## E. Test Evidence

### Local repository

- Unit/integration: `pnpm test` — 33 files, 209 tests passed.
- Environment validation: production database/auth/storage invariants are tested and health returns explicit configuration issue codes.
- Background jobs: cron responses now include bounded run counts and duration; `cron.run.completed` and `job.failed` structured events are emitted. Live scheduler execution remains unverified.
- Type safety: `pnpm typecheck` passed.
- Lint: `pnpm lint` passed.
- Production build: `NEXT_DIST_DIR=.next-audit-final-20260921 pnpm build` passed.
- Recovery: PostgreSQL backup written to `/Volumes/S1-500GB/DealHound/restore-audit-20260921/`, checksum verified, restore into a separate database passed, and 13 migrations were present.

### Hosted source and deployment

- Latest hosted source commit: `80977edb1c93c48ef4f5a5047d1444a15b7a66d6`.
- Hosted Site version: 12.
- Deployment status: succeeded.
- Hosted health: HTTP 200 with database status `ok` and honest manual-release readiness reporting. The local health contract now requires explicit `CRON_SCHEDULE_VERIFIED_AT`, `BACKUP_RESTORE_VERIFIED_AT`, and `MONITORING_VERIFIED_AT` evidence markers instead of treating configuration presence as proof.
- Public smoke: `scripts/production-smoke.sh https://dealhound-car-finder.vincenzobounasissi.chatgpt.site` passed; health was `ok`, database was `ok`, missing gates were `scheduled-jobs,backup-restore,monitoring`, and the unauthenticated evidence endpoint returned 401. Authenticated listing access was not run because no smoke token was supplied.
- Authorization smoke: unauthenticated evidence endpoint returns HTTP 401.
- Hosted D1 binding: `DB`; hosted R2 binding: `UPLOADS`.

### Authenticated live acceptance

- Manual listing paste and normalization: PASS.
- Manual KBB Good value: PASS; `$9,500 / $15,000 = 63.33%`.
- Repair recomputation: PASS; expected repair `$600`, all-in/value `72.80%`, expected margin `$4,080`.
- Title-state rejection: PASS; `DOCUMENT_REVIEWED` was not treated as authoritative clean title.
- Search profile filtering: PASS.
- Listing rejection workflow: PASS.
- Photo upload/readback: NOT VERIFIED; explicit file-selection confirmation was not available.
- Current authenticated browser state: the owner session still loads the hosted inbox and exposes the prior QA listing's score, repair economics, title rejection, filters, and evidence controls. A second identity is still required for cross-account isolation acceptance.

## F. E2E Scenario Matrix

| Scenario | Status | Evidence |
|---|---|---|
| Ideal bargain | PASS | Scoring tests and live manual valuation path; clean-title qualification remains conservative. |
| Cheap / high repair | PASS | Pipeline/scoring tests and live repair recomputation. |
| Salvage bargain | PASS | Title and pipeline tests enforce rejection/gating. |
| Missing VIN | PASS | Normalization and validation tests. |
| VIN mismatch | PASS | VIN validation tests. |
| Provider outage | CONDITIONAL | Graceful/manual fallback tests pass; live outage is not deployed/proven. |
| Duplicate | PASS | Route and normalization tests; no fresh duplicate live run. |
| Price drop | CONDITIONAL | Source/tests cover the path; scheduled production execution is not proven. |
| Title conflict | PASS | Conservative title logic and tests. |
| Unknown repairs | PASS | Unknown-repair reserve behavior and live initial reserve path. |

## Remediation Tasks

### P1-001

- Priority: 1
- Severity: P1
- Effort: Large
- Task: Complete production operations and licensed-source readiness.
- Problem: Scheduled jobs, monitoring, production restore, and licensed valuation/inventory evidence are missing.
- Required implementation: Configure provider credentials and terms-compliant sources; configure scheduler ownership; configure monitoring and alerts; execute and retain backup/restore proof.
- Files/components affected: Hosted environment configuration, job runner, provider adapters, health/readiness reporting, operational runbook.
- Tests required: Scheduled-run smoke, provider outage, health/monitoring alert, backup/restore rehearsal, source freshness and terms review.
- Acceptance criteria: Hosted health reports release-ready only when all gates are evidenced; retained artifacts prove successful runs and recovery.
- Dependencies: Provider access, scheduler, monitoring destination, and explicit operational ownership.

### P1-002

- Priority: 1
- Severity: P1
- Effort: Medium
- Task: Complete independent human/account and photo-evidence acceptance.
- Problem: Two-account isolation and upload/readback are not independently accepted.
- Required implementation: Run the account-isolation script and complete a non-sensitive private upload/readback test.
- Files/components affected: Authenticated acceptance checklist, evidence upload UI/API, private storage policy.
- Tests required: Account A/B isolation, private-object authorization, upload/readback, invalid file handling.
- Acceptance criteria: Account B cannot view or mutate account A data; uploaded evidence can be read back only in the authorized listing context.
- Dependencies: Second authenticated account and explicit local test-file selection.

### P2-001

- Priority: 2
- Severity: P2
- Effort: Medium
- Task: Finish photo evidence extraction and confidence presentation.
- Problem: The current path is manual-first and live OCR/readback is not proven.
- Required implementation: Complete private upload, extraction, confidence, and human-review states while preserving manual source-of-truth behavior.
- Files/components affected: Evidence UI/API, object storage, OCR/extraction adapter, review state model.
- Tests required: Upload/readback, OCR confidence boundaries, authorization, provider failure fallback.
- Acceptance criteria: Evidence is private, attributable, reviewable, and never treated as authoritative without the required confidence/review state.

### P3-001

- Priority: 3
- Severity: P3
- Effort: Small
- Task: Add or intentionally document `/favicon.ico` behavior.
- Problem: Direct ICO request returns 404 while SVG metadata is valid.
- Required implementation: Add an ICO route or document SVG-only favicon behavior.
- Files/components affected: `app/layout.tsx`, public metadata/assets.
- Tests required: Metadata and direct favicon smoke checks.
- Acceptance criteria: Browser favicon requests are either served successfully or explicitly covered by the supported metadata contract.

## Final DoD Checklist

- [x] Core listing intake and normalization
- [x] Filterable search profile path
- [x] Manual/approved-source architecture without unauthorized scraping
- [x] Duplicate and canonical normalization logic
- [x] VIN handling and mismatch safeguards
- [x] Conservative clean-title gating
- [x] Manual KBB-style valuation and comps normalization
- [x] Repair ranges and expected reserve
- [x] Deal economics and scenario math
- [x] Ranking/scoring and hard gates
- [x] Detail, workflow, rejection, and outcome data paths
- [x] Authenticated ownership checks in application code
- [x] Provider/manual fallback behavior
- [x] Local unit/integration/type/lint/build verification
- [x] Local backup/restore rehearsal
- [x] Hosted deployment and health smoke
- [ ] Production scheduled jobs
- [ ] Production backup/restore evidence
- [ ] Production monitoring and alert ownership
- [ ] Licensed KBB/valuation and inventory-provider proof
- [ ] Live provider-outage and stale-data operational evidence
- [ ] Independent two-account human acceptance
- [ ] Authenticated photo upload/readback acceptance
- [ ] Final human release sign-off

FINAL VERDICT: FAIL

Release recommendation: REMEDIATE THEN RE-REVIEW

Blocking findings: 2

Priority-3 remediation tasks: 1

Priority-2 remediation tasks: 1

Verified E2E scenarios: Ideal bargain; Cheap / high repair; Salvage bargain; Missing VIN; VIN mismatch; Duplicate; Title conflict; Unknown repairs. Provider outage and Price drop are conditionally verified by focused tests but not by live production operations.
