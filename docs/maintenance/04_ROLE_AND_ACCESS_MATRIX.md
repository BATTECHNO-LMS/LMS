# 04 — Role and Access Matrix (ISS-001 characterization)

**Updated:** ISS-001 authorization characterization (behavior as implemented — not a redesign).

Legend: **A** = allowed · **F** = forbidden · **UI** = frontend visibility only · **BE** = backend enforcement · **Stub** = present but not enforced for allow/deny

---

## 1. Canonical roles (from repository)

Sources: `scripts/lib/baselineCatalog.js` `REQUIRED_ROLES`, `frontend/src/constants/roles.js`, Prisma `roles.scope`.

| Code | Seed scope | Portal (FE shell) | JWT `roles[]` | FE primary role | Global? | Uni-scoped typical | Academic | Field training |
|------|------------|-------------------|---------------|-----------------|---------|--------------------|----------|----------------|
| `super_admin` | `global` | `/admin` | yes | yes | **Yes** (`isGlobal`) | N/A (system-wide) | Yes | Admin / reports |
| `program_admin` | `university` | **None** (deprecated) | yes (historical) | historical display | **No** | N/A (inactive holders) | Historical only | No runtime |
| `university_admin` | `university` | `/admin` | yes | yes | No | Forced to JWT uni | Limited | FT admin (env) |
| `academic_admin` | `university` | `/admin` + `/academic` | yes | yes | No | Forced to JWT uni | Yes | FT admin + academic portal |
| `qa_officer` | `university` | `/admin` + `/academic` | yes | yes | No | Forced to JWT uni | QA oversight | Academic FT portal |
| `instructor` | `university` | `/instructor` | yes | yes | No | Cohort / assigned | Teaching writes | Assigned opportunities |
| `student` | `university` | `/student` | yes | yes | No | Primary uni / specialty | Submit / own rows | Apply / own apps |
| `university_reviewer` | `university` | `/reviewer` + `/academic` | yes | yes | No | Forced to JWT uni | Enrollment decide / recognition | Academic FT reports |

**No employer / training-provider role code** exists in seeds or FE constants.

Display names: Arabic/English labels live in i18n/seed data; codes above are the authorization identifiers.

---

## 2. Authorization mechanisms inventory

| Mechanism | Path | Function / component | Layer | Checks | Bypass | Deny |
|-----------|------|----------------------|-------|--------|--------|------|
| JWT verify + current identity | `backend/src/middlewares/auth.middleware.js` + `currentAuthContext.js` | `authenticate` | BE | Bearer JWT `userId` only → DB status/roles/uni/`isGlobal` | — | **401** `UNAUTHORIZED` / `TOKEN_INVALID` / `USER_NOT_FOUND`; **403** `ACCOUNT_INACTIVE` |
| Role allowlist | `backend/src/middlewares/authorization.middleware.js` | `authorizeRoles` | BE | Role intersection from **current** `req.user` | **`isGlobal`** (DB-derived) | **401** no user / **403** Forbidden |
| Legacy unused | `backend/src/middlewares/role.middleware.js` | `requireRoles` | BE | `req.user.role` singular | — | **Not wired** |
| JWT mint | `backend/src/utils/jwt.js` + `auth.service.js` | `signToken` / `buildTokenPayload` | BE | roles + isGlobal from SA | — | — |
| Load DB permissions | `auth.repository.js` | `loadRolesAndPermissions` | BE | Returns codes on login/`/me` | — | **Not used for route allow/deny** |
| Env role CSVs | `backend/src/config/env.js` | `*_ROLE_CODES` | BE | Route allowlists | Override via env | Misconfig → wrong A/F |
| Uni scope | `backend/src/utils/universityScope.js` | `isSystemWideAdmin`, `resolveUniversityIdFilter`, `assertUniversityRecordAccess` | BE | Current DB uni + SA | **`isGlobal` only** (PA deprecated Phase 3) | **403** |
| Delivery scope | `backend/src/utils/deliveryAccess.js` | cohort / assessment helpers | BE | Role + cohort ownership | isGlobal patterns | empty / deny |
| FT access | `backend/src/modules/fieldTraining/fieldTraining.access.js` | `isFieldTrainingAdmin`, `canManageFieldTraining`, … | BE | Role + assigned instructor + uni | system-wide | **403** FT codes |
| Ownership (services) | submissions / grades / certificates / enrollments / files | various | BE | `student_id` / owner | staff sets / isGlobal | **403** |
| FE role matrix | `frontend/src/utils/rolePermissions.js` | `hasUiPermission`, `getUiPermissions` | FE | Static UI keys | Admin = all true | Hide / Unauthorized page |
| FE DB overlay | same | `hasUiPermissionForUser` | FE | Optional exact UI key in `user.permissions` | `*`/`ui.all` → still role matrix | — |
| FE shell | `RoleShellPermissionOutlet` | uses `hasUiPermission` | FE | Role only | Admin shells skip map | Unauthorized |
| FE page gate | `PagePermissionGate` | `hasUiPermissionForUser` | FE | Role + optional DB codes | — | Unauthorized |
| FE action gate | `PermissionGate` | `hasUiPermission` | FE | Role only | — | Hide children |
| FE route role | `RoleBasedRoute` | role membership | FE | Portal role set | — | Redirect dashboard |
| FE admin nav | `adminNavigation.js` | role membership lists | FE | Role lists | — | Hide nav |
| FE tenant | `TenantContext` | isGlobal switcher | FE | UI simulation only | — | Not sent to API |

