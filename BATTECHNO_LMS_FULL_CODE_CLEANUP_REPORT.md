# BATTECHNO LMS — Full Code Cleanup Report

**Date:** 2026-08-23  
**Branch:** `main` (up to date with `origin/main` at start; working tree dirty after this pass)  
**Mode:** CLEANUP + SAFE REFACTOR. No rewrite. No UI redesign. No git commit/push. No Prisma migrate reset / db push / DROP / TRUNCATE.  
**Business rules:** No product-rule changes. Authorization, portal isolation, completion, assessment engine, and report formulas were not rewritten.

---

## Executive summary

This pass cleaned **verified dead code**, **duplicated domain helpers**, and **inconsistent list-meta / date-only utilities** without changing endpoint URLs, Prisma schema, or user-visible business behavior.

The work is intentionally **not** a full rewrite of every large page/service. Oversized files such as `trainingPrograms.service.js` (~2.1k lines) and `AdminTrainingCourseDetailPage.jsx` (~1.3k lines after helper extraction) remain, because splitting them further would be an architecture project, not a safe cleanup.

**Net tracked diff:** 54 files changed, **−1,174 lines** (plus 8 new helper/test files).

---

## Baseline (before edits)

| Check | Result |
| --- | --- |
| Branch | `main`, clean working tree, up to date with `origin/main` |
| `npx prisma validate` | PASS |
| Backend `npm run test:unit` | 688 pass / 0 fail / 1 skipped |
| Frontend `npm run test:unit` | 76 pass / 0 fail |
| Existing `frontend/dist` main JS | `index-CWFnjD20.js` **489.8 KB** |
| Prior performance report main JS | 480.1 KB (2026-08-19) |

Pre-existing skipped backend test is unchanged and is **not** attributed to this cleanup.

---

## Areas cleaned

| Area | What changed |
| --- | --- |
| Dead files | 14 unused FE/BE files deleted after import, dynamic-import, router, script, and test reference checks |
| Unused FE API surface | Phantom `auth.refresh`, unused AI/file helpers, unused `fetchAnalyticsDomain`, unused lazy page exports |
| Trainer authorization helpers | Identical `isTrainerOnly` / `assertTrainerProgramAccess` copies in 7 training services → `trainerGuards.js` |
| Date-only helpers | `dateOnlyISO` / `toDateOnly` / `formatDateOnly` / `parseDateOnly` centralized in `backend/src/utils/dateOnly.js` |
| Pagination meta | `buildListMeta` used by 13 list services |
| Training status labels | Shared Arabic program + task status maps |
| Admin course detail | Display helpers extracted; page still owns data/fetch |
| CSS | Selectors that only served deleted components removed; form/grade styles kept |
| Scripts | Broken `package.json` entries pointing at files that **never existed in git** removed |

---

## Files removed

| File | Reason removed | Reference check | Risk |
| ---- | -------------- | --------------- | ---- |
| `backend/src/middlewares/role.middleware.js` | Unused `requireRoles`; live auth uses `authorization.middleware.js` → `authorizeRoles` | Grep: only this file + maintenance docs. Zero JS/test/script imports | Low |
| `frontend/src/pages/admin/help/AdminHelpCenterPage.jsx` | Orphan page; `/admin/help` already redirects to content-hub | Only self + unused `lazyPages` export. Router uses `HelpArticlesPage` | Low |
| `frontend/src/hooks/useTenantScopeList.js` | Unused hook | Stem only in this file | Low |
| `frontend/src/hooks/index.js` | Empty barrel (`export {}`) | No importers | Low |
| `frontend/src/utils/emailDomain.js` | Unused FE copy; BE `utils/emailDomain.js` is live | No FE importers | Low |
| `frontend/src/utils/format.js` | Unused wrapper over `locale.js` | Only mentioned in frontend docs | Low |
| `frontend/src/components/assessment/AssessmentActionBar.jsx` | Never mounted | Export only in this file | Low |
| `frontend/src/components/submission/SubmissionCard.jsx` | Never mounted | Export only in this file. Sibling badges kept | Low |
| `frontend/src/components/landing/HomeHeader.jsx` | Landing leftover; `Home.jsx` uses `HeroFloatingNav` | Export only in this file | Low |
| `frontend/src/components/landing/hero/HeroCapabilityStack.jsx` | Unused landing leftover | No importers | Low |
| `frontend/src/components/landing/hero/HeroCockpitNav.jsx` | Unused landing leftover | No importers | Low |
| `frontend/src/components/landing/hero/HeroProductStage.jsx` | Unused landing leftover | No importers | Low |
| `frontend/src/components/landing/hero/HeroSystemStatus.jsx` | Only used by deleted `HeroProductStage` | Sole consumer deleted | Low |
| `frontend/src/components/landing/hero/hero.constants.js` | Only consumed by the deleted hero leftovers | After those deletes, zero remaining importers | Low |

