# EPROJECTO — Full Performance, Codebase & Production Cleanup Audit

**Phase:** 1 only (discover, measure, classify, recommend). No fixes were implemented.
**Date:** 2026-10-10
**Product:** eprojecto
**Canonical URL:** https://eprojecto.com (verified, HTTP 200)
**Application root:** `/root/BATTECHNO_LMS` (verified)
**Server:** `srv1829646` at `187.55.228.232` (Hostinger, Paris / Europe/Paris)
**Database:** Neon PostgreSQL, pooled (`-pooler`), region hint `us-east-2`

Suggested future commit message only (not committed): `perf: optimize eprojecto performance and remove verified dead assets`

---

## 1. Executive Summary

### What are the top 5 actual causes of slowness?

1. **Database distance.** The app runs in Paris. Postgres runs on Neon in **us-east-2** (Ohio). From inside the backend container, `SELECT 1` took **487–488 ms** on four samples and **1443 ms** on one (p50 **488 ms**). `/health` on the server itself is **29 ms**. `/health/ready` (one `SELECT 1`) is **~530 ms**. From this network, `/health` was **~250 ms** and `/health/ready` was **~740 ms**. Almost every API call pays that round trip at least once.
2. **Auth multiplies that round trip on a cache miss.** Each authenticated request loads the user, roles, and reviewer assignment from the database. A 15-second in-process cache avoids repeat lookups. A cold request is one parallel wave of queries (~0.5 s) and sometimes a second wave (~1 s) before the handler runs.
3. **The public homepage is inside the first JavaScript download for every route.** `RootRedirect` statically imports `Home`, so login and dashboards download the landing page, Framer Motion, both icon libraries, and the Tailwind stylesheet before any page-specific code. Production initial transfer is about **342 KB of gzip JS + 72 KB of gzip CSS**, then a **324 KB PNG logo** and about **543 KB of partner PNGs**.
4. **Those images are not long-cached.** Hashed files under `/assets/` are `Cache-Control: public, max-age=31536000, immutable` and gzip-compressed. `/eprojecto-logo.png` and `/partners/*` are served from `location /` with `Cache-Control: no-cache`. The logo response was **324,226 bytes**, uncompressed, revalidated every time.
5. **A few admin and report code paths query the database once per row.** Confirmed in analytics-by-university, cohort attendance recalculation, attendance upserts, completion-letter revocation, qualification persistence, and per-student notifications. The database is only **77 MB**, so these hurt because each query waits ~0.5 s, not because the tables are huge.

### How much of the issue is frontend?

The first view is heavy: roughly **0.9 MB** before images finish (JS + CSS + logo) and about **1.4 MB** once the five partner logos load. After the first visit, hashed JS/CSS can stay cached. The logo and partner PNGs cannot. Authenticated screens then wait on the API. Frontend work is real on first load and on the field-training manage screen (249 KB route chunk). It is not the reason a dashboard feels slow after the bundles are cached.

### How much is backend/database?

Most of the wait after the first load. A ready check is ~500 ms slower than a liveness check, and that gap matches the measured `SELECT 1`. Extra sequential queries add more half-second steps. Table size is not the bottleneck.

### Is repository clutter affecting runtime?

**No.** Tracked QA traces, videos, and screenshots are about **55 MB of 76 MB** of tracked files. They are not imported by the app and are not in the frontend image. Deleting them would shrink the git checkout. It would not make the site faster.

### What can likely be cleaned safely?

Nothing in this audit meets the bar for `SAFE_TO_DELETE`. The lowest-risk cleanup is **Docker build cache** (`docker system df` reports **4.7 GB reclaimable**). That does not change running containers, but it was not deleted. Unused partner source PNGs and the old LMS logo are review-first, not safe-to-delete.

### What must NOT be touched?

Prisma migrations, official Mutah evaluation templates, completion-letter stamp/logo, PDF fonts, running images for the other sites on this VPS (gigzhouse, mazare3, Jeeran), deployment backups, and `storage/uploads` (including private report ZIPs). Internal names `battechno-lms-*` are the live Docker names. Renaming them is not a performance fix.

### What should be fixed first?

Move or place the database nearer Paris (or put a pooler in-region), then stop putting the landing page in the entry bundle, then give the logo and partner images immutable caching and smaller files. Query batching is next, on the confirmed per-row paths.

---

## 2. Audit Scope

Read-only inspection of the local repository, the production host, Docker, Nginx, public HTTP headers, and database metadata.

Measured with a few single requests. No load test, no `EXPLAIN ANALYZE`, no migrations, no deploys, no Docker prune, no git writes.

**Side effect:** one GET to `https://eprojecto.com/api/v1/public/landing-stats` (404-byte JSON, 416 ms). That endpoint increments the public visit counter, including on a cache hit. Treat the landing visit counter as **+1** from this audit. No other data was written. Schema was not changed.

Authenticated pages were **not** opened in a browser. No user session was used. Dashboard and field-training request counts below are from source, not a HAR.

Local git `HEAD` is `328ee2ec3d8ac98e9d38e422cc9365d978be41f6` on `main`.
Production git `HEAD` is `eda9923f5b5d5633f7e24cc03a819d18c69bc1a4` on `main`, with **54** dirty working-tree lines. The frontend image was built **4 days** before this audit (`Last-Modified` of `/` is `Tue, 06 Oct 2026 11:25:15 GMT`). Deployed bytes are not a clean checkout of either SHA.

