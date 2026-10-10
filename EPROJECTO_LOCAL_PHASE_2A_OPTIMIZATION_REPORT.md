# EPROJECTO LOCAL PHASE 2A OPTIMIZATION REPORT

Status: **PARTIAL**
Execution environment: **local repository only**
Deployment readiness: **NOT_READY_FOR_DEPLOYMENT**
Production deployment: **not performed**

This phase changed local code, measured a local production frontend build, and ran the repository test scripts. It did not SSH, copy files, restart services, edit production Nginx, change production environment variables, run production Prisma migrations, or deploy.

## Repository starting state

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `328ee2ec3d8ac98e9d38e422cc9365d978be41f6` |
| Working tree | Already dirty before this phase. That work was kept. Nothing was reset, checked out, staged, committed, pushed, or merged. |

Pre-existing uncommitted work (assignment uploads, field-training bulk export, premium UI, and related tests) remains in the tree beside the Phase 2A edits. A suggested commit message is at the end of this report. No commit was created.

## Local environment

| Item | Value |
| --- | --- |
| Frontend package | `frontend` / `battechno-lms-web` |
| Backend package | `backend` / `battechno-lms-api` |
| Package manager | npm 11.19.0 |
| Node | v24.21.0 |
| Prisma | `@prisma/client` ^6 (`backend/package.json`) |
| Frontend dev | `npm run dev` (Vite, port 5173, `/api` proxied to `http://localhost:4000`) |
| Frontend tests | `npm run test:unit` |
| Frontend production build | `npm run build` (`vite build`) |
| Backend dev | `npm run dev` (`node --watch src/server.js`) |
| Backend tests | `npm run test:unit` (unit), `npm run test:integration` (not run) |
| Backend production start | `npm start` (`node scripts/start-production.js`). There is no compile step and no `typecheck` script. |
| Docker | `docker-compose.yml` is the production-like layout. It was not started. |

## Safe database verification

Local `backend/.env` `DATABASE_URL` host is the Neon pooler in `us-east-2` (`ep-divine-dust-ajorp5w4-pooler.c-3.us-east-2.aws.neon.tech`, database name `neondb`). That is the production database. Credentials are not recorded here.

### Previous audit mutation

**YES.** The earlier read-only audit reported `Database Changed: YES` because `GET /api/v1/public/landing-stats` calls `incrementLandingVisits` even on a cache hit (`landingStats.service.js`). This phase did not request `https://eprojecto.com`.

### What this phase did with that database

PowerShell treats `$env:DATABASE_URL = ''` as removing the variable. Backend modules then load `backend/.env` through `dotenv`, so two unit tests that run only when `DATABASE_URL` is present executed against production Neon:

- `database has completed_training_hours and legacy rows default to 0` — `SELECT` on `information_schema` and `field_training_applications`, plus repository reads.
- `returns 200 with student auth when catalog is available` — authenticated help-catalog GET.

HTTP write routes observed in that run returned 401 or 403 before a successful mutation. No write from those tests was identified. This is still production database access, so the phase cannot be marked ready.

`GET /health/ready` skipped itself when `DATABASE_URL` was present. Integration tests were not run. Docker Compose was not started, because it would use the same `.env`.

## Files changed in this phase

Frontend:

