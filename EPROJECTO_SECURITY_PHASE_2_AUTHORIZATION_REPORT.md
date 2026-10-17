# EPROJECTO SECURITY PHASE 2 — Authorization Report

**Execution:** LOCAL / ISOLATED TEST ENVIRONMENT ONLY  
**Production security testing:** NO  
**Production modified:** NO  
**Production database used:** NO  
**Date:** 2026-10-17  

Suggested commit message (not created): `security: harden authorization and cross-tenant resource isolation`

---

## 1. Executive summary

| Metric | Value |
|--------|------:|
| Route files | 51 |
| Registered handlers (get/post/put/patch/delete) | ~611 |
| Modules with role + service-layer AuthZ | Majority |
| Confirmed P0 | 0 |
| Confirmed P0 remaining | 0 |
| Confirmed P1 found | 1 |
| Confirmed P1 remaining | 0 |
| Confirmed P2 found | 6 |
| Confirmed P2 remaining | 0 |
| Confirmed P3 found / remaining | 3 / 1–2 (documented) |
| Phase 2 unit + related AuthZ tests | 285 passed / 0 failed |
| Phase 2 hardening unit file | 20+ assertions PASS |
| Local authz smoke | 8/8 PASS |

**Verdict:** Confirmed cross-tenant write/read bypasses and empty-filter “global by accident” paths that were proven in this phase were fixed. Core identity helpers (`universityScope`, `organizationScope`, sessions, notifications, MFA reset, FT access modules) already fail closed for missing scope. Remaining work is coverage breadth, a few P3 aggregate leaks, and **completing Phase 1D** (JWT query auth still present in middleware).

---

## 2. Role inventory (canonical)

Source: `backend/src/utils/roleCanon.js`

| Code | Notes |
|------|--------|
| `super_admin` | Global only when `isGlobal` from DB role records |
| `admin` | University / institution |
| `instructor` | University (Field Training) |
| `trainer` | Institution |
| `trainee` | Institution |
| `student` | University |
| `reviewer` | University via `reviewer_university_assignments` |

Legacy aliases map into the above. **Missing `university_id` / `organization_id` never means global** — `resolveUniversityIdFilter` returns `undefined` for non-global actors; callers must deny-all or 403.

---

## 3. Tenant model

| Relationship | Authoritative source |
|--------------|----------------------|
| User → university | `users.primary_university_id`, `university_users` |
| User → organization | `user_organization_assignments` |
| Reviewer scope | `reviewer_university_assignments` (not primary university fallback) |
| `isGlobal` | DB role records containing `super_admin`, via `currentAuthContext` |
| FT instructor | Opportunity `assigned_instructor_id` |
| Institution trainer | `training_trainer_assignments` + `trainerScope` |

Runtime actor: `loadCurrentAuthContextFromDb` → `req.user` (JWT claims are not authoritative for roles/scope).

---

## 4. AuthZ architecture

- **Route layer:** `authenticate` + `authorizeRoles` / `requireOrganizationType` (almost all protected routers).
- **`requirePermission`:** defined but **not wired on routes** — capability codes are not the live gate.
- **Service layer:** `assertUniversityRecordAccess`, `assertOrganizationAccess`, FT `fieldTraining.access` / evaluation / report access, `assertUserAccessible`, super-admin privilege boundary, step-up for privileged mutations.
- **Fail-closed rule:** uncertain scope → deny / empty result (`denyAllWhere`), never open `where = {}`.

---

## 5. Findings fixed this phase

### P1 — Authenticated static `/uploads` without object ACL

| | |
|--|--|
| **Route** | `GET /uploads/**` via `express.static` after `authenticate` only |
| **Attack** | Any logged-in user fetches `/uploads/field-training/{taskId}/{uuid}` if path known |
| **Root cause** | Authn ≠ object authorization |
| **Fix** | Block entire `/uploads/field-training` with 404 before static (`app.js`). Completion letters / private / report-export prefixes already blocked. FT downloads remain on authorized `download-url` APIs. |
| **Tests** | Unit (source order) + smoke HTTP 404 with student Bearer |

### P2 — Help article bulk reorder without per-item tenant check

| | |
|--|--|
| **Route** | Admin help articles reorder |
| **Attack** | Uni A admin reorders Uni B article IDs |
| **Fix** | Load all IDs, `assertAdminCanAccessTargets` per row before update; 404 if any missing |
| **Also** | Empty `target_university_ids` now **denied** for non-global (platform-wide content) |

### P2 — Popup mutation: `system_key` / empty targets allowed uni admins

| | |
|--|--|
| **Fix** | `assertAdminCanAccessPopup` denies `system_key` and empty targets for non-global |

### P2 — Bulk activate inactive students empty university filter

| | |
|--|--|
| **Route** | Activate-all pending students |
| **Attack** | Non-global without resolvable university → `findInactiveStudents` with no uni → all inactive students listed/attempted |
| **Fix** | 403 if `!isSystemWideAdmin && !scopedUniversityId`; client `user_ids` always intersected with university scope via repository |

### P2 — Bulk email verify with raw `user_ids` (enumeration / cross-scope candidates)