**Not deleted (intentionally):** Prisma migrations; ops/manual scripts under `backend/scripts/` that are not in `package.json`; unmounted-looking APIs that may have external/CLI consumers (`GET /students`, `/files/health`, `/ai/test`); `analyticsDatePresets.js` (canonical helper, unused by Super Admin hook — wiring would change `last7`/`last30` windows).

---

## Dead code removed

- Unused lazy exports: `AdminHelpCenterPage`, `LoginPage` (file kept; portal wrappers still import it directly).
- Unused FE service helpers: `fetchAnalyticsDomain`, `getFileDownloadUrl`, `deleteStoredFile`, `fetchAiStatus`, `generateAiText`.
- Unused endpoint constants: `auth.refresh`, `auth.registerSpecialties`, `students`, `files.downloadUrl` / `delete` / `health`, `ai.*`. Duplicate `analytics` key in `endpoints.js`.
- CSS only used by deleted components: `.assessment-action-bar*` and `.submission-card*`. Kept `.assessment-form*` and `.grade-summary-*`.

---

## Duplicate code consolidated

| Duplicate | Canonical location | Behavior changed? |
| --- | --- | --- |
| `isTrainerOnly` + `assertTrainerProgramAccess` (7 copies) | `backend/src/modules/trainingPrograms/trainerGuards.js` | NO — same predicate and lazy `trainerAssignments` require |
| `dateOnlyISO` (cohorts + enrollments) and FT `toDateOnly`/`formatDateOnly` | `backend/src/utils/dateOnly.js` | NO for valid dates. Invalid `Date` objects now return `null` from `dateOnlyISO` instead of throwing in cohort serialization |
| List `total_pages` math (~13 services) | `buildListMeta` in `backend/src/utils/pagination.js` | NO — `Math.max(1, ceil(total / page_size))` |
| Training course status Arabic maps (list + detail + edit form) | `frontend/src/features/training/trainingProgramStatus.js` | NO |
| Trainee task status Arabic map | `frontend/src/features/training/trainingTaskStatus.js` | NO |

---

## Utilities consolidated

New domain-focused helpers (no giant `utils.js`):

- `backend/src/modules/trainingPrograms/trainerGuards.js` — trainer-only vs admin distinction preserved; assignment check still required.
- `backend/src/utils/dateOnly.js` — UTC-midnight parse + YYYY-MM-DD format.
- `backend/src/utils/pagination.js` — added `buildListMeta` only.
- `frontend/src/features/training/trainingProgramStatus.js`
- `frontend/src/features/training/trainingTaskStatus.js`
- `frontend/src/pages/admin/trainingCourses/trainingCourseDetailUi.jsx` — overview date/domain display helpers (ar-EG + Asia/Amman noon, same as before).

---

## Large files refactored

| File | Before problem | Refactor | Behavior changed? |
| ---- | -------------- | -------- | ----------------- |
| `AdminTrainingCourseDetailPage.jsx` | Local status/date/domain helpers in a ~1.4k-line page | Extracted display helpers; data ownership stays in the page | NO |
| `trainingPrograms.service.js` and 6 sibling training services | Copy-pasted trainer guards | Import `trainerGuards` | NO |
| `fieldTraining.repository.js` | Local date-only helpers | Import `dateOnly` util; still re-exports `toDateOnly` | NO |
| 13 list `*.service.js` files | Repeated pagination meta | `buildListMeta` | NO |