---

## 3. Current Architecture

| Piece | What it is |
|---|---|
| Frontend | Vite + React 18 SPA (`frontend/`). Nginx in the container serves `dist` and proxies `/api` to the backend. |
| Backend | Express API (`backend/`), Prisma 6, one Node process. |
| Database | External Neon Postgres. No Postgres container. Pool via `applyPrismaPoolParams`: `connection_limit=25`, `pool_timeout=20`, `pgbouncer=true`. |
| Files | `./storage/uploads` mounted into the backend. Private bulk ZIPs are blocked from static `/uploads`. |
| Edge | Host Nginx terminates TLS for `eprojecto.com` and proxies to `127.0.0.1:8080`. |
| Other sites on the same VPS | gigzhouse, mazare3, jeeran.battechno.com, and a legacy `lms.battechno.com` server block. They are not part of this app and were not modified. |
| Mobile | `mobile/battechno_lms_app` (Flutter). Not in the web request path. |

Route pages are `React.lazy` in `frontend/src/app/router/lazyPages.js`. The exception that matters: `frontend/src/components/common/RootRedirect.jsx` imports `pages/Home.jsx` directly, and the router imports `RootRedirect` directly. `Home.jsx` imports `landing-tailwind.css`, Framer Motion, and `react-icons`.

Prisma schema: **138 models**, **348** `@@index`, **55** `@@unique`. Live database: **141 tables**, **617 indexes** (includes primary keys).

---

## 4. Performance Baseline

Methodology:

- Server disk, Docker, and git: SSH read-only commands on 2026-10-10.
- DB latency: five `SELECT 1` calls from `battechno-lms-backend` through the existing Prisma client. No `EXPLAIN ANALYZE`.
- Public HTTP: 3 samples of `/health` and `/health/ready` from this machine, 5 samples of the same URLs from the server to itself, plus one landing-stats GET.
- Bundle sizes: production `index.html` modulepreload list, transferred with `Accept-Encoding: gzip`. Raw sizes are from the local `frontend/dist` build (same vendor chunk names for several libraries; the entry hash differs).

| Metric | Current |
|---|---|
| Initial JS (production, gzip, 8 modulepreload files) | **350,353 bytes (~342 KB)** |
| Initial CSS (production, gzip) | **73,939 bytes (~72 KB)** |
| Largest initial file | `index-mi_Y-ehu.js`, **210,727 bytes** gzip |
| Largest raw JS chunk (local dist) | `index-*.js`, **743 KB**; next vendor `recharts` **398 KB** (not in the initial graph) |
| Largest route chunk (local dist) | `AdminFieldTrainingManagePage` **249 KB** |
| Homepage HTML | **2,644 bytes** |
| Homepage logo | **324,226 bytes**, `Cache-Control: no-cache` |
| Partner logos actually rendered | **~543 KB** (5 PNGs) |
| Largest image file | `eprojecto-logo.png` **324 KB** (also copied under `frontend/src`, `frontend/public`, and `backend/assets`) |
| Largest web-font subset | IBM Plex Sans Arabic woff2 **~43–46 KB** per weight |
| Largest font file on disk | `SakkalMajalla-Bold.ttf` **412 KB** (PDF reports, not the website) |
| Initial request count | **NOT MEASURED in a browser.** Entry graph is 1 HTML + 8 JS + 1 CSS, plus fonts, logo, 5 partner images, favicon, and `GET /api/v1/public/landing-stats` |
| `/health` from server | **29–34 ms** (after warm-up), HTTP 200 |
| `/health/ready` from server | **529–625 ms**, HTTP 200 |
| `/health` from this network | **236 / 255 / 255 ms** |
| `/health/ready` from this network | **745 / 743 / 734 ms** |
| `SELECT 1` from the API container | min **487 ms**, p50 **488 ms**, max **1443 ms** (n=5) |
| Landing stats | one sample **416 ms**, 404 bytes, HTTP 200 |
| API p50 / p95 for authenticated routes | **NOT MEASURED** (no session, no load test) |
| Database size | **77 MB** (`80,601,088` bytes) |
| DB connections on that database | **5** total (1 active, 4 idle) |
| Repo tracked files | **2,287** files, **~76 MB** working tree bytes |
| Local checkout including `node_modules` | frontend `node_modules` **323 MB**, backend `node_modules` **475 MB**, `.git` **72 MB** |
| Production app tree | `/root/BATTECHNO_LMS` **208 MB** (includes `.git` 61 MB, `qa-artifacts` 56 MB, `storage` 63 MB) |
| Production disk | **16 GB used / 193 GB** (9%) |
| Docker images | **6 images, 6.1 GB**, all in use, **0 B** reclaimable |
| Docker build cache | **6.5 GB**, **4.7 GB** reclaimable |
| Nginx logs | **~8 MB** |
| eprojecto container logs | frontend **1.1 MB**, backend **3.3 MB** |
| `/root/deployment-backups` | **104 MB** (mostly other products) |

No "After" column. This table is the Phase 2 baseline.

---

## 5. Frontend Findings

### Bundle

`frontend/dist/index.html` (and the live `index.html`) modulepreloads:

| File | Production gzip transfer |
|---|---|
| `index-mi_Y-ehu.js` | 210,727 |
| `react-vendor-*.js` | 46,007 |
| `framer-motion-*.js` | 42,372 |
| `index-*.css` | 73,939 |
| `i18n-*.js` | 16,330 |
| `tanstack-query-*.js` | 13,584 |
| `lucide-*.js` | 10,673 |
| `react-router-*.js` | 8,615 |
| `react-icons-*.js` | 2,045 |

`vite.config.js` splits `xlsx`, `jspdf`, `recharts`, `framer-motion`, `lucide`, and TanStack into manual chunks. **xlsx and recharts are not in the initial graph.** `jspdf` has **no import** under `frontend/src`.

Local dist: **318 JS files, 3.35 MB** raw. Production container: **329 assets, 7.0 MB** total html root, **0 source maps**.

### Why the entry is large

`Home` is not lazy. It pulls Tailwind (`landing-tailwind.css` with `content: ['./src/**/*.{js,jsx}']`), Framer Motion, and `react-icons` into the first load of every route. Lucide is also preloaded because shared chrome imports it. Two icon libraries are real, but `react-icons` gzip is only 2 KB, so the duplicate library is not the main cost. Framer Motion (42 KB gzip) is.

### Routes

Admin, field training, analytics, courses, reports, and recorded lectures are already `lazy()`. Opening field training still downloads a **249 KB** manage-page chunk (raw). Analytics charts pull **recharts (398 KB raw)** only on those routes.

### Requests (from source, not a HAR)

| Surface | On load |
|---|---|
| Homepage | landing stats (one shared promise), font CSS, logo, 5 partner images |
| Admin dashboard | `useAdminDashboardStats` (one query) plus the shell |
| Field training list | list + stats + specialties + instructors (**4 queries**). Eligibility catalog runs only while the create modal is open |
| Command center | overview every **30 s**, filter query, live query every **30 s** unless SSE is up, plus an `EventSource` |
| Notification bell | unread count every **60 s** on authenticated shells. The list query runs only when the menu is open |
| Attendance windows (student) | **30 s** idle, **12 s** while a window is open, paused when the tab is hidden |
| Attendance manage tab | **5 s** only while a window status is `open` |
| Bulk report job | **1.5 s** only while status is `queued` or `processing` |
| Lecture heartbeat | **10 s** while a lecture is being watched |

### TanStack Query

`frontend/src/lib/queryClient.js`:

- `staleTime`: **60 s** (`STALE.list`)
- `gcTime`: **10 min**
- `refetchOnWindowFocus`: **false**
- `retry`: up to 2, **never** on 4xx except 408, **never** on 429
- `refetchOnReconnect`: true

Defaults are already conservative. The 30-second command-center overview poll still runs while SSE is connected (`useCommandCenter.js`). That is the clearest extra polling.

### Rendering

No evidence of a 5,000-row client table in the paths inspected. Users list requests `page_size: 500` (`UsersListPage.jsx`). The API allows **500** (`ADMIN_MAX_PAGE_SIZE`). `users` is about **624** rows, so one or two requests load most of the table. That is "large page" rather than "fetch everything with no limit". It will get worse as users grow. Cohort view requests `page_size: 200` for a user picker.

`React.StrictMode` is on in `main.jsx`. Double effects apply in development, not in the production build.

---

## 6. Backend Findings

### Auth

`auth.middleware.js` verifies the JWT, then `loadCurrentAuthContext`. The JWT's roles are not trusted.

On a cache miss, `loadCurrentAuthContextFromDb` runs in parallel:

1. `users.findUnique` including active organization assignments
2. `user_roles.findMany`
3. `reviewer_university_assignments.findFirst`

Then, in parallel when needed: role rows, university identity, permission codes. Role and permission catalogs are cached **60 s**. University and organization identity are cached **60 s**. The full auth snapshot is cached **15 s** (`authContextCache.js`, TTL clamped 5–60 s, max 2,000 entries).

So a busy user does not hit the database on every click. The first click after 15 seconds of quiet does, and that click waits on Ohio.

### Confirmed per-row database work

| Class | Where | Pattern |
|---|---|---|
| CONFIRMED_N_PLUS_1 | `analytics.repository.js` ~line 821 | `field_training_applications.count` inside `for (const row of byUniversityRows)` |
| CONFIRMED_N_PLUS_1 | `analytics.repository.js` ~line 261 | `enrollments.findMany` inside `for (const uni of universities)` |
| CONFIRMED_N_PLUS_1 | `attendance.service.js` `recalcCohortAttendancePercentages` | `findRecordsForSessionsAndStudent` per enrollment, then a batched `update` transaction |
| CONFIRMED_N_PLUS_1 | `fieldTraining.repository.js` `upsertAttendanceRecords` | `field_training_attendance.upsert` per submitted record |
| CONFIRMED_N_PLUS_1 | `fieldTraining.completionLetter.service.js` ~line 227 | `update` plus `recordAudit` per letter |
| CONFIRMED_N_PLUS_1 | `fieldTraining.qualification.service.js` ~line 539 | `persistQualification` per application id |
| CONFIRMED_N_PLUS_1 | `fieldTraining.notifications.js` ~line 170 | `createNotificationForUser` per student |

