# 10 — Test Suite Reconciliation (post–program_admin Phase 3)

**Date:** 2026-07-18  
**Scope:** Backend `npm run test:unit` count change **326 → 242** (−84).  
**Application behavior:** Not modified in this audit.  
**Phase 4 cleanup:** Soft-retire complete (2026-07-18). Compact active-role regression added; former 102-case matrix **not** restored.

Evidence artifacts (TAP):

| Label | Agent-tools artifact | `# tests` | `# suites` | `# pass` |
|-------|----------------------|----------:|-----------:|---------:|
| Before Phase 3 (Phase 2 validation) | `bd8136f2-5436-4a1f-b363-e127127acb40.txt` | 326 | 36 | 326 |
| Intermediate (during Phase 3) | `e8c39ed8-ca34-4178-93c7-c04d8f850d4c.txt` | 295 | 34 | 295 |
| After Phase 3 | `5f593cfa-820f-41e1-a263-43b085370bd0.txt` / live re-run | 242 | 25 | 242 |

---

## 1. Exact reason for 326 → 242

**Not** accidental deletion of test files from disk or from `test:unit`.

**Primary cause:** intentional rewrite of `authorization.envRoles.characterization.test.js` during Phase 3:

| Suite (TAP title) | Before | After | Δ |
|-------------------|-------:|------:|--:|
| `sensitive operation default role matrices` | 102 | 0 | **−102** |
| `env role defaults characterization (Phase 3)` | 0 | 5 | **+5** |
| `program_admin Phase 3 runtime removal` (new file) | 0 | 12 | **+12** |
| `universityScope characterization` | 16 | 17 | **+1** |
| `isSystemWideAdmin returns true for program_admin` | 1 | 0 | **−1** |
| `isSystemWideAdmin returns false for program_admin (Phase 3)` | 0 | 1 | **+1** |
| **Net** | | | **−84** |

Command-line comparison (same artifact headers):

- **Before:** 22 explicit unit files ending at `programAdminDeactivation.test.js` (no Phase 3 file).
- **After:** same 22 files **plus** `authorization.programAdminPhase3.test.js`.

Integration files (`fieldTraining.integration.test.js`, `landingStats.test.js`) were **already** excluded from `test:unit` before and after (ISS-011). They do **not** explain the −84.

---

## 2. Reconciliation totaling 84

| Cause | Test count difference |
| ----------------------------------------- | --------------------: |
| Deleted tests (files removed from repo) | 0 |
| Renamed or consolidated tests (envRoles matrix → Phase 3 assertions) | **−97** (−102 +5) |
| Moved to integration | 0 |
| Removed / replaced program_admin legacy expectations (scope + universityScope.test rename) | 0 net (−1 +1); characterization +1 elsewhere |
| Explicit script omission of an existing unit file | 0 |
| Conditional skips in unit suite | 0 |
| Other (new Phase 3 suite file) | **+12** |
| Other (universityScope characterization net) | **+1** |
| **Total** | **−84** |

Detail on the −102 matrix: nested allowlist suites under `sensitive operation default role matrices` included per-role allow/deny cases for defaults that still listed `program_admin` (USER_WRITE, CERTIFICATE_WRITE, FT admin, etc.), plus spot checks (`isGlobal` bypass, ADMIN_READ exclusions, UA vs enrollment). Replaced by five Phase 3-focused cases that lock **PA exclusion**, **PA deny-all on defaults**, **USER_WRITE = super_admin-only**, **ADMIN_READ still includes university_admin**, and **canonical historical PA code**.

---

## 3. Test inventory (disk vs scripts)

### Backend `*.test.js` on disk (25)

| File | In `test:unit`? | In `test:integration`? | Leaf `it`/`test('…')` (static) |
|------|:---------------:|:----------------------:|-------------------------------:|
| `analytics.trends.test.js` | Yes | No | 12 |
| `authorization.currentAuthContext.test.js` | Yes | No | 22 |
| `authorization.envRoles.characterization.test.js` | Yes | No | 5 |
| `authorization.fieldTraining.characterization.test.js` | Yes | No | 14 |
| `authorization.identity001.superAdminPrivilege.test.js` | Yes | No | 23 |
| `authorization.identityLifecycle.characterization.test.js` | Yes | No | 25 |
| `authorization.middleware.characterization.test.js` | Yes | No | 16 |
| `authorization.programAdminFreeze.test.js` | Yes | No | 14 |
| `authorization.programAdminPhase3.test.js` | Yes | No | 12 |
| `authorization.scope.characterization.test.js` | Yes | No | 17 |
| `emailOtp.test.js` | Yes | No | 5 |
| `fieldTraining.access.test.js` | Yes | No | 7 |
| `fieldTraining.auth.test.js` | Yes | No | 8 |
| `fieldTraining.integration.test.js` | No | Yes | 7 |
| `fieldTraining.workflow.test.js` | Yes | No | 7 |
| `health.test.js` | Yes | No | 5 |
| `landingStats.test.js` | No | Yes | 1 |
| `passwordResetToken.test.js` | Yes | No | 4 |
| `programAdminDeactivation.test.js` | Yes | No | 17 |
| `specialties.service.test.js` | Yes | No | 1 |
| `submissions.auth.test.js` | Yes | No | 4 |
| `testDatabaseGuard.test.js` | Yes | No | 14 |
| `universityEmailLink.test.js` | Yes | No | 2 |
| `universityScope.test.js` | Yes | No | 6 |
| `youtubePlaylist.test.js` | Yes | No | 2 |

