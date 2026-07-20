# 02 — Verified Improvement Backlog

Issues verified against repository evidence in this phase. **No code patches applied.**

Severity: **P0** blocker / data-loss / auth hole in practice · **P1** high product/security gap · **P2** maintainability/ops · **P3** cleanup/debt

---

## ISS-001 — Dual authorization sources (DB permissions unused; env roles + UI matrix)

| Field | Content |
|-------|---------|
| Title | Authorization truth split across env role CSVs, UI `rolePermissions`, and empty DB `permissions` |
| Category | Security / AuthZ |
| Severity | **P1** (product alignment); characterization complete |
| Status | **Characterization addressed (ISS-001 phase)** — redesign **not** done |
| Observed | Seeds create roles only; DB permissions loaded on login but unused for BE allow/deny; API uses `authorizeRoles(...env.*_ROLE_CODES)`; UI uses static `rolePermissions.js`; `isGlobal` bypasses role lists; **PA deprecated (Phase 3 — not system-wide)** |
| Delivered this phase | Mechanism inventory; role matrix; pure BE + FE characterization tests; `07_AUTHORIZATION_CONTRADICTIONS.md` (AUTHZ-001…010); no behavior change |
| Evidence | `docs/maintenance/04_ROLE_AND_ACCESS_MATRIX.md`, `07_AUTHORIZATION_CONTRADICTIONS.md`; `authorization.*.characterization.test.js`; `frontend/tests/rolePermissions.characterization.test.js` |
| Confidence | Confirmed for middleware/scope/default env matrices/FE matrix |
| Remaining | PO decision on AUTHZ-005; **`program_admin` Phases 1–3 done** (`09_PROGRAM_ADMIN_DEPRECATION_PLAN.md`); logout / password-change token revoke still open |
| Smallest future fix | Logout / password-change token revoke — **IDENTITY-001/002/003 + PA Phases 1–3 done** |
| Changes business behavior? | Not in this phase |
| PO approval? | **Yes** before any redesign |

---

## AUTHZ-003 / IDENTITY — Privileged JWT & isGlobal lifecycle

| Field | Content |
|-------|---------|
| Title | Provenance of `isGlobal`, roles, university JWT claims; token invalidation |
| Category | Security / AuthZ |
| Severity | Direct `isGlobal` write: **not exploitable**; **IDENTITY-001/002/003 addressed** |
| Status | Lifecycle investigated; **IDENTITY-001** SA privilege boundary + **IDENTITY-002/003** current-state auth revalidation shipped |
| Evidence | `08_PRIVILEGED_IDENTITY_LIFECYCLE.md`; `currentAuthContext.js`; `auth.middleware.js`; identity001 + currentAuthContext tests |
| Key result | Only `requester.isGlobal` may assign/control `super_admin`; protected routes build `req.user` from current DB (roles, university, status, `isGlobal`) |
| `program_admin` | Deprecated — **Phases 1–4 done** (freeze + deactivation + runtime strip + soft-retire catalog); AUTHZ-002 **resolved** |
| PO approval? | Deprecation program complete |

---

## ISS-002 — Academic submissions/grades: API writes exist; SPA is read-only

| Field | Content |
|-------|---------|
| Title | Students/instructors cannot create/update academic submissions or grades via current SPA services |
| Category | Product gap / Incomplete feature |
| Severity | **P0** (if product expects LMS assessment delivery) / **P1** if FT-only grading is intentional |
| Status | **Resolved (2026-07-18)** — SPA wired to existing write APIs; see `13_ACADEMIC_SUBMISSION_AND_GRADING_IMPLEMENTATION.md` |
| Classification | Was **C** (Backend present; SPA missing) — **remediated**; **G** (FT separate) remains; quiz attempts remain unused (**D** partial, out of scope) |
| Observed | BE write APIs existed; FE was GET-only with decorative buttons |
| Expected | Student submit/edit + instructor grade/feedback/finalize in SPA |
| Evidence | Implementation `13_…IMPLEMENTATION.md`; FE `academicDelivery.iss002.test.js`; BE `authorization.iss002.academicDelivery.remediation.test.js` |
| Runtime | Unit suites + FE build / Prisma validate (see implementation report) |
| Confidence | Confirmed for minimum academic loop |
| Business impact | Academic assessment loop usable in UI; FT unchanged |
| Security / data | Same BE ownership/scope; SPA no longer implies dead actions |
| Files | FE academic pages/services; BE tests only |
| Required tests | Remediation + updated characterization |
| Smallest safe patch | Done — wire forms; do not invent new states |
| Rollback | Revert FE wiring + tests (no migration) |
| DB changes? | No |
| Changes business behavior? | Yes — SPA can write submissions/grades |
| PO approval? | Product decision documented in remediation brief |

