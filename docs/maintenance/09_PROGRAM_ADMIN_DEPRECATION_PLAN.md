# 09 — Program Admin Deprecation Plan

**Status:** **Phases 1–4 done (2026-07-18)** — `program_admin` soft-retired in catalog presentation; historical data retained; no runtime access.  
**Product decision:** `program_admin` is no longer required and must be removed from **active use**.  
**Historical data:** Must be preserved (no deletes of role row, links, or audits without an additive archival strategy).  
**Related:** AUTHZ-002 (**resolved**), IDENTITY-001, IDENTITY-002/003, ISS-001

---

## Phases (canonical)

| Phase | Name | Status |
|-------|------|--------|
| **1** | Assignment freeze + UI removal from assignable selectors | **Done (2026-07-16)** |
| **2** | Existing-user mapping / deactivation (explicit; no auto SA) | **Done (2026-07-16)** — deactivated PA-only accounts |
| **3** | Runtime authorization removal (`isSystemWideAdmin`, env CSVs, hardcoded allowlists, FE nav) | **Done (2026-07-16)** |
| **4** | Soft retirement + historical preservation | **Done (2026-07-18)** |

---

## Phase 1 freeze record (2026-07-16)

| Item | Detail |
|------|--------|
| Backend guard | `programAdminAssignmentGuard.js` → `assertProgramAdminNotNewlyAssigned` on `createUser` / `updateUser` |
| Error | HTTP **400**, code `PROGRAM_ADMIN_DEPRECATED` |
| Scope | Any explicit `role_codes` containing `program_admin` (incl. global requesters, mixed/dup/case) |
| Preserve | Omit `role_codes` → existing PA links unchanged |
| Resubmit PA | Explicit `role_codes: ['program_admin']` **rejected** (no rewrite exception) |
| FE assignable | Removed from create/edit/view **assignment** options; list filter retained with deprecated label |
| Legacy label | EN `Program Admin — Deprecated` / AR `إداري برامج — متوقف` |
| Seeds | Demo / analytics / test-account catalogs no longer **create** PA users; role **catalog** row kept |
| Runtime | `isSystemWideAdmin`, env CSVs, FT/report allowlists **unchanged** for existing holders |
| Masked assignee count | Still **2** active PA-only users (prior read-only inventory; not re-queried this patch) |
| DB changes | **None** |
| Tests | `authorization.programAdminFreeze.test.js`, `frontend/tests/programAdminFreeze.test.js` |

### Assignment paths protected (HTTP)

- `POST /api/v1/users` (`role_codes` required)
- `PUT /api/v1/users/:id` when `role_codes` present
- Public register remains student-only (unchanged; cannot inject PA)

### Frontend assignment sources removed

- `UserCreatePage` role select
- `UserEditPage` / `UserViewPage` assignable options (legacy current-PA display only)
- `userSchema` assignable enum; `ASSIGNABLE_USER_ROLE_CODES`

### Rollback (Phase 1)

1. Remove `assertProgramAdminNotNewlyAssigned` hooks + delete `programAdminAssignmentGuard.js`.
2. Restore FE selectors / schemas / labels / seed catalog entries.
3. Revert docs. No migration to undo.

---

## Phase 2 deactivation record (2026-07-16)

| Item | Detail |
|------|--------|
| Decision | Deactivate PA-only accounts (no replacement role; no SA promotion) |
| Script | `backend/scripts/deactivate-program-admin-only-users.js` + `scripts/lib/programAdminDeactivation.js` |
| Dry-run date | 2026-07-16 |
| Apply date | 2026-07-16 |
| Batch ID | `30b7dca3-7fd6-437c-b0e7-6bdf7479c347` |
| Candidate count (dry-run) | **2** |
| Updated count | **2** |
| Post-apply dry-run candidates | **0** |
| Active `program_admin` holders remaining | **0** |
| Users deleted | **No** |
| `user_roles` changed | **No** (both still `program_admin` only) |
| University links changed | **No** (`primary_university_id` retained) |
| Audit mechanism | Existing `audit_logs` (`MAINTENANCE_PROGRAM_ADMIN_DEACTIVATE`) |
| Audit rows for batch | **2** |
| Schema migration | **None** |
| Tests | `backend/tests/programAdminDeactivation.test.js` |

### Candidate selection conditions

Active user (`status = active`) with **exactly one** role code `program_admin`, non-null `primary_university_id`, no `super_admin`, and no other active PA holders outside that set. Expected count must match `EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT` (default 2).

### Apply / dry-run / rollback commands