---

## 3. Sensitive operations matrix (current)

| Operation | FE visibility source | BE gate source | DB permission | Uni scope | Ownership | isGlobal | program_admin | Effective | Char. test |
|-----------|---------------------|----------------|---------------|-----------|-----------|----------|---------------|-----------|------------|
| User read | Admin nav roles | `ADMIN_READ` | Stub | Service | — | bypass roles | in ADMIN_READ + system-wide | BE role+scope | envRoles |
| User write | Admin nav (SA/PA) | `USER_WRITE` | Stub | — | — | bypass | in list | SA/PA | envRoles |
| User activate | Admin | `USER_ACTIVATE` | Stub | — | — | bypass | in list | SA/PA/UA/AA | envRoles |
| Curriculum write | Admin | `CURRICULUM_WRITE` | Stub | — | — | bypass | in list | SA/PA/AA | envRoles |
| Enrollment decide | Admin + reviewer nav | `ENROLLMENT_DECISION` | Stub | Uni typical | — | bypass | in list; **UA not default** | SA/PA/AA/REV | envRoles |
| Attendance write | Instructor/admin UI | `DELIVERY_WRITE` | Stub | Cohort | — | bypass | in list | Staff+INS | envRoles |
| Assessment create | Instructor/admin UI | `ACADEMIC_WRITE` | Stub | Cohort | — | bypass | in list | Staff+INS | envRoles |
| Submission write | Student submit form | `student` on `POST /assessments/:id/submissions` | SPA wired | Enrollment | Own; **duplicate create → 409** | bypass | **deprecated — no access** | **BE A / SPA A (ISS-002 + ACADEMIC-SUBMISSION-001)** | iss002 + academicSubmission001 |
| Grade write | Instructor grade form | `ACADEMIC_WRITE` on grade POST/PUT/finalize | SPA wired | Assessment write scope | Requires prior submission; **finalized → 409** | bypass | **deprecated — no access** | **BE A / SPA A (ISS-002 + ACADEMIC-GRADE-001)** | iss002 + academicGrade001 |
| Certificate write | Admin | `CERTIFICATE_WRITE` | Stub | Cohort staff | Student self-read | bypass | in list + cert “global reader” | SA/PA/UA/AA | envRoles |
| QA / risk / integrity | Admin nav (CRUD UI thin) | `QA_OVERSIGHT` / `RISK_INTEGRITY` | Stub | — | — | bypass | in lists | Roles as defaults | envRoles |
| Analytics overview | SA nav wrapper | Hardcoded `super_admin` | Stub | — | — | bypass | **F unless isGlobal** | SA (or global) | middleware |
| Settings | SA nav | Hardcoded `super_admin` | Stub | — | — | bypass | **F** | SA | envRoles |
| FT apply | Student shell | `STUDENT_ROLE_CODE` | Stub | Eligibility | Self | bypass | F for apply route | Student | FT + env |
| FT manage | Admin/instructor | FT admin/manage + instructor | Stub | Uni / assigned | Assigned INS | system-wide | Admin | FT char. |
| FT academic reports | `/academic` role gate | Hardcoded academic roles | Stub | Uni | — | system-wide | Not on academic portal roles | AA/REV/QA/UA | docs |
| Reports read | Mixed nav | `REPORT_READ` (+ PA on FT reports) | Stub | Uni filter | — | bypass | in list + FT extras | Staff+REV | envRoles |

---

## 4. Portal visibility vs API

| Portal | FE roles | FE extra | BE note |
|--------|----------|----------|---------|
| `/admin/*` | `ADMIN_ROLE_SET` | No `RoleShellPermissionOutlet`; nav by role lists | Many routes use different env CSVs — **nav ≠ API** |
| `/instructor/*` | `instructor` | Shell UI map | FT assigned ownership in service |
| `/student/*` | `student` | Shell + page gates | Write routes student-only |
| `/reviewer/*` | `university_reviewer` | Shell | Enrollment decision on API |
| `/academic/*` | AA, QA, REV | Shell mounted but **route map returns null** (no-op) | FT academic routes hardcoded |

---

## 5. isGlobal vs program_admin (critical)

