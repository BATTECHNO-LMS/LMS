# 02 — Verified Improvement Backlog

Issues verified against repository evidence in this phase. **No code patches applied.**

Severity: **P0** blocker / data-loss / auth hole in practice · **P1** high product/security gap · **P2** maintainability/ops · **P3** cleanup/debt

---

## ISS-001 — Dual authorization sources (DB permissions unused; env roles + UI matrix)

| Field | Content |
|-------|---------|
| Title | Authorization truth split across env role CSVs, UI `rolePermissions`, and empty DB `permissions` |
| Category | Security / AuthZ |
| Severity | **P1** |
| Observed | Seeds create roles only; `loadRolesAndPermissions` may return empty `permissionCodes`; API uses `authorizeRoles(...env.*_ROLE_CODES)`; UI uses static `rolePermissions.js`; `isGlobal` bypasses role lists |
| Expected | requires product-owner confirmation (single source of truth) |
| Evidence | `realBaseline.js` / `baselineCatalog.js`; `authorization.middleware.js`; `env.js`; `rolePermissions.js`; schema `permissions` |
| Runtime | Not exercised against live auth matrix this phase |
| Confidence | Confirmed |
| Business impact | Staff may see UI actions that API rejects (or reverse if UI under-grants) |
| Security / data | Misconfiguration risk; `program_admin` system-wide in `universityScope` but not `isGlobal` |
| Files | `env.js`, `authorization.middleware.js`, `universityScope.js`, `rolePermissions.js`, seed libs |
| Required tests | Role×endpoint matrix tests on isolated DB |
| Smallest safe patch | Document + align one high-risk route’s FE gate with BE; or seed permissions if product chooses DB RBAC — **needs PO** |
| Rollback | Revert config/seed only |
| DB changes? | Maybe (if seeding permissions) |
| Changes business behavior? | Possibly |
| PO approval? | **Yes** |

---

## ISS-002 — Academic submissions/grades: API writes exist; SPA is read-only

| Field | Content |
|-------|---------|
| Title | Students/instructors cannot create/update academic submissions or grades via current SPA services |
| Category | Product gap / Incomplete feature |
| Severity | **P0** (if product expects LMS assessment delivery) / **P1** if FT-only grading is intentional |
| Observed | BE: `POST /assessments/:id/submissions`, `PUT /submissions/:id`, `POST /assessments/:id/grades`, `PUT/PATCH grades`. FE `submissions.service.js` / `grades.service.js`: GET only. No page `apiClient.post/put/patch` to those paths. |
| Expected | requires product-owner confirmation |
| Evidence | `assessments.routes.js`, `submissions.routes.js`, `grades.routes.js`; FE services; repo-wide search |
| Runtime | Build succeeds; no E2E write attempt (would need auth + DB) |
| Confidence | Confirmed for SPA gap |
| Business impact | Core academic assessment loop incomplete in UI |
| Security / data | Write APIs remain callable by clients with JWT — surface still exists |
| Files | FE services/pages; BE submissions/grades modules |
| Required tests | FE contract tests; BE already partially covered for 401 only |
| Smallest safe patch | Either wire minimal student submit + instructor grade forms to existing APIs, **or** document product as read-only and hide misleading UI — **needs PO** |
| Rollback | Feature-flag or revert FE PR |
| DB changes? | No |
| Changes business behavior? | Yes if enabling writes |
| PO approval? | **Yes** |

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
| Title | Test calls `repo.computePreviousPeriodFilters` which is not a function |
| Category | Test debt / CI |
| Severity | **P2** (P1 if CI must be green — CI runs full `npm test`) |
| Observed | Safe suite: 2 failures, deterministic |
| Expected | Test matches exported API or helper restored |
| Evidence | `tests/analytics.trends.test.js`; failure log this phase |
| Runtime | Exit code 1 on selective run |
| Confidence | Confirmed |
| Business impact | CI noise; may hide other failures |
| Files | `analytics.trends.test.js`, `analytics.repository.js` |
| Required tests | Fix makes this test meaningful |
| Smallest safe patch | Restore export **or** rewrite test to use real helper — no product behavior change |
| Rollback | Revert test/helper |
| DB changes? | No |
| Changes business behavior? | No |
| PO approval? | No |

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
| Title | CI runs full test suite including DB writers |
| Category | Safety / CI |
| Severity | **P1** for shared DB misuse; **P2** if CI DB is ephemeral |
| Observed | Workflow runs `npm test` without skip filters |
| Expected | Isolated test DB or split unit/integration jobs |
| Evidence | `.github/workflows/ci.yml`; integration + landingStats tests |
| Confidence | Confirmed for workflow; Unknown for CI secret target |
| Smallest safe patch | Split jobs: unit always; integration only with `DATABASE_URL` test + migrate |
| PO approval? | Ops yes |

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

## Recommended first code patch (do **not** implement yet)

**Preferred:** **ISS-004** — fix `analytics.trends` test/helper mismatch.

- Smallest, no DB, no business behavior change, unblocks CI signal.
- Then product decision on **ISS-002** before any FE write wiring.

Alternative first patch if PO prioritizes product: thin FE submit path for `POST /assessments/:id/submissions` only — larger and needs PO.