A scanner also flagged dozens of `for` loops that only touch memory after a query, and many `findMany` calls whose `take` sits more than 25 lines later. Those were **not** classified as N+1. Unbounded-`findMany` count from that heuristic (**505**) is **not** a finding.

### Parallelization already used

Landing stats, the auth snapshot, and several analytics blocks use `Promise.all`. Landing stats on a cache miss runs about **10** aggregate queries in one wave, so it costs about one DB round trip, not ten. The 60-second cache still fires `incrementLandingVisits()` on every homepage view (not awaited on a hit). That is a write to Neon on every visit.

### Reports and uploads

- PDF: Puppeteer + system Chromium (`pdfRenderer.js`). This is why the backend image is **3.25 GB**.
- Excel: ExcelJS in several field-training and analytics exporters. Synchronous, in-process.
- Bulk student ZIP: `fieldTraining.studentReportsBulk.zip.js` batches with `map(async ...)`.
- Uploads: local disk under `storage/uploads` plus S3-compatible R2 (`@aws-sdk/client-s3`). Private export ZIPs are **58 MB** of the **63 MB** upload tree. Not deleted.

### Pagination

List endpoints generally take `page` / `page_size` (default 20, max 100, admin max 500). The risky call found is the users admin list at **500**, and an unverified-email bulk path with `take: 2000` in `users.service.js` (~line 963). That path is an admin action, not a page render.

---

## 7. Database Findings

| Item | Value |
|---|---|
| Size | 77 MB |
| Tables | 141 |
| Indexes | 617 |
| Provider | Neon pooler, `us-east-2` |
| Pool | limit 25, timeout 20 s, pgbouncer on |
| Observed connections | 5 |

Largest tables by `pg_total_relation_size`. Row counts are **`reltuples` estimates**, not exact `COUNT(*)`. A `0` with a non-zero size means statistics are stale, not that the table is empty. `ANALYZE` was not run.

| Table | Estimated rows | Total size |
|---|---|---|
| `field_training_final_evaluations` | 2,255 | 14.1 MB |
| `notifications` | 13,755 | 10.9 MB |
| `audit_logs` | 9,498 | 5.7 MB |
| `field_training_recorded_lecture_watch_segments` | 12,044 | 5.0 MB |
| `files` | 4,202 | 3.8 MB |
| `field_training_assessment_attempts` | 544 | 2.7 MB |
| `field_training_task_submissions` | 920 | 2.3 MB |
| `field_training_applications` | 320 | 1.7 MB |
| `field_training_attendance` | 2,141 | 1.3 MB |
| `attendance_records` | 0 (stale stats) | 1.1 MB |
| `users` | 624 | 0.7 MB |

Growth to watch: `notifications`, `audit_logs`, `field_training_recorded_lecture_watch_segments`. None of them are large enough today to explain a half-second response.

**Indexes:** not enough evidence to call any index unused or missing. `pg_stat_user_indexes` was not sampled, and low `idx_scan` on a quiet system is misleading. No index was created or dropped.

**Query plans:** NOT MEASURED. `EXPLAIN ANALYZE` was avoided.

**Latency cause:** geography. Paris → `us-east-2` is on the order of the measured 488 ms. Connection count is low, so this is not pool exhaustion.

---

## 8. Network/API Findings

| Check | Result |
|---|---|
| `https://eprojecto.com/` | 200, 2,644 bytes, ~29 ms from the server |
| `https://eprojecto.com/login` | 200, same SPA shell, ~26 ms from the server |
| `https://eprojecto.com/health` | 200, no database |
| `https://eprojecto.com/health/ready` | 200, one `SELECT 1` |
| Landing stats | 200, 404 bytes, 416 ms from this network (one sample) |
| Gzip on JS/CSS | **Yes** (`content-encoding: gzip`) |
| Brotli | **Not enabled** |
| Hashed `/assets/` | immutable, 1 year |
| Public PNG/HTML | `no-cache` / `no-cache, no-store` for HTML |

Third parties on the homepage:

- `fonts.googleapis.com` and `fonts.gstatic.com` (IBM Plex Sans Arabic and Tajawal, weights 400/500/600/700, `display=swap`)
- Neon (server-side, not the browser) for landing stats and the visit counter

YouTube is used only by the recorded-lecture player, not the homepage. No browser analytics tag was found in `index.html`.

Failed-request audit (401/404/500 storms): **NOT MEASURED**. No browser console capture was taken.

---

## 9. Assets & Fonts

### Images

Dimensions were **NOT MEASURED** (no decode pass). Sizes:

| File | Size | Used? |
|---|---|---|
| `frontend/public/eprojecto-logo.png` | 317 KB local / **324,226** bytes live | `og:image`. UI logo is the imported copy, which Vite emits as a hashed asset |
| `frontend/src/assets/images/eprojecto-logo.png` | 317 KB | `BrandLogo.jsx` |
| `backend/assets/eprojecto-logo.png` | 317 KB | server-side reports |
| `public/partners/tafila-university-transparent.png` | 264 KB | homepage partner card |
| `public/partners/tafila-tech.png` | 257 KB | only `remove-partner-logo-backgrounds.js` |
| `public/partners/mutah.png` | 102 KB | script source only |
| `public/partners/mutah-university-transparent.png` | 93 KB | homepage |
| `public/partners/yarmouk.png` | 94 KB | script source only |
| `public/partners/yarmouk-university-transparent.png` | 86 KB | homepage |
| `public/partners/al-zaytoonah-university-transparent.png` | 67 KB | homepage |
| `public/partners/zaytoonah.png` | 65 KB | script source only |
| `public/partners/youth-ministry.png` | 52 KB | script source only |
| `public/partners/ministry-youth-transparent.png` | 33 KB | homepage |
| `public/partners/digital-economy.png` | 31 KB | script source only |
| `public/partners/ministry-digital-economy-transparent.png` | 30 KB | **no UI reference found** |
| `src/assets/images/battechno-lms-logo-transparent.png` | 376 KB | no UI import. Tests assert the UI must not use it. Rebrand note said keep the file |
| `src/assets/images/batman-logo.png` | 69 KB | no UI import found |
| `backend/assets/field-training/completion-letter/batman-technology-logo.png` | 138 KB | completion letters |
| `official-company-stamp.png` | 147 KB | completion letters |

Homepage partner bytes that actually render: 264+93+86+67+33 = **543 KB**, all `no-cache`.

SVGs: landing illustrations go up to **248 KB** (`features-dashboard.svg`). Several `*-bro.svg` / `*-amico.svg` files are inputs to `frontend/scripts/prepare-landing-illustrations.js`. The generated files under `src/assets/landing/illustrations/` are what the UI imports. No base64-stuffed SVG audit beyond size. No SVG edits.

### Fonts

Website fonts are not in the repo. They come from Google.

Chrome-like user agent: the CSS lists **22** woff2 subset files totaling **346,712 bytes** if a client downloaded every unicode-range. Browsers do not. The four largest files are **42.8–45.7 KB** (about **178 KB** together) and match IBM Plex Arabic subsets, one per weight. Tajawal subsets are about **9–10 KB**. `font-display: swap` is set. The stylesheet is render-blocking. There is a `preconnect`, not a font preload.

A generic curl user agent was served **TTF** instead (~220 KB × 4 for IBM Plex). Real Chrome receives woff2. Do not judge font weight from a non-browser client.

PDF fonts `SakkalMajalla.ttf` (409 KB) and `SakkalMajalla-Bold.ttf` (412 KB) are report assets. Keep them.

---

## 10. Dependency Audit

### Frontend dependencies (18) and devDependencies (9)

| Package | Evidence | Recommendation | Risk |
|---|---|---|---|
| `jspdf`, `jspdf-autotable` | No import in `frontend/src` or tests searched | Unused candidate. Do not uninstall in this phase | Low, if a dynamic import was missed (none found) |
| `sass` and `sass-embedded` | Both in devDependencies. Vite uses one compiler | Duplicate dev compilers. Build-time only | Low |
| `lucide-react` and `react-icons` | Both used. Both preloaded | Keep. Tree-shaken cost is small (2 KB gzip for react-icons) | — |
| `recharts` | Analytics, training reports, field-training report charts. Separate chunk, not initial | Keep. Lazy-loaded already | — |
| `xlsx` | `analyticsExport.js` only. Manual chunk | Keep | — |
| `framer-motion` | Landing and auth visuals, pulled into the entry via `Home` | Keep the library. Stop loading it on dashboard routes | Medium (motion regressions if landing is split carelessly) |
| `@dnd-kit/*` | Recorded-lecture sort UI only | Keep. Not in the entry preload | — |
| `tailwindcss` | `landing-tailwind.css` imported by `Home` | Keep for landing. It currently rides in the global CSS because `Home` is eager | Medium |
| `sharp` | devDependency, image scripts | Build/tooling. Not a runtime page cost | — |

Installed `node_modules` size was measured (frontend **323 MB**, backend **475 MB**) but not broken down per package. Per-package install size: **NOT MEASURED**.

### Backend

| Package | Role |
|---|---|
| `puppeteer` | PDF. Explains the 3.25 GB image (Chromium is installed in the image via the Dockerfile env `PUPPETEER_EXECUTABLE_PATH`) |
| `exceljs` | Spreadsheet exports |
| `@aws-sdk/client-s3` | R2 uploads |
| `firebase-admin` | Push notifications, loaded when push runs |
| `@google/generative-ai` | `modules/ai/ai.service.js` |
| `pdf-parse`, `mammoth` | Template / document text extraction |
| `prisma`, `@prisma/client` | Database |

No backend package was classified unused. They have call sites.

---

## 11. Repository Cleanup Candidates

Tracked tree is **76 MB**. `qa-artifacts/` is **104 tracked paths** and holds the largest blobs (trace zips of 1–6 MB, webm videos, screenshots). `frontend/dist` is gitignored. `node_modules` is gitignored. **`qa-artifacts/` is not in `.gitignore`.**

Root also tracks a large set of `BATTECHNO_LMS_*.md` audit reports and Tafila JSON/CSV dry runs (the scoring JSON is **735 KB**). Those are documentation and reconciliation artifacts, not runtime.

`.gitignore` already ignores `dist/`, `build/`, `coverage/`, `node_modules/`, `storage/`, `uploads/`, `.env`. It does not ignore `qa-artifacts/`, `*.webm`, Playwright traces, or `test-results/`.

Removing tracked QA media from the index would shrink future checkouts by roughly **55 MB**. Existing git history would still contain the blobs until a history rewrite, which this audit does **not** recommend. Runtime benefit: **zero**.

