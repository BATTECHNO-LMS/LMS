# 07 — Authorization Contradictions (ISS-001)

Characterization only. **No fixes implemented in this phase.**

Severity:

- **P0** — confirmed unauthorized sensitive access or destructive cross-tenant action
- **P1** — confirmed authorization bypass, cross-university privilege inconsistency, or privileged-operation mismatch
- **P2** — UI/backend mismatch without confirmed unauthorized backend access
- **P3** — duplication, unclear design, maintainability

---

## AUTHZ-001 — Triple permission sources without single authority

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-001 |
| Operation | System-wide authorization model |
| FE | Static `rolePermissions` + admin nav role lists |
| BE | Env `*_ROLE_CODES` + `authorizeRoles` |
| DB | `permissions` loaded on login/`/me`; **not** used for route allow/deny |
| isGlobal | Bypasses BE role lists |
| University scope | Separate (`universityScope`) |
| Ownership | Service-layer |
| Security impact | Misconfiguration / drift risk |
| Business impact | Hard to reason about who can do what |
| Confidence | **Confirmed** |
| Test | envRoles + FE rolePermissions characterization |
| Severity | **P3** (design); elevates when combined with AUTHZ-002/003 |
| PO decision | Which source is authoritative for future RBAC? |
| Suggested future fix | Single policy module; keep DB or env, not both + FE matrix |

---

## AUTHZ-002 — `program_admin` is system-wide for data scope but not `isGlobal`

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-002 |
| Status | **Resolved (Phase 3, 2026-07-16)** |
| Operation | Cross-university list/filter / record access |
| FE (was) | `program_admin` in `ADMIN_ROLE_SET` |
| FE (now) | Excluded from active admin sets/nav; DENY_ALL / fail-closed; historical labels/filter only |
| BE (was) | `isSystemWideAdmin` = `isGlobal` **OR** `program_admin` |
| BE (now) | `isSystemWideAdmin` = **`isGlobal` only**; env + `authorizeRoles` strip deprecated PA |
| DB | Role row + historical `user_roles` **preserved**; seed scope label may still say `university` (historical) |
| Effective | PA grants **no** runtime AuthZ; env cannot restore it |
| Confidence | **Confirmed** (Phase 3 unit tests) |
| Test | `authorization.programAdminPhase3.test.js` + updated scope/env/FT characterization |
| Severity | Was **P1**; **closed** after Phase 3 |
| Resolution | Deprecation Phases 1–3 — see `09_PROGRAM_ADMIN_DEPRECATION_PLAN.md` |

---

## AUTHZ-003 — `isGlobal` bypasses all role allowlists

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-003 |
| Operation | Any `authorizeRoles(...)` route; privileged claim lifecycle |
| FE | Reads `user.isGlobal` for tenant switcher (UI only) |
| BE | `if (req.user.isGlobal) return next()`; claim derived at login from `super_admin` role — **not a DB column** |
| Investigation (2026-07-16) | See `08_PRIVILEGED_IDENTITY_LIFECYCLE.md` |
| Direct API assign `isGlobal` | **Not exploitable** (no field; Zod `.strict()`) |
| Indirect obtain `isGlobal` | **Mitigated for HTTP user APIs (IDENTITY-001):** only `isGlobal` requesters may assign/control `super_admin`. **IDENTITY-002:** stale JWT role/`isGlobal`/university claims no longer authorize — `req.user` is rebuilt from current DB after JWT verify |
| Effective | Bypass is by design for **current** SA (`isGlobal` from DB roles); HTTP escalation via role assignment **blocked**; deactivated users rejected (**IDENTITY-003**) |
| Confidence | **Confirmed** |
| Test | `authorization.identity001.superAdminPrivilege.test.js` + `authorization.currentAuthContext.test.js` + identity lifecycle |
| Severity | Bypass itself **P3** (design); escalation path **addressed**; stale-claim risk **addressed** |
| PO decision | Separate `program_admin` deprecation — see `09_PROGRAM_ADMIN_DEPRECATION_PLAN.md` |
| Suggested future fix | Follow phased plan in doc 09 — **Phases 1–3 done**; Phase 4 optional soft-retire |

---

## AUTHZ-004 — FE PermissionGate ignores DB permissions; PagePermissionGate does not

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-004 |
| Operation | UI action vs page visibility |
| FE | `PermissionGate` → `hasUiPermission` (role only); `PagePermissionGate` → `hasUiPermissionForUser` |
| BE | Unaffected |
| DB | Codes only matter for page/nav paths using ForUser |
| Effective | Same user can see a page via DB code overlay but still lack action buttons (or inverse) |
| Security impact | None on server (UI only) |
| Confidence | **Confirmed** |
| Test | FE characterization |
| Severity | **P2** |
| PO decision | Should DB permissions drive actions too, or remove DB from FE? |
| Suggested future fix | One FE checker for gates + nav |

---

## AUTHZ-005 — Admin nav / rolePermissions vs env CSVs diverge

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-005 |
| Examples | (1) `university_admin` sees admin enrollment UI via admin shell but **not** on default `ENROLLMENT_DECISION`. (2) `qa_officer` has ADMIN_ALL UI including grade flags but **not** on `ACADEMIC_WRITE`. (3) Analytics/settings UI SA-oriented; PA has admin shell but BE settings/analytics are SA/`isGlobal`. |
| FE allows / BE denies | UA enrollment decide; QA academic writes; PA settings/analytics (unless global) |
| FE hides / BE allows | Possible where nav omits item but API allowlist includes role (e.g. instructor APIs without admin nav) |
| Security impact | Hidden UI ≠ denied API; visible UI ≠ allowed API |
| Confidence | **Confirmed** for default CSVs (characterization matrices) |
| Test | envRoles + FE ADMIN_ALL |
| Severity | **P2** (UI/API mismatch); escalate if product expected UA enrollment |
| PO decision | Align each sensitive op’s nav with env CSV |
| Suggested future fix | Generate nav from same allowlist source as BE |