```bash
# Dry-run (default)
EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT=2 node scripts/deactivate-program-admin-only-users.js

# Apply
EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT=2 APPLY_PROGRAM_ADMIN_DEACTIVATION=true node scripts/deactivate-program-admin-only-users.js

# Rollback dry-run
PROGRAM_ADMIN_DEACTIVATION_BATCH_ID=<batch-uuid> node scripts/deactivate-program-admin-only-users.js --rollback

# Rollback apply (restores status=active only; keeps audit history)
PROGRAM_ADMIN_DEACTIVATION_BATCH_ID=<batch-uuid> APPLY_PROGRAM_ADMIN_DEACTIVATION_ROLLBACK=true node scripts/deactivate-program-admin-only-users.js --rollback
```

Rollback safeguards: exact batch ID; user still has `program_admin` link; current status still `inactive` (aborts if later admin change superseded); writes new `MAINTENANCE_PROGRAM_ADMIN_REACTIVATE` audit; never deletes audit or roles.

### Inventory match

Masked IDs `372aa158…` and `869372ff…` match the previously documented two-user inventory. No discrepancy.

### Remaining after Phase 2 (addressed in Phase 3)

`isSystemWideAdmin`, env `*_ROLE_CODES` defaults, hardcoded FT/report/certificate/notification lists, FE `ADMIN_ROLE_SET` / nav — **stripped in Phase 3**.

---

## Phase 3 runtime removal record (2026-07-16)

| Item | Detail |
|------|--------|
| Precondition | Active PA holders = **0**; historical PA links = **2**; batch audit rows = **2** |
| Backend | `isSystemWideAdmin` = `isGlobal` only; `runtimeRoles.filterDeprecatedFromRoleAllowlist`; env parse strips PA; `authorizeRoles` strips PA |
| Env defaults | All `*_ROLE_CODES` defaults exclude PA; `USER_WRITE` / `UNIVERSITY_WRITE` = **`super_admin` only** |
| Env override | Explicit `program_admin` in env CSV is **ignored** with one-time safe warning (no crash, no secrets logged) |
| Frontend | Removed from `ADMIN_ROLE_SET`, admin nav, FT admin, `rolePermissions` (DENY_ALL), dashboard helpers (fail closed → `/login`) |
| Historical retained | Labels EN/AR, list filter, export label, inactive-user display, catalog row, `user_roles` |
| Replacement widening | **None** — no role gained PA’s former permissions |
| DB writes this phase | **None** |
| Tests | `authorization.programAdminPhase3.test.js`, `frontend/tests/programAdminPhase3.test.js`; characterization suites updated |
| Unit count note | Backend `test:unit` **326 → 242** (−84) after Phase 3 — **reconciled** in `10_TEST_SUITE_RECONCILIATION.md` (envRoles 102-case matrix consolidated; Phase 3 suite added; no files omitted) |
| AUTHZ-002 | **Resolved** (PA not system-wide; env cannot restore access) |

### Features that became super_admin-only (were SA+PA defaults)

- User create/update allowlist default (`USER_WRITE_ROLE_CODES`)
- University create/update allowlist default (`UNIVERSITY_WRITE_ROLE_CODES`)
- Any operation that previously relied on PA via `isSystemWideAdmin` cross-uni bypass without another independently allowed role

### Rollback implications (Phase 3)

- Phase 2 rollback (reactivate inactive PA accounts) **does not** restore operational access after Phase 3.
- Restoring PA runtime would require reverting code (env filter, `isSystemWideAdmin`, FE admin sets) — **not** recommended.
- Phase 2 deactivation/rollback script remains available and unchanged.

### Legacy-only references intentionally retained

- `roles` catalog row + historical migrations
- `user_roles` for inactive PA holders
- Assignment freeze guard + Phase 2 scripts
- FE/BE export & filter labels; analytics historical role count bucket
- Tests covering freeze / legacy display / Phase 2

---

## Executive summary

| Item | Finding |
|------|---------|
| Role in DB | Present (`roles.code = program_admin`, seed `scope = university`) |
| Current assignees (shared DB) | **2** users still hold `program_admin` **role links**; both **`inactive`** after Phase 2 (2026-07-16) |
| Last login | **Neither** assignee had `last_login_at` at inventory time |
| Runtime privilege | **None** — Phase 3 removed all active AuthZ / nav / env allowlist grants |
| New assignments | **Blocked** (Phase 1) |
| Auto-map to `super_admin`? | **Forbidden** — Phase 2 deactivated instead of remapping |
| Recommended next | Deprecation program complete (Phases 1–4) |

---

## 1. Phase 3 targets (completed)

### 1.1 `isSystemWideAdmin`