---

## 12. Production Server Disk Audit

`df -h /`: **16 GB used, 178 GB free, 9%**. Disk is not why the site is slow.

| Path | Size | Note |
|---|---|---|
| `/var/lib/docker` | 5.0 GB | `du` of the docker dir. `docker system df` reports more once build cache is included (see §13) |
| `/root/Jeeran` | 1.0 GB | Another product. Do not clean as part of eprojecto |
| `/root/BATTECHNO_LMS` | 208 MB | This app |
| `/root/.local` | 180 MB | pnpm store and similar |
| `/root/LMS` | 142 MB | Second tree. Ownership not proven. **UNKNOWN** |
| `/root/deployment-backups` | 104 MB | Mixed products |
| `/root/Gigs_House` | 37 MB | Another product |
| `/root/Shark-jo` | 23 MB | Another product |
| `/var/log` | 170 MB | System, not only this app |
| `/root/BATTECHNO_LMS/storage/uploads` | 63 MB | Live uploads. Private exports **58 MB** |
| `/root/BATTECHNO_LMS/qa-artifacts` | 56 MB | Copied with the repo. Not served by Nginx |
| `/root/BATTECHNO_LMS/.git` | 61 MB | |
| `/root/BATTECHNO_LMS/backend/tmp` | 1.9 MB | **UNKNOWN** temp. Not deleted |

A file larger than 40 MB inside this app: `storage/uploads/private/ft-student-report-exports/.../result.zip`. That is an export artifact. **RETENTION_POLICY_REVIEW**.

---

## 13. Docker Audit

All six images are running. **No stopped containers. No volumes.**

| Image | Size | State |
|---|---|---|
| `battechno_lms-backend:latest` | **3.25 GB** | running, healthy, 4 days |
| `battechno_lms-frontend:latest` | **84 MB** | running, healthy, 4 days |
| `gigzhouse-web` / `gigzhouse-api` | 329 MB / 681 MB | other product, healthy |
| `mazare3-api` / `mazare3-web` | 2.07 GB / 412 MB | other product, healthy |

`docker system df`: images 6.147 GB (0 reclaimable), containers 3.2 MB, build cache **6.526 GB** of which **4.726 GB** reclaimable.

Do not remove gigzhouse or mazare3 images. Do not prune volumes (there are none). Build-cache prune is the only large Docker cleanup, and it only makes the next image build slower.

---

## 14. Logs & Backups

**Logs**

- Docker daemon: `json-file`, `max-size=10m`, `max-file=3`.
- eprojecto: frontend log **1.1 MB**, backend log **3.3 MB**. Low risk.
- Nginx: `access.log` 1.9 MB, `access.log.1` 3.6 MB, older files gzipped. About **8 MB** total. Rotation exists.
- `mazare3-api` json log **126 MB**. Another product. Not truncated.

**Backups** (`RETENTION_POLICY_REVIEW`, not safe to delete)

| Path | Size | Likely purpose |
|---|---|---|
| `/root/deployment-backups/gigzhouse-*` (5 dirs) | ~15–24 MB each | Source snapshots of another app |
| `/root/deployment-backups/ft-bulk-reports-*` and `ft-bulk-auth-fix-*` | under 1 MB each | eprojecto field-training deploy file copies |
| `course-task-submissions-*`, `assign-responsive-*`, `task-review-ui-*` | under 1 MB each | eprojecto frontend file copies from 2026-10-06 |
| `eprojecto-rebrand-*`, `eprojecto-20260913-*` | tens of KB | rebrand file copies |
| `/root/BATTECHNO_LMS_DEPLOY_BACKUPS` | 260 KB | older deploy metadata |

No database `.dump` was found. The `.sql` files inside backup trees are Prisma migration copies from gigzhouse, not LMS dumps.

---

## 15. Nginx/Cache Audit

Host config (read via `nginx -T` and the repo file `deploy/nginx-eprojecto.com.conf`):

- `eprojecto.com` is the live name. `www` redirects to it. Port 80 redirects to HTTPS.
- `client_max_body_size 120m` on the eprojecto server. Not `0`.
- gzip **on** for JS, CSS, JSON, SVG. Confirmed by response headers. **No brotli.**
- `/assets/` immutable for one year, on both host Nginx and the container Nginx.
- `/api/`, `/health`, `/health/ready`: `no-store`.
- HTML: `no-cache` (container also sets `no-store` on `index.html`).
- Everything else, including PNGs in `public/`, falls through to `location /` and gets **`no-cache`**.
- A legacy `server_name lms.battechno.com` block is still present. Not removed. It is a hostname alias, not dead code inside the eprojecto image.

Proxy read timeout is **300 s**, which is appropriate for report generation and too generous to hide a stuck request. Not changed.

---

## 16. Security-sensitive observations

No secrets, tokens, or database URLs are included in this report.

- Auth still hits the database so a revoked user is not trusted from the JWT. The 15-second cache is the maximum stale window documented in `authContextCache.js`. Do not lengthen it just to hide Ohio latency.
- `/uploads/private` and bulk-report paths return 404 from static hosting. The private ZIP on disk is not a public URL.
- Production source maps: **none** in the frontend container.
- Visit counter increment on a public GET is a write. It is existing behavior, not a new hole, but it does force a database round trip.
- This VPS runs several products as root. That is an operational risk, not a page-speed finding. Not changed.
- SSH credentials were already present from earlier work. They are not repeated here.