---

## AUTHZ-006 — `/academic` RoleShellPermissionOutlet is a no-op

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-006 |
| Operation | Academic portal path permissions |
| FE | Outlet mounted; `getRouteUiPermission('/academic/...')` returns **null** → treated as allowed for shell |
| BE | Separate hardcoded role lists on academic FT routes |
| Effective | Only `RoleBasedRoute` roles gate `/academic` |
| Severity | **P3** |
| Confidence | **Confirmed** |
| Test | FE `getRouteUiPermission` academic → null |
| PO decision | Add academic route map or remove unused outlet |
| Suggested future fix | Extend `ROUTE_RULES` or drop wrapper |

---

## AUTHZ-007 — Unknown FE role falls back to student matrix

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-007 |
| Operation | UI permissions for unrecognized role code |
| FE | `BY_ROLE[role] ?? STUDENT` |
| BE | Unknown role → **403** on allowlists |
| Effective | FE may show student capabilities for garbage roles; BE denies APIs |
| Severity | **P2** |
| Confidence | **Confirmed** |
| Test | FE characterization |
| PO decision | Fail closed to empty permissions for unknown roles |
| Suggested future fix | Default deny matrix |

---

## AUTHZ-008 — DB permissions returned but unused for BE enforcement

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-008 |
| Operation | Login/`/me` `permissions[]` |
| FE | Partial overlay |
| BE | Never consulted by middleware |
| Seeds | Roles seeded; permissions often empty |
| Severity | **P3** |
| Confidence | **Confirmed** |
| PO decision | Seed and enforce, or stop returning unused codes |
| Suggested future fix | Either wire `authorizePermission` or remove from API contract |

---

## AUTHZ-009 — Academic submission/grade SPA vs API (related ISS-002)

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-009 |
| Operation | Student submission write; staff grade write |
| FE | `canSubmitAssessments` / `canGradeAssessments` gates decorative buttons; **no** `apiClient.post/put/patch` in submissions/grades services |
| BE | Student `POST /assessments/:id/submissions`, `PUT /submissions/:id`; staff grade POST/PUT/finalize — ownership + enrollment enforced |
| Severity | **P2** product gap (not a new auth bypass) |
| Status | Reconfirmed 2026-07-18 — full report `12_ACADEMIC_SUBMISSIONS_AND_GRADING_ANALYSIS.md` (classification **C** + **G**) |
| Confidence | **Confirmed** |
| Test | `authorization.iss002.academicSubmissions.characterization.test.js` |
| PO decision | See ISS-002 — wire SPA, hide buttons, or reserve APIs |
| Suggested future fix | Out of scope for AUTHZ redesign; track under ISS-002 |

---

## AUTHZ-010 — Dead `requireRoles` middleware

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-010 |
| Operation | N/A |
| BE | `role.middleware.js` checks singular `req.user.role` — unused |
| Severity | **P3** |
| Confidence | **Confirmed** |
| PO decision | Delete in cleanup phase (ISS-006) |
| Suggested future fix | Remove file |

---

## AUTHZ-011 — Path UI helper is permission-key based, not portal-based

| Field | Content |
|-------|---------|
| Issue ID | AUTHZ-011 |
| Operation | `canAccessPathWithUiPermissions` / shell path checks |
| FE | `/instructor/dashboard` maps to `canViewDashboard`; **student also has that flag** → helper returns **true** |
| BE | Instructor routes require `instructor` (or env list); student → **403** |
| Effective | Helper alone does not enforce portal boundaries; `RoleBasedRoute` still does for shell entry |
| Security impact | Low if RoleBasedRoute always wraps portals; risk if helper reused as sole gate |
| Confidence | **Confirmed** (FE characterization) |
| Test | `frontend/tests/rolePermissions.characterization.test.js` |
| Severity | **P2** |
| PO decision | Should path helper also require matching portal prefix for role? |
| Suggested future fix | Deny cross-portal paths in helper regardless of shared permission keys |

---

## Summary counts (this phase)

| Severity | Count | IDs |
|----------|------:|-----|
| P0 | **0** | — |
| P1 | **0–1** | AUTHZ-002 **resolved**; AUTHZ-003 if non-SA isGlobal ever possible |
| P2 | **5** | AUTHZ-004, 005, 007, 009, **011** |
| P3 | **4** | AUTHZ-001, 006, 008, 010 |

**No P0** filed solely because multiple permission systems exist.

---

## Product-owner decisions required (ordered)

1. ~~Is **program_admin** intentionally system-wide? (AUTHZ-002)~~ → **No** — Phase 3 removed; role deprecated.
2. What is the **single future authority** for permissions? (AUTHZ-001 / 008)
3. Should **admin nav** be generated from env allowlists? (AUTHZ-005)
4. Unknown-role FE behavior: student fallback vs deny? (AUTHZ-007)
5. Academic SPA write gap: ISS-002 (AUTHZ-009)

## Recommended first authorization fix (do not implement yet)

**AUTHZ-002:** **Resolved (2026-07-16 Phase 3)** — PA removed from `isSystemWideAdmin`, env allowlists, and FE admin sets; env cannot restore access. See `09_PROGRAM_ADMIN_DEPRECATION_PLAN.md`.