**Not split in this pass (too large / high risk):** `help.service.js`, `fieldTraining.workflowService.js`, `fieldTraining.repository.js` query surface, `NotificationRulesPage.jsx`, `TrainerCoursePage.jsx`, `AdminFieldTrainingPage.jsx`. See remaining debt.

---

## Unused imports / variables

Removed unused named API helpers and endpoint keys listed above. No project ESLint/`tsc` script exists, so a mechanical unused-import sweep of all 1,100+ source files was **not** claimed. Touched files were cleaned of the unused symbols introduced by this pass.

---

## Logging cleanup

No `console.log` / `console.debug` / `console.table` in `frontend/src` or `backend/src` except operational sinks:

- `backend/src/server.js` startup/shutdown
- `backend/src/utils/logger.js`
- `console.error` in `ErrorBoundary` and Super Admin analytics export failures

Those were **kept**. No secrets-logging found in the scanned debug patterns.

---

## Backend cleanup

- Dead `role.middleware.js` deleted (CLN-003).
- Trainer assignment guards centralized; organization/university scope helpers **not** collapsed into a generic `isStaff()`.
- Date-only formatting for academic cohorts/sessions/enrollments and field-training dates now share one util.
- List responses still return `{ page, page_size, total, total_pages }`.
- Broken `package.json` scripts/tests that referenced **never-committed** files removed:
  - `seed:battechno-diploma-content-office-pre`
  - `verify:battechno-diploma-content-office-pre`
  - `users:inspect-activation`
  - `users:activate-and-verify-all`
  - `tests/battechnoDiplomaContentOfficePre.seed.unit.test.js`
  - `tests/activateAndVerifyAllUsers.script.unit.test.js`  
  Decision: remove obsolete script entries (nothing to restore; `git log --all -- <path>` empty). Related live seeds (`seed:battechno-diploma`, CPF LinkedIn/CV, etc.) kept.
- Routes/controllers were **not** remounted or URL-changed. No handler deletions.

---

## Frontend cleanup

- Dead landing leftovers and unused assessment/submission shells removed.
- Router `import * as Pages from './lazyPages.js'` no longer pulls unused help/login lazy factories.
- Training course list/detail/edit share one status map; filter options unchanged (`CANCELLED` still omitted from the list filter, matching previous UI).
- Upload flow still uses `presignUpload` / `confirmUpload` only.
- Portal isolation, RTL, and BATTECHNO design tokens were not restyled.

---

## Report cleanup

PDF/Excel/report builders were **not** rewritten. Prior performance work already batches university/cohort report queries. This pass did not introduce per-student loops. Canonical report metrics remain in backend training/field-training report services.

---

## Database / Prisma cleanup

- Schema: unchanged.
- Migrations: none deleted or renamed.
- `npx prisma validate`: PASS after edits.
- No `db push`, reset, or data mutation.

---

## Performance impact

| Asset | Before (local dist) | After | Notes |
| ---- | ---: | ---: | --- |
| Main JS `index-*.js` | 489.8 KB | **437.42 KB** (gzip **141.00 kB**) | Entry in `dist/index.html` |
| Secondary hashed `index-UccViGix.js` | 58.7 KB | 60.14 KB | Same content hash prefix family; not the HTML entry |
| Initial CSS `index-*.css` | — | 332.35 KB (gzip 51.36 kB) | Landing CSS still deferred to `Home-*.css` (~70.85 KB) |
| `xlsx` chunk | 276.1 KB | 282.46 KB | Vendor chunk; on-demand |
| `recharts` chunk | 398.4 KB | 407.91 KB | Vendor chunk; on-demand |
| Super Admin analytics route | — | 36.99 KB | Still split from `xlsx` |

No unexpected main-bundle increase. N+1 query patterns from the prior performance pass were not reintroduced.

---

## Tests

| Suite | Before | After |
| --- | --- | --- |
| Backend unit | 688 pass / 1 skipped | **696 pass / 1 skipped / 0 fail** |
| Frontend unit | 76 pass | **78 pass / 0 fail** |