---

## ACADEMIC-GRADE-001 — Finalized academic grades must be immutable on Backend

| Field | Content |
|-------|---------|
| Title | Ordinary grade update endpoints must not mutate finalized academic grades |
| Category | Lifecycle / Integrity |
| Severity | **P0** (authoritative Backend vs SPA-only lock) |
| Status | **Resolved (2026-07-18)** — see `14_FINALIZED_GRADE_IMMUTABILITY.md` |
| Observed | SPA read-only; `PUT /grades/:id` and create-overwrite still mutated `is_final` grades |
| Expected | 409 `GRADE_FINALIZED` on ordinary mutations; finalize idempotent; no role bypass |
| Evidence | `grades.lifecycle.js`; service/repository guards; `authorization.academicGrade001.finalizedImmutability.test.js` |
| DB changes? | No |
| Rollback | Revert BE guard + FE conflict refresh + tests/docs |

---

## ACADEMIC-SUBMISSION-001 — One academic submission per student per assessment

| Field | Content |
|-------|---------|
| Title | Concurrent/repeated POST must not create duplicate academic submissions |
| Category | Integrity / Concurrency |
| Severity | **P0** |
| Status | **Resolved (2026-07-18)** — see `15_ACADEMIC_SUBMISSION_UNIQUENESS.md` |
| Observed | POST always inserted; no unique constraint on assessment+student |
| Expected | App guard + unique index; 409 `ACADEMIC_SUBMISSION_EXISTS`; PUT updates same row |
| Evidence | Audit 0 duplicates; `uq_submissions_assessment_student`; lifecycle + FE conflict handling |
| DB changes? | Additive unique index only |
| Rollback | Drop unique index; revert service/FE/tests/docs |

---

## DB-MIGRATION-001 — Prisma migration history / P3005 baseline

| Field | Content |
|-------|---------|
| Title | Non-empty Neon DB lacked `_prisma_migrations`; `migrate deploy` failed with P3005 |
| Category | Ops / Schema governance |
| Severity | **P0** (blocks trustworthy deploy) |
| Status | **Resolved (2026-07-18)** — Strategy C; see `16_PRISMA_MIGRATION_BASELINE_AUDIT.md`, `17_PRISMA_MIGRATION_RECONCILIATION.md` |
| Observed | 48 tables live; history table absent; all 27 repo migrations pending; academic unique index applied via `db execute` |
| Done | Resolved 10 present early migrations; `migrate deploy` applied 17 missing additive migrations; status up to date; `prisma:check-history` guard |
| Data | Users 170 / FT opportunities 4 / submissions 0 unchanged; unique index preserved |
| Remaining risk | Empty-DB full bootstrap from incremental migrations alone — **addressed by DB-MIGRATION-002** |
| Forbidden | `migrate reset`, `db push`, casual history deletes, auto-resolve unknown |

---

## DB-MIGRATION-002 — Empty-database reproducibility

