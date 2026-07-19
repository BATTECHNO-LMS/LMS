# 24 — Route and Navigation QA (QA-001)

**Source:** `frontend/src/app/router/index.jsx`, `lazyPages.js`, `adminNavigation.js`, role shells.

---

## Shell inventory

| Shell | Roles | Gate stack |
|-------|-------|------------|
| `/admin/*` | SA, UA, AA, QA | `ProtectedRoute` + `RoleBasedRoute(ADMIN_ROLE_SET)` + selective wrappers |
| `/instructor/*` | instructor | RoleBased + `RoleShellPermissionOutlet` |
| `/student/*` | student | RoleBased + outlet |
| `/academic/*` | AA, QA, reviewer | RoleBased + outlet (FT reports) |
| `/reviewer/*` | university_reviewer | RoleBased + outlet |
| Public auth | — | login/register/OTP/reset |
| Public verify | — | `/verify/certificate/:code` |

---

## Confirmed navigation findings

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| **QA-NAV-001** | P2 | QA / Risk / Integrity **create/edit** pages exported in `lazyPages` but **not mounted** in router | Prior CLN-001; lists may exist without deep CRUD |
| **QA-NAV-002** | P3 | Admin shell allows broad role entry; finer denial relies on **nav hide + API** | Student cannot use admin shell (role gate); AA may see nav items API rejects |
| **QA-NAV-003** | P2 | FT manage UI blocked for `academic_admin` while BE may allow | **QA-ROLE-001** |
| **QA-NAV-004** | P3 | Placeholder `*` routes absorb unknown paths | OK for soft 404; verify copy |

---

## Direct deep links (expected behavior)

| Link pattern | Expected |
|--------------|----------|
| `/student/assessments/:id/submit` | Auth + student + enrollment/assessment access |
| `/instructor/submissions/:id/grade` | Auth + instructor ownership/scope |
| `/admin/analytics` | **super_admin only** wrapper |
| `/admin/courses` | **super_admin only** |
| Unauthenticated deep link | Redirect login |
| Wrong role deep link | Unauthorized / redirect |

**Manual staging:** sample each pattern once per role.

---

## Decorative / incomplete UI

| Item | Status |
|------|--------|
| Pre-ISS-002 dead submit buttons | **Remediated** |
| Unmounted CRUD lazy pages | Incomplete feature — not deleted |

---

## Redirects noted

- Student `/enrollments` → `/student/programs`
- Reviewer FT paths → `/academic/field-training/reports`
- Admin `field-training-reports/*` → `/admin/field-training/reports`