| File | After Phase 3 |
|------|----------------|
| `backend/src/utils/universityScope.js` | **`isGlobal` only** — PA denied |

### 1.2 Hardcoded allowlists / services

PA removed from delivery, assessments/grades/submissions staff sets, certificates, recognition, FT reports, notification / eventDispatcher lists. Analytics may still **count** historical PA rows in an “admin” bucket for reporting only.

### 1.3 Env CSV defaults (`env.js`)

Defaults exclude PA. `parseRoleCodesWithFallback` + `filterDeprecatedFromRoleAllowlist` strip PA even if env still lists it.

### 1.4 Frontend visibility

Active: removed from admin sets / nav / gates. Historical: deprecated labels + list filter + inactive-user display retained.

### Classification reminder

| Class | Phase 3 action |
|-------|----------------|
| A Assignment | Still frozen (Phase 1) |
| B Runtime AuthZ | **Removed** |
| C FE visibility | **Removed** from active admin UX |
| D Historical display | **Retained** |
| E Tests | Phase 3 suites + updated characterization |
| F Seeds | No new PA users; catalog role kept |
| G Docs | This file + backlog / matrix / AUTHZ-002 |

---

## 2. Masked assignee inventory (updated after Phase 2)

| Masked id prefix | Status after Phase 2 | Roles retained | Uni retained | Phase 2 action |
|------------------|----------------------|----------------|--------------|----------------|
| `372aa158…` | **inactive** | `program_admin` only | yes | Deactivated (batch `30b7dca3-…`) |
| `869372ff…` | **inactive** | `program_admin` only | yes | Deactivated (same batch) |

Do not auto-promote to `super_admin`. Role links preserved for history.

---

## 3. Database preservation guarantees

- No deletion of `roles` row `program_admin`
- No deletion/modification of existing `user_roles` in Phase 1
- No destructive migrations
- Historical audits / exports retain readable deprecated label

---

## 4. Explicit non-goals (Phase 1)

- Removing PA from `isSystemWideAdmin` / env allowlists  
- Reassigning or deactivating the two current holders  
- Deleting `user_roles` or the `roles` row  
- Broad navigation removal  
- JWT / permission-source redesign  

---

## 5. Success criteria

### Phase 1 (done)

- [x] No new PA via HTTP create/update  
- [x] FE cannot select PA for new assignment  
- [x] Seeds/catalogs do not create new PA users  
- [x] No DB mutation of existing assignments in Phase 1  

### Phase 2 (done)

- [x] Active PA-only candidates deactivated (`inactive`)  
- [x] `user_roles` / university links preserved  
- [x] Audit batch recorded; rollback path documented  
- [x] Post-apply dry-run shows **0** active PA-only candidates  

### Phase 3 (done)

- [x] `isSystemWideAdmin` / env / FE nav no longer grant PA  
- [x] Env cannot restore PA via CSV override  
- [x] Zero-active-holder precondition verified (read-only)  
- [x] No DB mutation; historical records preserved  
- [x] AUTHZ-002 resolved  
- [x] Unit-suite count change audited (`10_TEST_SUITE_RECONCILIATION.md`) — safe for Phase 4 from inventory view  

### Phase 4 (done — 2026-07-18)

- [x] Catalog presentation soft-retired (`Program Admin (Deprecated)` + description in `baselineCatalog`)  
- [x] Operator docs updated (`ROLES_AND_PERMISSIONS.md`, `GETTING_STARTED.md`, project-analysis / FE journey notes)  
- [x] Compact active-role table-driven regression added (`authorization.activeRoles.regression.test.js`) — seven active roles × representative lists; PA denied; no 102-case matrix restore  
- [x] Historical labels, filters, exports, analytics buckets, freeze guard, Phase 2 rollback scripts **retained**  
- [x] No deletion of role row, `user_roles`, users, or audits  

---

## Phase 4 soft-retirement record (2026-07-18)

| Item | Detail |
|------|--------|
| Catalog | `REQUIRED_ROLES` name/description mark deprecated; row **kept** |
| Seeds | Analytics demo role name aligned; still **does not create** PA users |
| Docs | Active vs deprecated clarified; env examples no longer advertise PA |
| Tests | Compact regression; characterization suites unchanged in script |
| DB writes this phase | **None** (catalog text applies on future seed/baseline runs only) |
| Preserved | Labels, filters, exports, analytics PA count bucket, freeze, Phase 2 scripts |

### Later phases

*None* — deprecation program complete for product purposes. Optional ops: run baseline seed against non-production DB to refresh role `name`/`description` display strings.  