| Field | Content |
|-------|---------|
| Title | Migration directory cannot build a complete schema from empty PostgreSQL |
| Category | Ops / Disaster recovery / CI |
| Severity | **P0** (blocks CI/new envs/DR without shared Neon) |
| Status | **Resolved (2026-07-18)** — see `18_EMPTY_DATABASE_REPRODUCIBILITY.md`; hardened by **DB-MIGRATION-003** |
| Observed | First migration fails: missing enum `attendance_status`; 41 models never created by any migration SQL |
| Done | External baseline + guarded `db:init-empty`; CI empty-DB job; Neon untouched |
| Equivalence | Empty-built DB matches `schema.prisma` (empty migrate diff) |
| Forbidden | Running init against Neon; placing baseline inside `prisma/migrations/` without Neon plan |

---

## DB-MIGRATION-003 — Versioned cutoff-aware baseline manifest

| Field | Content |
|-------|---------|
| Title | Empty init must not mark future migrations applied without executing SQL |
| Category | Ops / Schema governance |
| Severity | **P0** |
| Status | **Resolved (2026-07-18)** — see `19_VERSIONED_EMPTY_DATABASE_BASELINE.md` |
| Observed | `db:init-empty` used `readdir` of all migration dirs → false resolve risk |
| Done | `empty_init_v1.manifest.json`; resolve only `orderedMigrations`; checksum fail-closed; regen gates; cutoff fixture CI |
| Cutoff | `20260718120000_academic_submission_uniqueness` (27 migrations) |
| Neon | Unchanged (read-only status/history verification only) |

---

## ISS-003 — Field-training status values never written

| Field | Content |
|-------|---------|
| Title | Enum values `task_pending`, `post_assessment_pending`, `failed` never assigned |
| Category | Domain / Workflow |
| Severity | **P2** |
| Observed | Writers set other statuses; those three only read/compared |
| Expected | requires product-owner confirmation (use, remove, or implement) |
| Evidence | `schema.prisma` enum; grep of assignments in FT services |
| Confidence | Confirmed |
| Business impact | Progress UI/eligibility may never show those states |
| Security / data | Low |
| Files | `fieldTraining.workflow.js`, `workflowService.js`, `fieldTraining.service.js` |
| Required tests | Transition table tests (extend workflow unit tests) |
| Smallest safe patch | Align UI labels with actually written statuses; defer enum cleanup |
| Rollback | Revert docs/UI |
| DB changes? | No (unless removing enum values later) |
| PO approval? | Yes for semantic change |

---

## ISS-004 — `analytics.trends.test.js` broken (missing repository function)

| Field | Content |
|-------|---------|
| Title | Test called `repo.computePreviousPeriodFilters` which was never a function |
| Category | Test debt / CI |
| Severity | **P2** (was) |
| Status | **Addressed in maintenance patch (ISS-004)** |
| Observed (before) | 2 failures: `repo.computePreviousPeriodFilters is not a function` |
| Root cause | Test added in `b398511` for a helper that **never existed** in production. Overview `kpiTrends` has been a stub `{ pct: 0 }` since introduction (`56f3d93`). Local `buildTrendMetrics` in the old test did not match the public `{ pct }` shape. |
| Resolution | Classification **C/D**: obsolete test of a non-exported aspirational API. Extracted pure `buildKpiTrendsStub` (same stub semantics, no API shape change). Rewrote DB-free tests for stub + `analyticsQuerySchema` date filters. Did **not** invent previous-period comparison. |
| Evidence | `analytics.kpiTrends.js`, `analytics.service.js` (uses stub), `tests/analytics.trends.test.js`, git: no production `computePreviousPeriodFilters` |
| Remaining risk | Product may later want real period-over-period trends; that is a separate feature change |
| Confidence | Confirmed |
| PO approval? | No (test/contract alignment only; no business semantic change) |

---

## ISS-005 — Phantom `endpoints.auth.refresh`

| Field | Content |
|-------|---------|
| Title | FE constant `/api/auth/refresh` with no BE route and no caller |
| Category | Dead code / Auth confusion |
| Severity | **P3** |
| Observed | `endpoints.js` defines refresh; `auth.routes.js` has no refresh; JWT is stateless 7d |
| Expected | Remove constant or implement refresh — PO if implementing |
| Evidence | `endpoints.js`, `auth.routes.js` |
| Confidence | Confirmed |
| Smallest safe patch | Delete unused constant (after confirming no dynamic string use) |
| DB changes? | No |
| PO approval? | No for delete constant |