| Capability | `isGlobal` (typically SA) | `program_admin` (deprecated Phase 3) |
|------------|---------------------------|--------------------------------------|
| Bypass `authorizeRoles` | **Yes** | **No** — stripped from allowlists |
| `isSystemWideAdmin` / cross-uni filters | **Yes** | **No** |
| FT admin / manage helpers | **Yes** | **No** |
| Analytics/settings hardcoded `super_admin` | **Yes** (bypass) | **No** |
| DB column for isGlobal | **None** — derived at login from SA role | N/A |
| Can assign `super_admin` via `USER_WRITE`? | Yes if `isGlobal` | **No** — not on `USER_WRITE`; IDENTITY-001 |

Full lifecycle: `docs/maintenance/08_PRIVILEGED_IDENTITY_LIFECYCLE.md`.  
**Note:** `program_admin` is deprecated. **Phase 1:** new assignments blocked. **Phase 2 (2026-07-16):** the two PA-only accounts set to `inactive` (role links preserved; batch `30b7dca3-7fd6-437c-b0e7-6bdf7479c347`). **Phase 3 (2026-07-16):** runtime AuthZ/nav/env grants removed; AUTHZ-002 **resolved**. Historical labels/filters retained. See `09_PROGRAM_ADMIN_DEPRECATION_PLAN.md`.

---

## 6. Characterization test map

| Suite | File | Covers |
|-------|------|--------|
| Auth + roles middleware | `backend/tests/authorization.middleware.characterization.test.js` | Token, current-state identity, isGlobal bypass, PA vs allowlist |
| Identity / JWT lifecycle | `backend/tests/authorization.identityLifecycle.characterization.test.js` | Claim minting, mass-assignment rejection, DB overrides stale JWT |
| Current auth context | `backend/tests/authorization.currentAuthContext.test.js` | IDENTITY-002/003 revalidation cases |
| PA assignment freeze | `backend/tests/authorization.programAdminFreeze.test.js` | Phase 1 deprecation guard |
| PA-only deactivation | `backend/tests/programAdminDeactivation.test.js` | Phase 2 maintenance script |
| University scope | `backend/tests/authorization.scope.characterization.test.js` | Cross-uni, PA, missing uni |
| Env default matrices | `backend/tests/authorization.envRoles.characterization.test.js` | Role × sensitive op defaults |
| Field training | `backend/tests/authorization.fieldTraining.characterization.test.js` | Admin / instructor / uni scope |
| Existing scope | `universityScope.test.js` | Baseline helpers |
| FE UI matrix | `frontend/tests/rolePermissions.characterization.test.js` | rolePermissions / path map |
| ISS-002 academic submit/grade | `authorization.iss002.academicSubmissions.characterization.test.js` + `authorization.iss002.academicDelivery.remediation.test.js` + FE `academicDelivery.iss002.test.js` | Validators, write routes, FE write clients, ownership/deadline source contracts, 401, FT separation |
| ACADEMIC-GRADE-001 finalized immutability | `authorization.academicGrade001.finalizedImmutability.test.js` | Guard 409, service reject without repo.update, idempotent finalize, FT unaffected |
| ACADEMIC-SUBMISSION-001 uniqueness | `authorization.academicSubmission001.uniqueness.test.js` | Existence guard, P2002 map, unique index, update same row, FT unaffected |
| Fixtures | `backend/tests/helpers/authzFixtures.js` | Synthetic users |

---

## 7. Current-state auth revalidation (IDENTITY-002 / IDENTITY-003)

| Topic | Behavior |
|-------|----------|
| Old | `authenticate` trusted JWT `roles`, `universityId`, `isGlobal` until expiry |
| New | After signature/expiry verify, load current user status, roles, primary university; derive `isGlobal` via `isGlobalFromRoleRecords`; set `req.user` from DB only |
| Informational JWT claims | `roles`, `universityId`, `isGlobal` may still be minted for FE/compat — **not authoritative** on protected APIs |
| Inactive / missing user | Fail closed (`ACCOUNT_INACTIVE` / `USER_NOT_FOUND`) before handlers |
| Query cost | ~3 Prisma reads per protected request (user row + `user_roles` + `roles`); no permissions load; no cache |
| Covered | All routers using `authenticate` / `authMiddleware` (versioned API + `/api/auth/me`) |
| Intentionally public | `/`, `/health`, `/health/ready`, `/api/auth` login/register/OTP/password flows, `/api/auth/logout` (no revoke), `/api/*/public/*`, certificate `GET .../verify/:code`, static `/uploads` |
| Not covered / backlog | Cryptographic logout revoke; password-change token invalidation; dead unused `role.middleware.js` (`req.user.role` singular) |
| `/me` | Still reloads full profile (duplicate identity load after middleware — acceptable) |

## 8. Coverage gaps (still)

- Full HTTP happy-path ownership for every service (needs isolated TEST DB).
- Exact production env CSV overrides (not recorded; defaults characterized).
- Employer roles (do not exist).
- Logout / password-change do not invalidate existing JWTs (active users retain access until expiry).

See also: `07_AUTHORIZATION_CONTRADICTIONS.md`.