**Unit static leaf total:** 242 (matches live `# tests 242`).  
**Skipped / todo in unit sources:** 0 `.skip` / `.todo` registrations.  
**Integration** may call `t.skip(...)` at runtime when DB/fixtures unavailable — intentional; not counted in unit.

### Files added / deleted / renamed / omitted

| Category | Result |
|----------|--------|
| Files deleted | **None** |
| Files renamed | **None** |
| Files added (Phase 1–3 era, still present) | AuthZ characterization suite + freeze + Phase 2/3 + guard (all on disk; Phase 3 file added to script) |
| Files no longer in `test:unit` | **None** relative to Phase 2 unit list |
| Moved to integration this phase | **None** (split already ISS-011) |
| `package.json` `test` | Still aliases `test:unit` (ISS-011); not reverted |

Git `HEAD` still has the pre-maintenance `test: node --test tests/*.test.js` only; working tree retains ISS-011 split. Phase 3 did **not** drop files from the explicit unit list.

---

## 4. Critical security coverage map

| Concern | Covered by (unit file) |
|---------|------------------------|
| Test database guard | `testDatabaseGuard.test.js` |
| Analytics trends | `analytics.trends.test.js` |
| Authorization middleware | `authorization.middleware.characterization.test.js` |
| Role / university scope | `authorization.scope.characterization.test.js`, `universityScope.test.js` |
| IDENTITY-001 | `authorization.identity001.superAdminPrivilege.test.js` |
| IDENTITY-002 / IDENTITY-003 | `authorization.currentAuthContext.test.js`, `authorization.identityLifecycle.characterization.test.js` |
| Current auth context | `authorization.currentAuthContext.test.js` |
| program_admin assignment freeze | `authorization.programAdminFreeze.test.js` |
| program_admin Phase 3 runtime denial | `authorization.programAdminPhase3.test.js`, updated env/scope/FT characterization |
| Field-training authorization | `authorization.fieldTraining.characterization.test.js`, `fieldTraining.access.test.js`, `fieldTraining.auth.test.js` |
| Cross-university access | scope + FT + `universityScope.test.js` |
| super_admin privilege boundaries | identity001 + identityLifecycle |
| Unknown-role / fail-closed | middleware + Phase 3 FE (`rolePermissions`); BE authorizeRoles deny |
| Env deprecated-role filtering | `authorization.programAdminPhase3.test.js`, `authorization.envRoles.characterization.test.js` |
| FE/BE AuthZ characterization | BE files above + `frontend/tests/rolePermissions.characterization.test.js`, `programAdminPhase3.test.js`, `programAdminFreeze.test.js` |

Targeted AuthZ subset re-run (2026-07-18): **168 pass / 0 fail**.

---

## 5. Accidental exclusion check

| Check | Result |
|-------|--------|
| `.skip` / `describe.skip` / `test.skip` / `it.skip` / `.todo` in unit files | **None** |
| Unit file on disk missing from `test:unit` | **None** |
| Unit script listing missing file | **None** |
| Silent early return skipping registration | **None** in unit suites |
| Filename / directory drift | **None** |
| Integration still separated | Yes — guard required |

**Verdict:** No accidental coverage loss requiring restore. Lower count is intentional Phase 3 consolidation + added Phase 3 suite.

### Remaining characterization gap (not a security hole)

The former **102-case** env allowlist × role matrix no longer asserts every active role against every default CSV as separate tests. Defaults for non-PA roles remain **documented in code** (`DEFAULTS` in envRoles characterization + live `env.*_ROLE_CODES`). Optional future work: restore a **PA-free** combinatorial matrix without reintroducing PA allow expectations.

---

## 6. Validation (this audit)

| Check | Result |
|-------|--------|
| Backend `npm run test:unit` | **242 pass / 0 fail / 0 skipped / 0 todo** |
| Test DB guard | included in unit; pass |
| Targeted AuthZ suites | **168 pass** |
| Frontend `npm run test:unit` | **29 pass** |
| Frontend `npm run build` | **ok** |
| `npx prisma validate` | **ok** |
| Shared-Neon integration | **not run** |

---

## 7. Phase 4 readiness / completion

Phase 4 soft-retire completed 2026-07-18. Active-role coverage preserved via compact table-driven suite `authorization.activeRoles.regression.test.js` (seven active roles × representative lists + PA/unknown fail-closed + env strip + domain spot-checks). Former 102-case PA-era matrix remains retired by design.