---

## 17. Top Bottlenecks

| Rank | Bottleneck | Evidence | User impact | Likely cause | Suggested fix (Phase 2, not done) | Expected benefit | Risk |
|---|---|---|---|---|---|---|---|
| 1 | DB round trip ~0.5 s | `SELECT 1` p50 488 ms; ready ~530 ms on server vs health 29 ms; Neon `us-east-2`, app in Paris | Every uncached API call | Geography + TLS to Neon pooler | Place Postgres in or near Paris, or a regional pooler | High. This is the wait users feel after assets cache | High if the migration is careless. Needs a plan, backup, and a maintenance window |
| 2 | Auth pays that round trip after 15 s | `loadCurrentAuthContextFromDb` 3 parallel queries, then a second wave; TTL 15 s | First click after a short pause | Cache TTL vs distance | Do not weaken auth. Region move helps more than a longer TTL | High once (1) is done; a longer TTL only hides it | Medium if TTL is raised (stale permissions) |
| 3 | Landing JS on every route | `RootRedirect` imports `Home`; modulepreload includes framer-motion | First visit of login and app shells | Eager import | Lazy-load `Home` so dashboards do not download it | ~42 KB gzip JS plus less CSS parse on non-landing routes | Medium |
| 4 | Uncached oversized PNGs | Logo 324 KB `no-cache`; Tafila partner 264 KB; five partners ~543 KB | Homepage, repeat visits | Files live outside `/assets/` | Emit hashed images, or a long cache on `/partners/` and the logo; resize/WebP later | Hundreds of KB per homepage view | Low if URLs stay stable |
| 5 | Two webfont families × 4 weights | Google CSS, Arabic subsets ~43–46 KB each for IBM Plex | Homepage text | Render-blocking stylesheet | One family, fewer weights, self-hosted woff2 | Tens to ~150 KB and one less blocking CSS | Low/medium (visual change) |
| 6 | Per-row queries | See §6 confirmed list | Analytics, attendance save, letter revoke, notifications | Loops of `await prisma` | Batch with `in` filters / `createMany` / a single `UPDATE ... FROM` | High on those actions only (N × 0.5 s) | Medium |
| 7 | Field-training manage chunk | 249 KB raw route chunk | Opening that admin page | Large page module | Split tabs that are already separate components | Medium on that page only | Low |
| 8 | Command center double refresh | overview `refetchInterval: 30_000` even when SSE is connected | Extra API every 30 s on that screen | Polling left on beside SSE | Poll overview only when SSE is down | One heavy request per 30 s removed | Low |
| 9 | Users list `page_size: 500` | `UsersListPage.jsx`; ~624 users | Admin users page payload | Admin max page size | Server pagination in the UI | Grows with user count. Small today | Low |
| 10 | Homepage visit write | `incrementLandingVisits()` on cache hit | Extra Neon write every page view | Counter | Keep the counter, but don't block, and don't count bots twice. Already unawaited on cache hit | Low compared with (1) | Low |
| 11 | Backend image 3.25 GB | Puppeteer/Chromium | Disk and deploy time, not page TTFB | PDF stack | Not a user-facing speed fix. Keep until PDF is redesigned | Disk/build only | High if Chromium is removed while PDFs still need it |
| 12 | No brotli | gzip only | Small | Nginx | Brotli for JS/CSS | Modest on top of gzip (JS is already 211 KB gzip) | Low |

---

## 18. Cleanup Classification

**SAFE_TO_DELETE:** none. The evidence bar (no imports, no scripts, no deploy references, no templates, no tests) was not met.

**LIKELY_UNUSED_REVIEW_FIRST**

| Item | Size | Evidence | Runtime impact if removed |
|---|---|---|---|
| `frontend/src/assets/images/battechno-lms-logo-transparent.png` | 376 KB | No UI import. Tests forbid using it. Rebrand report said keep the file | None, if nothing outside git references it |
| `frontend/src/assets/images/batman-logo.png` | 69 KB | No import found | None if confirmed |
| Non-transparent partner PNGs in `public/partners/` (`tafila-tech`, `mutah.png`, `yarmouk.png`, `zaytoonah.png`, `youth-ministry.png`, `digital-economy.png`) | ~601 KB | Only named by `remove-partner-logo-backgrounds.js` | None for the homepage. They are still copied into the image because they live in `public/` |
| `ministry-digital-economy-transparent.png` | 30 KB | Not in `home.constants.js` | None if no external link |
| Source SVGs that were copied into `landing/illustrations/` | up to 248 KB each | Referenced by a prep script, not by React imports | None for the running site |
| `jspdf`, `jspdf-autotable` | NOT MEASURED | No source import | None at runtime today (not in the preload graph) |
| Docker build cache | **4.7 GB** reclaimable | `docker system df` | None for running containers. Next build is slower |
| `/root/LMS` | 142 MB | Second directory. Not proven to be unused | Unknown until someone identifies it |

**GENERATED_DO_NOT_COMMIT**