| | |
|--|--|
| **Fix** | Always build list `where` with university scope, then intersect `user_ids` |

### P2 — Command Center published course / micro-credential counts unscoped

| | |
|--|--|
| **Fix** | Count only courses/credentials with enrollments/cohorts inside actor scope (`commandCenter.courses.js`) |

### P2 — Field Training analytics empty scope → platform metrics

| | |
|--|--|
| **Fix** | Non-global without university → `ApiError(403)` (`analytics.controller.js`) |

### P3 — Evaluation template upload mass-assignment footgun

| | |
|--|--|
| **Fix** | Controller uses `req.validated.body` only (no `...req.body` override) |

### P3 — Course lesson update body spread

| | |
|--|--|
| **Fix** | Explicit field allowlist in `courses.service.updateLesson` (Zod already stripped unknowns) |

---

## 6. Query-token / Phase 1D note

`auth.middleware.js` still allows `?access_token=` / `?token=` on:

- `/uploads/*`
- Command Center SSE live path

This is **Phase 1D unfinished**, not introduced by Phase 2. Phase 2 blocked the highest-risk FT static tree; remaining JWT-in-URL consumers must be migrated in Phase 1D (or a dedicated follow-up) before production cutover.

---

## 7. Route classification (by module)

Coverage legend: **PASS** (sampled/proven), **FIXED** (changed this phase), **REVIEW** (needs more automated matrix), **N/A** (public by design).

| Module area | Roles / scope pattern | Object check | Result |
|-------------|----------------------|--------------|--------|
| Auth / sessions / MFA | Self + admin hierarchy | Session owner / MFA scope | PASS |
| Users CRUD / activate / verify | Admin + university | `assertUserAccessible` | FIXED (+ PASS) |
| Students | University portal | Scope helpers | PASS (sampled) |
| Notifications | Self | `findByIdForUser` | PASS |
| Account deletion | Self / super_admin | Owner | PASS |
| Files API | Owner / isGlobal | `canAccessFile` | PASS (API); static FIXED for FT |
| Static `/uploads` | Authenticated | **Was none** for FT | FIXED |
| Help CMS | Content admin + uni targets | Target assert | FIXED |
| Popups | Content admin + uni targets | Popup assert | FIXED |
| Announcements | Content admin | Specialty edge REVIEW (P3) | REVIEW |
| Analytics / Command Center | Scope resolvers | Filter ∩ tenant | FIXED counts + FT analytics |
| Reports / Excel / PDF | Scope filters | University/org | PASS (sampled) |
| Field Training admin/instructor/student | FT access modules | Opportunity/application | PASS (existing suite) |
| FT evaluation / bulk ZIP | Eval access + filter | Uni + assignment | PASS / REVIEW bulk oracle |
| Academic delivery / grades / submissions | Cohort scope | `canAccessCohort` | PASS (existing suite) |
| Training programs (institution) | Org assert | `assertOrganizationAccess` | PASS (sampled) |
| Certificates / completion letters | Role + ownership | Service asserts | PASS (sampled) |
| Audit / activity logs | RBAC + tenant | Scoped | PASS |
| Public / specialties list | None | Intentional | N/A |
| Admin courses (super_admin) | Super admin only | Role gate | PASS |

**Untested exhaustively:** many of the ~611 handlers lack a dedicated IDOR matrix row; high-risk families above were audited. Remaining = REVIEW backlog for Phase 2.1 / continuous AuthZ tests.

---

## 8. IDOR matrix (representative)

| Resource | Attack | Expected | Before | After |
|----------|--------|----------|--------|-------|
| FT upload file path | Auth user GET `/uploads/field-training/...` | 404 / authorized API only | 200 static if file exists | **404 blocked** |
| Help article reorder | Uni A → Uni B ids | 403/404 | Updated | **Per-id assert** |
| Platform popup | Uni admin mutate `system_key` | 403 | Allowed | **403** |
| Inactive students bulk | Admin missing uni | 403 / empty | Listed all | **403** |
| Bulk email verify | Mixed tenant `user_ids` | Only in-scope | Loaded all then 403 | **Query-scoped** |
| Users get by id | Student → other user | 403/404 | 403 | 403 (smoke) |
| Session end | User A → User B session | 403/404 | Owner check | PASS (prior) |
| Notification | User A → User B id | 403/404 | Owner check | PASS (prior) |
| MFA admin reset | Cross-tenant / hierarchy | 403 + event | Prior 1C | PASS (prior) |
| CC publishedCourses | Uni admin | Scoped count | Global count | **Scoped** |
| FT analytics | Admin without uni | 403 | Global metrics | **403** |

---

## 9. Cross-tenant matrix (representative)

| Actor | Target | Resource | Result |
|-------|--------|----------|--------|
| Admin Uni A | Uni B | Help reorder / popup | BLOCKED |
| Admin Uni A | Uni B | `university_id` query filter | BLOCKED (`resolveUniversityIdFilter`) |
| Admin missing uni | Global data | Activate-all / FT analytics | BLOCKED |
| Student A | User B | `GET /users/:id` | BLOCKED (403 + `AUTHORIZATION_DENIED`) |
| Instructor Course A | Course B | FT / academic suites | BLOCKED (existing tests) |
| Reviewer Uni A | Uni B | Reviewer assignment SoT | BLOCKED (existing tests) |
| Org Admin A | Org B | Training programs | BLOCKED (`assertOrganizationAccess`) |

