# 04 — Role and Access Matrix

Defaults from `backend/src/config/env.js` (overridable by env CSVs — **values not recorded**).

Roles: SA=`super_admin`, PA=`program_admin`, UA=`university_admin`, AA=`academic_admin`, QA=`qa_officer`, INS=`instructor`, STU=`student`, REV=`university_reviewer`.

**Bypass:** `req.user.isGlobal` (SA) skips `authorizeRoles` lists.  
**University scope:** `isSystemWideAdmin` = `isGlobal` **or** PA → all universities; others forced to JWT `universityId`.

**FE:** `/admin` → `RoleBasedRoute(ADMIN_ROLE_SET)` without `RoleShellPermissionOutlet`. Instructor/student/reviewer/academic use UI permission outlet. `PermissionGate` = visibility only.

Legend: A=allowed · F=forbidden · U=unclear · UI=UI only (not server)

---

## Sensitive operations

| Operation | FE route / visibility | FE guard | BE auth | BE roles (default) | Scope / ownership | Expected | Tests |
|-----------|----------------------|----------|---------|--------------------|--------------------|----------|-------|
| User list/read | `/admin/users` (SA,PA,UA nav) | Admin shell | JWT | `ADMIN_READ` | Scope in service | A for ADMIN_READ | No dedicated |
| User create/update/status/reset pw | `/admin/users/*` | Admin shell + nav | JWT | `USER_WRITE` (SA,PA) | — | A SA/PA; F others | No |
| Activate user / bulk | Users UI | Admin | JWT | `USER_ACTIVATE` (+UA,AA) | — | A listed | No |
| Curriculum write (tracks/MC) | `/admin/tracks` etc. | Admin | JWT | `CURRICULUM_WRITE` | — | A SA/PA/AA | No |
| Enrollment approve/reject | `/admin/enrollments`, `/reviewer/enrollment-requests` | Role shells | JWT | `ENROLLMENT_DECISION` (SA,PA,AA,REV) | Uni scope typical | A decision roles | No |
| Attendance write | Admin/instructor session attendance | Role | JWT | `DELIVERY_WRITE` | Cohort access helpers | A delivery writers | Partial FT only |
| Assessment create | Admin/instructor assessments | Role | JWT | `ACADEMIC_WRITE` | Cohort access | A | No |
| Submission **create/update** | Student pages show lists | Student shell | JWT | `student` on write routes | Own submission | **API A / SPA missing** | 401 only (`submissions.auth`) |
| Grade **create/update/finalize** | Instructor/admin grades pages | Role | JWT | `ACADEMIC_WRITE` | — | **API A / SPA missing** | No write tests |
| Certificate issue/status | `/admin/certificates` | Admin | JWT | `CERTIFICATE_WRITE` | — | A write roles | No |
| Certificate verify (public) | `/verify/certificate/:code` | None | None | Public GET | — | A public | No |
| QA / corrective / risk / integrity write | Admin list pages (CRUD pages often unmounted) | Admin | JWT | `QA_OVERSIGHT` / `RISK_INTEGRITY` | — | A listed; UI incomplete | No |
| FT apply | `/student/field-training` | Student | JWT | `student` | Eligibility rules | A | Integration skipped |
| FT manage (tasks/attendance/…) | Admin/instructor FT | Role + assigned instructor checks | JWT | FT admin / instructor sets | Ownership on instructor | A | Unit + 401; integration skipped |
| FT reports | Admin/academic/reviewer links | Mixed | JWT | `REPORT_READ` (+ variants) | Uni filters | A | Skipped integration |
| Analytics | `/admin/analytics` (SA nav) | SuperAdmin wrapper | JWT | mostly SA | — | A SA | 401 export only |
| Settings | `/admin/settings` | SA nav | JWT | `super_admin` | — | A SA | No |

---

## Portal route visibility (high level)

| Portal | Roles | Primary guard |
|--------|-------|---------------|
| `/admin/*` | ADMIN_ROLE_SET | `ProtectedRoute` + `RoleBasedRoute` |
| `/instructor/*` | INS | + `RoleShellPermissionOutlet` |
| `/student/*` | STU | + permission outlet |
| `/reviewer/*` | REV | + permission outlet |
| `/academic/*` | AA, QA, REV | + permission outlet |
| Auth pages | Public | `AuthLayout` |

---

## Authorization source comparison

| Concern | Backend | Frontend | Match? |
|---------|---------|----------|--------|
| Can call API | JWT + `authorizeRoles` + sometimes ownership | N/A | Server is truth |
| Can see nav item | — | role lists + `PermissionGate` | May diverge |
| DB `permissions` codes | Loaded on login; rarely enforced on routes | Optional overlay if codes match UI keys | Usually empty if unseeded |
| Cross-university | PA + SA via `universityScope` | Tenant UI helper | PA not `isGlobal` in JWT |

---

## Coverage gaps (tests)

| Area | Existing |
|------|----------|
| Auth 401 on some routes | `submissions.auth`, `fieldTraining.auth`, health CORS |
| University scope helpers | `universityScope.test.js` (pass) |
| Full role×operation matrix | **Missing** |
| Submission/grade happy path | **Missing** (and SPA writes missing) |
| FT full workflow | Integration exists — **not run** on Neon |

---

## Unclear items needing PO / deeper runtime

1. Whether empty DB permissions is intentional.
2. Whether academic assessment writes are deferred on purpose.
3. Exact production CORS_ORIGINS beyond hard-coded hosts in `app.js`.
4. Whether REV should appear in enrollment decision in all deployments (default env includes REV).