| Item | Size | Note |
|---|---|---|
| `qa-artifacts/field-training/**` traces, videos, screenshots | ~55 MB tracked | Already in git. Runtime impact of removal: **zero**. History rewrite not recommended here |
| `frontend/dist` | 5.9 MB local | Already gitignored |
| `node_modules` | ~800 MB local | Already gitignored. Not on the production app tree (Docker builds its own) |

**LEGACY_BUT_REQUIRED**

- Docker service names `battechno-lms-backend` / `battechno-lms-frontend`
- `lms.battechno.com` Nginx server block until DNS is confirmed dead
- Prisma migrations and baseline scripts
- Mutah `.docx` templates (two files, **293 KB** each; not proven identical)
- Tafila Excel evaluation template
- Completion-letter logo and stamp, including `batman-technology-logo.png`
- `SakkalMajalla` TTF files
- `backend/assets/eprojecto-logo.png` if reports embed it

**KEEP**

- Hashed JS/CSS pipeline, auth cache, query defaults, lazy routes, private upload blocking
- Running images of other products
- `storage/uploads`

**UNKNOWN**

- `/root/LMS` (142 MB)
- `/root/BATTECHNO_LMS/backend/tmp` (1.9 MB)
- Whether the two Mutah docx files are duplicates
- Exact browser font subset download (unicode-range)
- Authenticated page waterfalls

**RETENTION_POLICY_REVIEW**

- `/root/deployment-backups` (104 MB)
- `/root/BATTECHNO_LMS_DEPLOY_BACKUPS` (260 KB)
- `storage/uploads/private/ft-student-report-exports` (58 MB)
- Nginx and Docker logs (already rotated; do not truncate by hand)

---

## 19. Recommended Phase-2 Plan

Order is by user-visible effect, not by how easy the delete is.

1. **Decide the database region.** Measure again after any move: `SELECT 1` p50 from the API container, and `/health/ready` from the server. Target: ready time close to health time (today's gap is ~500 ms). Do this with a backup and a window. Do not do it inside a cleanup PR.
2. **Lazy-load `Home`.** Confirm the dashboard document no longer modulepreloads `framer-motion`. Target: drop that **42 KB** gzip from non-landing loads, and keep landing visually the same.
3. **Cache and shrink public images.** Hashed logo + partner logos, long cache, and smaller files for the 264 KB Tafila PNG and the 324 KB logo. Re-measure homepage transfer.
4. **Batch the confirmed per-row queries** in §6, one path at a time, with the existing unit tests. Re-measure those endpoints only.
5. **Command center:** stop the 30 s overview poll while SSE is healthy.
6. **Users table:** page size aligned with the UI (20–50) instead of 500.
7. **Fonts:** pick one Arabic family and two weights. Self-host woff2.
8. **Repo hygiene (no speed claim):** gitignore `qa-artifacts/`, stop tracking new traces. Optional `git rm` of QA media in a dedicated commit. Do not rewrite history.
9. **Server hygiene (no speed claim):** after a human confirms `/root/LMS` is an old copy, and after a human accepts build-cache prune. Never prune other products' images. Never delete `deployment-backups` or `storage/uploads` without a retention decision.
10. **Dependencies:** remove `jspdf` / `jspdf-autotable` only after another search, and drop one of `sass` / `sass-embedded` only if the production CSS build is unchanged.

Do not add indexes until a specific slow query shows a sequential scan in `EXPLAIN`. The database is 77 MB and the wait is the network.

---

## 20. Risks

- Moving Neon regions can break the pooler host string, in-flight reports, and the 15-second auth cache if two regions run at once. Treat it as a migration, not a cleanup.
- Raising the auth TTL to "make it faster" leaves revoked roles valid for longer. Not recommended as the first fix.
- Deleting the old LMS logo or partner masters can break a script or a letter someone still regenerates. That is why they are review-first.
- `docker builder prune` on this host affects every product's next build, not only eprojecto.
- The production git checkout is **dirty and behind local `main`**. A future `git reset` or `git pull` on the server can wipe deployed files. This audit did not change git on the server.
- One landing-stats GET during this audit incremented the public visit counter.

---

## 21. Measurements Still Needed

| Gap | Why it was skipped |
|---|---|
| Authenticated dashboard / field-training / analytics HAR | No session was used. Would need a real login |
| API p50/p95 for those endpoints | Same, and no load test was allowed |
| `EXPLAIN` for the confirmed N+1 queries | Avoided on production. Cheap to do later on a read replica or with `EXPLAIN` (no `ANALYZE`) |
| Exact `COUNT(*)` | `reltuples` only, to avoid extra scans |
| Image pixel dimensions | Not decoded |
| Which woff2 files Chrome actually downloads | CSS unicode-range was counted; a browser was not |
| Per-package `node_modules` size | Not measured |
| Whether `/root/LMS` is an old deploy | Not proven |
| Console 404/401 inventory | No browser pass |

---

## Final verification

| Check | Result |
|---|---|
| Application source modified | NO |
| Audit report created | YES (`EPROJECTO_FULL_PERFORMANCE_AND_CLEANUP_AUDIT.md` only) |
| Files deleted | NO |
| Packages installed or removed | NO |
| Schema / migrations | NO |
| Database writes | **One public visit-counter increment** via `GET /api/v1/public/landing-stats`. No other writes |
| Nginx changed | NO |
| Docker changed (no prune, no restart, no rebuild) | NO |
| Production deploy | NO |
| Git history changed | NO |