---

## 10. Privilege escalation matrix

| Actor | Attempt | Result |
|-------|---------|--------|
| Admin | Assign `super_admin` / manage global SA | BLOCKED (`superAdminPrivilegeBoundary`) |
| Non-global | Act as global via missing scope | **NO** (fail closed) |
| Student | Admin users routes | BLOCKED (role middleware) |
| Profile self | Set role / isGlobal via body | Allowlisted updates; roles via admin path only |
| Admin | Privileged role/status change without step-up | BLOCKED (Phase 1C step-up) |

---

## 11. Mass assignment report

| Handler | Pattern | Status |
|---------|---------|--------|
| `users` update | Explicit fields + role guards | PASS |
| `courses.updateLesson` | Was `{...body}`; now allowlist | FIXED |
| `fieldTrainingEvaluation.uploadTemplate` | Was validated⊕raw body; now validated only | FIXED |
| MFA / sessions | No raw body into secrets | PASS |
| Popups sanitize | Field allowlist helper | PASS |

---

## 12. Bulk authorization report

| Endpoint family | Child AuthZ | Mixed-scope behavior |
|-----------------|-------------|----------------------|
| Activate pending students | Per-user `activateUser` + uni query | Out-of-scope IDs excluded at query |
| Bulk email verify | Per-user verify + uni query | Out-of-scope never loaded |
| Help reorder | Per-article target assert | Any foreign id → deny whole txn |
| FT eval ZIP | Load then `filterEvaluationsForZip` | REVIEW: prefer deny if any unauthorized id (defense in depth) |
| Training bulk finalize | Org + program constrained | PASS (sampled) |

---

## 13. Security events

Denied student→user access emitted:

```text
AUTHORIZATION_DENIED / ROLE_NOT_ALLOWED
```

with `requestId`. Helpers use `crossScopeForbidden` where applicable. No passwords/JWTs/tickets in event metadata from these paths.

---

## 14. Tests

| Suite | Result |
|-------|--------|
| `authorization.phase2.hardening.unit.test.js` | PASS |
| Broader AuthZ / scope / FT / security events (285) | PASS |
| Local smoke `smoke-security-2-authz.js` (temp, outside repo) | 8/8 PASS |
| Database migration | **NONE** |

Frontend: no AuthZ-gate changes required for these backend fixes; frontend unit suite not re-run as a Phase 2 gate (backend authority).

---

## 15. Remaining risks / REVIEW backlog

1. **Phase 1D incomplete** — JWT query tokens still accepted on `/uploads` and SSE (P0 architecture for Phase 1D).
2. **Help admin analytics** — still largely unscoped aggregates (P3).
3. **Announcement SPECIALTY** — `university_id || undefined` edge for atypical admin without uni (P3).
4. **`/uploads/lesson-training`** — still behind auth-only static; confirm whether private and block or ACL if needed.
5. **Bulk ZIP filter-after-fetch** — soft oracle; harden to reject unauthorized IDs upfront.
6. **Route matrix completeness** — not every one of ~611 handlers has an automated IDOR case; expand matrix by module.

---

## 16. Production rollout (when authorized — NOT this phase)

1. Ship backend AuthZ fixes with compatible frontend (no frontend dependency for these patches).
2. Coordinate with Phase 1D JWT-URL removal (requires simultaneous FE/BE).
3. No Prisma migration for Phase 2 fixes.
4. Smoke: cross-uni admin, student IDOR, `/uploads/field-training` 404, activate-all, command center counts.

**Rollback:** revert listed file changes; no schema to roll back.

---

## 17. Files changed

- `backend/src/app.js`
- `backend/src/modules/help/help.service.js`
- `backend/src/modules/popups/popups.service.js`
- `backend/src/modules/users/users.service.js`
- `backend/src/modules/users/users.repository.js`
- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.controller.js`
- `backend/src/modules/courses/courses.service.js`
- `backend/src/modules/analytics/commandCenter.courses.js`
- `backend/src/modules/analytics/analytics.controller.js`
- `backend/tests/authorization.phase2.hardening.unit.test.js` (new)

---

## 18. Acceptance mapping

| Criterion | Status |
|-----------|--------|
| No confirmed P0 remaining | YES |
| No confirmed cross-tenant bypass remaining (this audit’s findings) | YES |
| Student cannot access other students’ private user records (API sampled) | YES |
| Missing scope ≠ global | YES |
| Mass assignment hardened on flagged handlers | YES |
| Bulk activate/verify scoped | YES |
| Sensitive FT static downloads blocked | YES |
| Security events on denial | YES |
| Legitimate AuthZ suites still pass | YES |
| No production testing/deployment | YES |
| Full route automated coverage | PARTIAL (REVIEW backlog) |
| Phase 1D JWT URL removal | NOT DONE (out of Phase 2 code fixes; noted) |