- `frontend/src/components/common/RootRedirect.jsx`
- `frontend/src/app/router/index.jsx`
- `frontend/src/app/router/lazyPages.js`
- `frontend/src/features/analytics/useCommandCenter.js`
- `frontend/src/pages/admin/users/UsersListPage.jsx`
- `frontend/src/components/common/BrandLogo.jsx`
- `frontend/src/components/landing/home.constants.js`
- `frontend/src/i18n/locales/en/common.json`
- `frontend/src/i18n/locales/ar/common.json`
- `frontend/vite.config.js`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/tests/brandLogo.homeNav.test.js`
- `frontend/public/eprojecto-logo.png` (resized public/Open Graph copy)
- `frontend/src/assets/images/eprojecto-logo.webp` (new)
- `frontend/src/assets/partners/*.webp` (new hashed sources)

Backend:

- `backend/src/modules/analytics/analytics.repository.js`
- `backend/src/modules/attendance/attendance.repository.js`
- `backend/src/modules/attendance/attendance.service.js`
- `backend/src/modules/fieldTraining/fieldTraining.repository.js`
- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.service.js`
- `backend/src/modules/fieldTraining/fieldTraining.notifications.js`
- `backend/src/modules/fieldTraining/fieldTraining.qualification.service.js`
- `backend/src/modules/users/users.service.js`
- `backend/src/shared/services/notification.service.js`
- `backend/src/shared/services/audit.service.js`
- `backend/src/utils/auditRecorder.js`

Other:

- `.gitignore`
- 70 generated files under `qa-artifacts/field-training/` deleted from the working tree (unstaged deletions)
- `qa-artifacts/performance/screenshots/README.txt` restored after it was caught by the screenshot sweep

## Dependencies changed

Removed from the frontend package with npm, so the lockfile matches:

- `jspdf`
- `jspdf-autotable`
- `sass` (direct dependency)

Kept:

- `sass-embedded` (Vite SCSS compiler)
- `framer-motion`
- `tailwindcss` / `postcss` / `autoprefixer`
- backend PDF stack (`puppeteer`, `pdf-parse`, `exceljs`)

`jspdf` appeared only in `frontend/package.json`, the lockfile, and a Vite `manualChunks` rule. No `src`, test, or script import. The manual chunk rule was removed. The production build after uninstall succeeded, which also recompiled SCSS with `sass-embedded` only.

## Frontend optimizations

### Home lazy loading

`RootRedirect` dynamically imports `pages/Home.jsx`. Register, institution register, institution login, and universities login are route-level lazy pages. Direct preview loads succeeded for `/`, `/login/student`, `/register`, and unauthenticated `/admin/users` (redirects to `/portals`).

`index.html` modulepreloads no longer include `framer-motion` or `react-icons`. A fresh load of `/portals` downloaded only the entry graph. A fresh load of `/` downloaded `Home-*.js`, `Home-*.css`, `framer-motion`, and `react-icons`. A fresh load of `/login/student` downloaded `framer-motion` and did not download `Home-*`. Auth pages still use Framer Motion. That is intended.

### Framer Motion

The library stays. Landing motion and approved auth motion are unchanged. The library is isolated to the lazy chunks that import it. Entry gzip no longer includes its 42,041 bytes.

### Tailwind

The earlier “Tailwind in the initial download” finding is **generated CSS**, not a Tailwind runtime JavaScript package. `landing-tailwind.css` is imported by `Home.jsx` only. After Home became lazy, that CSS moved from the entry stylesheet into `Home-NAXDmOID.css` (69,948 bytes, gzip 12,393). Entry CSS fell from 466,201 bytes (gzip 73,530) to 396,254 bytes (gzip 61,706). No Tailwind package is in the JS preload list. No Tailwind config change was made.

### Users

`UsersListPage` requests `page_size: 20` with server `search`, `status`, `role`, `email_verified`, and `university_id`. Search is debounced 350 ms through the existing `useDebouncedValue` hook. Filters reset to page 1 after the first render. Stats, activate-all, and verify-all use server aggregates (`meta.total`, `status_counts`, `email_verified_count`, `role_counts`) and do not send the current page’s ids. Response shape stays `items` + `meta` (`page`, `page_size`, `total`, `total_pages`). The API already paginated; the client had been asking for 500 rows and filtering search locally.

### Analytics live stream

While `liveStatus === 'sse'`, both the live query and the command-center overview `refetchInterval` are `false`. On `EventSource` error, status becomes `polling` and both intervals return to 30 seconds. Reconnect sets status back to `sse` and clears the intervals. `connect()` returns early when an `EventSource` is already `CONNECTING` or `OPEN`. Unmount and tab-hide close the socket and clear the timer. The filters query has no interval.

## Backend optimizations

Query counts below are structural, from the code paths. They were **not** measured by running the queries on a database. Round-trip estimates use the audit’s ~488 ms `SELECT 1` p50 and are labeled estimates. This phase does not change Paris → `us-east-2` latency.

| Operation | Records | Before | After | Reduction | Estimated RTT |
| --- | --- | --- | --- | --- | --- |
| Field-training analytics by university | N universities | N `count` queries | 1 `findMany`, counted in memory | N → 1 | ~N×488 ms → ~1×488 ms |
| University enrollment overview | N universities | 1 university read + 2N (enrollments + recognition) | 3 (universities, enrollments, recognition `groupBy`) | 1+2N → 3 | ~2N×488 ms → ~3×488 ms |
| Cohort attendance recalculation reads | N enrollments | N record reads | 1 `findMany` for all students/sessions | N → 1 | ~N×488 ms → ~1×488 ms |
| Field-training attendance upsert | N records | N sequential upserts | 1 `INSERT … ON CONFLICT` | N → 1 | ~N×488 ms → ~1×488 ms |
| Completion-letter revocation | N issued letters | N updates + N audit inserts | 1 `UPDATE … FROM (VALUES)` + 1 `createMany` audit | 2N → 2 | ~2N×488 ms → ~2×488 ms |
| Qualification persistence reads | N applications | N full context loads | 1 `loadBatchContext` | N → 1 | ~N×488 ms → ~1×488 ms |
| Student notification create | N recipients | N inserts | 1 `createManyAndReturn` (plus 1 `findMany` when dedupe is on) | N → 1 or 2 | ~N×488 ms → ~1×488 ms |

Attendance percentage formula is unchanged: present, late, and excused count; `Math.round((score / total) * 10000) / 100`. Score weights are still read from the canonical policy (`attendance`, `postAssessment`, `tasks`, `professionalEvaluation`). PRE remains non-scored because this phase does not touch the scoring module.

Writes that still happen once per row, because each row’s stored value differs:

- attendance percentage `enrollments.update` inside the existing batch transaction
- qualification `persistApplicationEligibility` / snapshot
- letter application `completion_letter_issued_at` update

Attendance upsert dedupes by `applicationId` (last write wins) and does not update `student_id` on conflict. Letter revocation still merges prior metadata, sets status `revoked`, and writes the same audit action. Notification batching dedupes user ids and keeps the same title, body, type, and action URL. Staff notifications that use a different URL per recipient were left as individual creates.

The two raw SQL statements (attendance upsert and letter revocation) were syntax-checked with `node --check` and were **not** executed on PostgreSQL.

`listUsers` adds `status_counts` and `email_verified_count` on the same `where` clause. No Prisma migration and no new index were created. A future trigram index on user search is optional and was not added.

## Asset optimization

| Asset | Before | After | Notes |
| --- | --- | --- | --- |
| `eprojecto-logo` | PNG 324,226 bytes, 894×530 | WebP 51,300 bytes, 640×379 | 84.2% smaller. Alpha kept. Display size is well below 640 px. Original `src` PNG kept. Public Open Graph PNG resized to 53,765 bytes. |
| Ministry of Youth | PNG 33,810, 415×373 | WebP 19,330, 360×324 | Rendered card 180×180 |
| Tafila Technical University | PNG 270,470, 363×455 | WebP 37,648, 360×451 | Rendered card 180×180 |
| Mutah University | PNG 95,273, 394×382 | WebP 13,134, 360×349 | Rendered card 180×180 |
| Al-Zaytoonah University | PNG 68,211, 189×187 | WebP 10,614, 189×187 | Already near display size |
| Yarmouk University | PNG 88,072, 285×319 | WebP 13,322, 285×319 | Rendered card 180×180 |
| Partner total | 555,836 bytes | 94,048 bytes | 83.1% smaller |

Active partners are imported from `src/assets/partners`, so Vite emits hashed files such as `ministry-youth-transparent-QBm9pikp.webp`. Public PNG originals used by the background-removal script were left in place. Backend report logo, Sakkal Majalla fonts, Mutah DOCX templates, stamps, and completion-letter assets were not modified.

Local preview confirmed the logo decoded at 640×379 and all five partner WebP files decoded after scroll.

## Hashed caching

Imported images are content-hashed under `/assets/`. `frontend/nginx.conf` and `deploy/nginx-eprojecto.com.conf` already send `Cache-Control: public, max-age=31536000, immutable` for `/assets/` and `no-cache` for `index.html`. Those files were not edited.

Production Nginx change required for this phase: **no**, if production already matches those files. Do not put a year-long cache on `/eprojecto-logo.png`; that path stays the unhashed Open Graph image.

## QA cleanup

Removed 71 generated files (traces, videos, screenshots, Playwright raw output), 57,276,512 bytes, then restored `qa-artifacts/performance/screenshots/README.txt` (an audit note, not a binary). 70 generated files remain deleted in the working tree and are unstaged. `.gitignore` now ignores:

- `qa-artifacts/field-training/traces/`
- `qa-artifacts/field-training/videos/`
- `qa-artifacts/field-training/screenshots/`
- `qa-artifacts/field-training/playwright-raw/`
- `qa-artifacts/**/*.webm`
- `qa-artifacts/**/*.zip`

Authored markdown, fonts, templates, stamps, and migrations were not removed.

Tracked files still on disk: 2,217 files, 22,568,607 bytes. Those files plus the removed 57,276,512 bytes put the previous working tree near **79.8 MB**. After cleanup it is **22.6 MB**. Git object size does not shrink until a commit and prune, which were not done.

## Before / after frontend build

Baseline was the production build taken before the frontend edits. After is `vite build` on 10 Oct 2026, 20.68 s, exit 0.

| Measure | Before | After |
| --- | --- | --- |
| `dist` total | 6,147,762 | 5,703,590 |
| All JS | 3,353,870 | 3,359,202 |
| All CSS | 466,201 | 466,202 |
| Entry JS raw / gzip | 761,197 / 210,290 | 577,540 / 160,398 |
| Entry CSS raw / gzip | 466,201 / 73,530 | 396,254 / 61,706 |
| Authenticated initial JS gzip (modulepreload sum) | 348,754 (includes Framer 42,041 and react-icons 2,043) | 254,777 |
| Home JS | inside the entry | 44,449 raw / 11,518 gzip, plus CSS 69,948 / 12,393 |
| Framer Motion in `index.html` | yes | no |
| `AdminFieldTrainingManagePage` | ~249 KB raw (prior audit dist) | 254,967 raw / 64,193 gzip |
| Recharts | separate chunk, not initial | 407,723 raw / 117,942 gzip, not initial |

Authenticated initial gzip is the sum of the JS files `index.html` modulepreloads. Home, Framer Motion, and react-icons are extra requests only on the routes that import them.

## Tests

| Suite | Result |
| --- | --- |
| Frontend `npm run build` | PASS |
| Frontend typecheck | No script. Production build is the check. |
| Frontend `npm run test:unit` | 199 passed, 2 failed. Both failures are in `tests/fieldTrainingEvaluation.ui.test.js` (`hides the native file chooser…` and its parent). That file was already failing before this phase and was not edited. |
| Backend `node --check` on every module edited in this phase | PASS |
| Backend typecheck | No `tsc` script. |
| Backend `npm run test:unit` | 1,184 tests: 1,182 passed, 1 failed, 1 skipped. Failure: `fieldTraining.completionLetters.supervisorExcel.unit.test.js` PDF Arabic glyph assertion, previously reported and not in the files this phase changed. Skip: `GET /health/ready` because `DATABASE_URL` was set. |
| Backend integration | Not run. |
| Docker image build | Not run. |
| Docker Compose smoke | Not run. Local `.env` points at production Neon. |

## Browser checks (local `vite preview` on 127.0.0.1:4173)

Preview serves the built files and does not proxy `/api`, so no login or write was submitted.

| Check | Result |
| --- | --- |
| `/` | Landing rendered. Logo and five partner WebP files loaded. Landing stats show placeholders because no local API is running. |
| `/login/student` direct load | Login form rendered. Framer Motion loaded. Home chunk did not. |
| `/register` direct load | Register form rendered. University list stays on “loading” because `/api` is absent. |
| `/admin/users` signed out | Redirected to `/portals`. Entry graph only. No Home chunk, no Framer, no user-list request. |
| Horizontal overflow at 375, 768, 1024, 1440 | `documentElement.scrollWidth` did not exceed the viewport. |
| Dashboard, Analytics, Field Training management, course assignment | Not exercised while signed in. Signing in through the local API would use production Neon. |

No uncaught `ReferenceError` and no broken lazy chunk were observed on the routes above. The landing-stats request fails locally because the API is not running. That is an environment limit, not a missing chunk.

## Known limitations

- Paris application server to Neon `us-east-2` remains. Code changes cannot remove the ~488 ms database RTT. Fewer queries reduce how many times that RTT is paid. Those figures are estimates.
- Attendance upsert SQL and letter-revocation SQL have not been executed on PostgreSQL.
- Qualification and attendance percentage **writes** are still per record.
- Some staff notification loops with per-user action URLs were not batched.
- `persistApplicationEligibility` still reads one application per persisted row.
- Authenticated UI, SSE reconnect, and pagination were not clicked against a safe local database.
- Two pre-existing unit failures remain.
- Accidental read-only production database access happened during backend unit tests.

## Prisma migration

**NONE.** No schema change and no index in this phase.

## Deployment readiness checklist (not executed)

Required in a later, separately approved deploy:

1. Confirm the deploy host and that `DATABASE_URL` for that deploy is intentional.
2. Include the Phase 2A files listed above, plus `frontend/package-lock.json` and the new WebP assets.
3. Do not include a Prisma migration. Do not run `prisma migrate`.
4. No environment variable changes.
5. Rebuild the frontend image or `frontend/dist` from this tree (`npm run build` in `frontend`).
6. Rebuild the backend image or restart the API process so the query changes load. No dependency install change on the backend.
7. Nginx: keep existing `/assets/` immutable caching and `index.html` no-cache. Do not edit `lms.battechno.com` legacy config in this phase.
8. Do not prune Docker cache as part of this optimization.
9. After deploy, check `/` (Home chunk and hashed WebP), a dashboard route (no Home chunk, no Framer preload), `/admin/users` (page size 20 and server search), and Analytics (one EventSource, no 30 s live poll while the stream is open).
10. Rollback: restore the Phase 2A files from `328ee2ec` and the previous frontend/backend build. Do not roll back unrelated uncommitted work blindly. No migration to reverse.

### Commands not executed

```text
ssh 187.55.228.232
git pull            # on the server
docker compose up   # local or production
docker build        # not run
prisma migrate deploy
nginx reload
any copy to /root/LMS
git add / commit / push / tag / merge
```

## Suggested commit message

```text
perf: optimize eprojecto loading, queries and realtime requests
```