---

## ISS-006 — Dead `role.middleware.requireRoles`

| Field | Content |
|-------|---------|
| Title | Legacy middleware expects `req.user.role` singular; unused |
| Category | Dead code |
| Severity | **P3** |
| Observed | Zero imports; live path uses `authorizeRoles` + `roles[]` |
| Evidence | `role.middleware.js` |
| Confidence | Confirmed |
| Smallest safe patch | Remove file after reference sweep |
| PO approval? | No |

---

## ISS-007 — `cohort_status_changed` never dispatched

| Field | Content |
|-------|---------|
| Title | Event handler stub with zero emitters |
| Category | Dead / incomplete events |
| Severity | **P3** |
| Observed | Switch case no-op; no `dispatchAppEvent('cohort_status_changed'` |
| Evidence | `eventDispatcher.service.js` |
| Confidence | Confirmed |
| Smallest safe patch | Remove case or wire from cohort status patch — PO if wiring notifications |
| PO approval? | Yes if adding notifications |

---

## ISS-008 — Duplicate enrollment request endpoints

| Field | Content |
|-------|---------|
| Title | `POST /enrollments/request` and `POST /student/enrollment-requests` both live; SPA uses student path only |
| Category | API duplication |
| Severity | **P2** |
| Observed | Same service underneath; dual public surfaces |
| Evidence | `enrollments.routes.js`, `student.routes.js`, `enrollments.service.js` (FE) |
| Confidence | Confirmed |
| Smallest safe patch | Deprecate one path in docs; add redirect or shared test; remove later |
| PO approval? | Soft yes before removal |

---

## ISS-009 — Overdue notifications without scheduled sweep

| Field | Content |
|-------|---------|
| Title | Overdue events fire only on write if already late |
| Category | Operations / Notifications |
| Severity | **P2** |
| Observed | No cron; dispatch on create/update when due date past |
| Evidence | `correctiveActions.service.js`, `assessments.service.js`, `eventDispatcher.service.js` |
| Expected | requires PO (accept write-triggered vs add scheduler) |
| Confidence | Confirmed |
| Smallest safe patch | Document ops behavior; optional later job **outside** app if needed |
| PO approval? | Yes for scheduler |

---

## ISS-010 — No error monitoring SaaS

| Field | Content |
|-------|---------|
| Title | No Sentry/Datadog/etc. in dependencies or source |
| Category | Observability |
| Severity | **P2** |
| Observed | Express `error.middleware` + logs only |
| Confidence | Confirmed absence in repo |
| Smallest safe patch | Add monitoring in a later ops PR — needs hosting PO |
| PO approval? | Yes |

---

## ISS-011 — CI `npm test` unsafe if secrets point at shared Neon

| Field | Content |
|-------|---------|
| Title | CI / local runs must not write via app `DATABASE_URL` |
| Category | Safety / CI |
| Severity | **P1** (was) |
| Status | **Addressed in maintenance patch (ISS-011)** |
| Observed (before) | `npm test` = all `tests/*.test.js` including DB writers; CI ran that command |
| Implemented | Fail-closed `testDatabaseGuard`; `test`/`test:unit` DB-free; `test:integration` requires `TEST_DATABASE_URL` + flags; CI split `backend-unit` / `backend-integration` (ephemeral Postgres) |
| Evidence | `backend/tests/helpers/testDatabaseGuard.js`, `requireIntegrationDb.js`, `backend/package.json` scripts, `.github/workflows/ci.yml` |
| Remaining risk | Local developers can still run integration files without npm script if they bypass first-line require (mitigated: files require guard first; helper throws without flag) |
| Confidence | Confirmed for code paths reviewed |
| PO approval? | Ops already implied by implementing ISS-011 |

---

## ISS-012 — Heavy sync PDF/Excel/AI/file extract on request thread