Added:

- `backend/tests/trainerGuards.unit.test.js` (trainer vs admin vs global)
- `backend/tests/dateOnly.unit.test.js`
- `frontend/tests/trainingStatusLabels.test.js`

New test failures: **NONE**.

---

## Build

| Check | Result |
| --- | --- |
| Prisma validate | PASS |
| Backend `node --check` on modified modules + `server.js` | PASS |
| Frontend production build | PASS |
| Backend unit tests | PASS (1 pre-existing skip) |
| Frontend unit tests | PASS |

---

## Manual smoke / runtime

**BLOCKED — safe QA data unavailable; no browser automation tools in this session.**

Did not log into University/Institution portals or mutate real users. No production data touched.

Runtime regressions from static checks: **NONE** (syntax check + unit tests + production build). Live 404/500 browser scan was not executed.

---

## Security / authorization

- Trainer-only vs admin vs `isGlobal` distinction preserved.
- `assertTrainerProgramAccess` still delegates to `assertTrainerCanAccessProgram`.
- University vs institution organization-type checks were not collapsed.
- No ownership checks removed.
- No client-only access-control rewrite.

Security/authorization regression: **NONE** from this cleanup.

---

## Business-rule changes

**NONE** intended.

The only semantic tightening: `dateOnlyISO` now returns `null` for invalid `Date` values instead of throwing `RangeError` on `toISOString()`. Valid calendar dates format identically (`YYYY-MM-DD`, UTC midnight).

---

## Remaining technical debt

| Item | Priority | Why not changed |
| --- | --- | --- |
| `trainingPrograms.service.js` (~2.1k lines), `help.service.js`, FT workflow/repository still huge | High | Splitting would be an architecture pass, not cleanup |
| `AdminTrainingCourseDetailPage.jsx` still ~1.3k lines of tab JSX | High | Extracting tabs would create heavy prop drilling without a data-layer redesign |
| Duplicate `requireOrgWrite` in training services (assessment uses `ROLE_NOT_ALLOWED` codes; others do not) | Medium | Unifying would change API error codes |
| `analyticsDatePresets.js` unused; `useAnalytics` uses exclusive −7/−30 windows | Medium | Wiring the inclusive helper would change Super Admin date filters |
| `qa-reviews` / `corrective-actions` local `parseDateOnly` (`new Date(str)` not UTC midnight) | Medium | Different parse semantics than cohort dates |
| Duplicate `isReviewerOnly` in field-training reports vs training reports | Medium | Different portal scopes (university vs institution) — must stay distinct |
| `formatTrainingDateRangeShort` still strips a hard-coded `2026` year | Low | Preserved existing display quirk |
| No ESLint/TypeScript in package scripts | Medium | Introducing a linter is a tooling project |
| Bug-audit P0/P1 items (institution admin null `universityId`, academic list leaks, etc.) | High | Product/security fixes, not cleanup |
| Dual `admin` role across UNIVERSITY/INSTITUTION portals | High | Requires product + auth session design |
| Unwired BE ops routes (`/ai/test`, files health) | Low | May be used operationally |

---

## Final metrics

| Metric | Count |
| --- | ---: |
| Files reviewed (inventory: `backend/src` + `frontend/src` JS/JSX) | ~1,136 |
| Files modified (git `M`) | 40 |
| Files removed (git `D`) | 14 |
| Files added | 8 (+ this report) |
| Unused imports/exports removed (named, verified) | ~15 |
| Dead files removed | 14 |
| Duplicate utilities consolidated | 5 clusters |
| Console debug statements removed | 0 (none present) |
| Large components fully split into tab modules | 0 (helpers only) |
| Large services fully split | 0 (`trainerGuards` extracted) |
| N+1 patterns newly fixed | 0 (prior work preserved) |
| Tests added | 10 assertions across 3 files |
| Tests updated | 0 |

Numbers are from git + test runners, not estimates.

---

## Suggested commit message

```text
refactor: clean and simplify BATTECHNO LMS codebase
```