| Field | Content |
|-------|---------|
| Title | Puppeteer/ExcelJS/AI/content extract run in HTTP handlers |
| Category | Performance / Ops |
| Severity | **P2** |
| Observed | No queue; long requests possible |
| Evidence | analytics PDF, FT reports, AI routes |
| Smallest safe patch | Timeouts/limits first; queues later |
| PO approval? | For architecture change |

---

## Patch order

1. **ISS-011** — done (test DB / CI safety).
2. **ISS-004** — done (analytics trends test/contract alignment).
3. **ISS-001** — characterization done; **PO decisions** before any AuthZ redesign (see `07_AUTHORIZATION_CONTRADICTIONS.md`).
4. **IDENTITY-001** — done (`isGlobal`-only control of `super_admin` via user APIs).
5. **`program_admin` deprecation** — Phases 1–4 **done** (`09_PROGRAM_ADMIN_DEPRECATION_PLAN.md`). Unit count reconciliation: `10_TEST_SUITE_RECONCILIATION.md`. Compact active-role regression: `authorization.activeRoles.regression.test.js`.
6. **IDENTITY-002/003** — done (current-state auth revalidation on protected requests).
7. **ISS-002** — done (academic submit/grade SPA wired; `13_ACADEMIC_SUBMISSION_AND_GRADING_IMPLEMENTATION.md`).
8. **ACADEMIC-GRADE-001** — done (finalized grade Backend immutability; `14_FINALIZED_GRADE_IMMUTABILITY.md`).
9. **ACADEMIC-SUBMISSION-001** — done (submission uniqueness; `15_ACADEMIC_SUBMISSION_UNIQUENESS.md`).
10. **DB-MIGRATION-001** — done (Prisma history reconcile; `16_…BASELINE_AUDIT.md`, `17_…RECONCILIATION.md`).
11. **DB-MIGRATION-002** — done (empty-DB reproducibility; `18_EMPTY_DATABASE_REPRODUCIBILITY.md`).
12. **DB-MIGRATION-003** — done (versioned cutoff-aware baseline; `19_VERSIONED_EMPTY_DATABASE_BASELINE.md`).
13. **QA-001** — production-readiness audit pack (`20`–`29` under `docs/maintenance/`); verdict **Conditional Go**.
14. **QA-REL-001** — **Resolved** — release-candidate hygiene; intended work committed on `maintenance/test-safety-baseline` (see `30_RELEASE_CANDIDATE_HYGIENE.md`). Staging smoke still required before production tag.
15. **QA-STAGING-SMOKE-001** — **Blocked / NO-GO** — RC `1cfe2f4` verified locally; **no isolated staging URLs/credentials/deploy access**. Browser smoke not executed. See `31_STAGING_SMOKE_REPORT.md`–`35_STAGING_ENVIRONMENT_REVIEW.md`. Finding **QA-STG-001**.
16. **RELEASE-FINAL-001** — **NO-GO** for `v1.0.0` — PR #2 merged (`f48274f`); health/login/role API smoke largely pass; **JWT sync disproven**, FE live bundle ≠ `main` rebuild, Neon has extra migration not on `main`. See `47_FINAL_PRODUCTION_GO_DECISION.md`. QA-AUTH-001/003 accepted temporarily, not resolved.
17. **PROD-DRIFT-001** — **Stopped** — `20260719120000_field_training_required_hours` applied on Neon (`c43e180b…`) but **absent from all fetched Git refs**; checksum-matched reconstruction failed; no invented migration. FE confirmed older (`Last-Modified` 2026-07-15). See `48_PRODUCTION_MIGRATION_DRIFT_RECONCILIATION.md`.
18. **PROD-DRIFT-RECOVERY-002** — **Stopped** — exhaustive dangling-blob (471), Cursor History (8787), Desktop/OneDrive, shell history, and **1558** reconstruction candidates; **0** exact checksum matches. Option B (checksum rewrite) documented only, not executed.
19. **PROD-DRIFT-OPTION-B-001** — **Complete** — canonical LF migration + schema; owner accepted no-recovery path; production checksum updated (`c43e180b…` → `411b2fe3…`); **28/28** aligned. See `49`.