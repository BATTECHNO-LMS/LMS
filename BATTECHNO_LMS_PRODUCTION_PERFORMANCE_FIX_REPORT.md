# BATTECHNO LMS — Production Performance Fix Report

**Date:** 2026-08-23  
**Production:** https://lms.battechno.com  
**Mode:** Measure first, then fix measured bottlenecks. No rewrite. No business-rule changes. No Prisma migrate reset / db push / DROP / TRUNCATE. No git commit/push.  
**Deploy:** NOT_PERFORMED — SSH to `root@72.61.179.29` returned `Permission denied (publickey,password)`. Origin vs localhost comparison and live Nginx reload were blocked.

---

## Executive summary

Public production measurements show the remaining slowness is **not** “too much JavaScript in the repo.” The live site is still serving the **17 Aug 2026** frontend, **without gzip on JS/CSS**, **without immutable cache headers**, and with **~500–600 ms Neon round-trip** on a trivial `SELECT 1`.

Local cleanup already reduced main JS from 489.8 KB to **437.47 KB** (gzip **141.07 kB**). Production still ships **899 KB uncompressed** main JS (`index-tSzqNN2G.js`). First-visit download of JS+CSS is about **1.3 MB** uncompressed.

This pass implemented:

1. Nginx gzip + hashed-asset caching + HTML/API no-cache (repo configs; not live until deploy).
2. 60s landing-stats cache and removal of the duplicate certificates count.
3. Tab-level loading for trainee and trainer course detail APIs.
4. Notification bell: unread-count only until the dropdown opens.
5. Smaller student-dashboard assessment page size; fewer Google Font weights.
6. Optional `PERF_LOGGING=true` slow-request timing (no secrets).

Production after-numbers cannot be claimed until the stack is deployed.

---

## Root causes found

### Root Cause 1: JS/CSS not gzipped at the public edge

**Evidence:**  
`GET /assets/index-tSzqNN2G.js` with `Accept-Encoding: gzip` returned `Content-Type: application/javascript`, `Content-Length: 899055`, **no `Content-Encoding`**. CSS was the same pattern (~409 KB uncompressed in the prior pass). HTML **is** gzipped, so gzip is enabled but default `gzip_types` is HTML-only.

**Impact:** First visit waits on ~1.3 MB of JS+CSS. With gzip, the local main chunk is ~141 kB.

**Fix:** `gzip_types` including JS/CSS/JSON on `frontend/nginx.conf` and `deploy/nginx-lms.battechno.com.conf`, plus `gzip_proxied any`.

**Result:** In-repo. Production still uncompressed until Nginx/container reload.

### Root Cause 2: No long-lived cache on hashed `/assets/*`

**Evidence:** Hashed JS response had `ETag` and `Last-Modified` but **no `Cache-Control`**. Repeat visits re-download the same 899 KB.

**Fix:** `Cache-Control: public, max-age=31536000, immutable` on `/assets/`. `no-cache` / `no-store` on HTML, `/api/`, `/health`.

**Result:** In-repo. Not live.

### Root Cause 3: Production frontend is stale

**Evidence:** JS `Last-Modified: Mon, 17 Aug 2026 14:50:30 GMT`. Local build entry is `index-BWSuESiV.js` at **437.47 KB**. Production HTML still references the old 899 KB file.

**Fix:** Requires Docker frontend rebuild + deploy (blocked: SSH).

### Root Cause 4: Neon / database network latency

**Evidence (TCP connection reused, so handshake is excluded):**

| Endpoint | TTFB | Notes |
| --- | ---: | --- |
| `GET /health` (no DB) | **176 ms** | Node + proxy |
| `GET /health/ready` (`SELECT 1`) | **786 ms** | + ~610 ms DB |
| `GET /api/v1/public/landing-stats` | **793 ms** (reuse) / **1.72 s** (cold) | Many Prisma counts + visit increment |

Application code cannot remove physical DB RTT. Cold TLS from this workstation adds ~350–550 ms on first request.

**Fix:** Do not claim app optimizations eliminate this. Keep pooled Neon URL helper (`pgbouncer=true` when host matches `/-pooler./`). Live `DATABASE_URL` was **not** inspected (SSH blocked; credentials not printed).

### Root Cause 5: Landing stats does 11–12 Neon queries per homepage view

**Evidence:** `landingStats.service.js` `Promise.all` of increment + counts. Duplicate `countCertificates` / `countIssuedCertificates` (same `status: 'issued'`). Cold TTFB **1.17–1.75 s**.

**Fix:** 60s in-memory cache; one certificates count used for both fields; visit increment still runs (fire-and-forget on cache hit).

**Result:** Code + unit test. Production still uncached until backend deploy.

### Root Cause 6: Trainee/trainer course overview loaded every tab dataset

**Evidence:** `getTraineeProgramDetail` always loaded sessions, tasks, assessments (with attempts + question counts), materials, submissions, attendance, certificate. Frontend called that on mount for every tab. Trainer `getTrainerCourse` always loaded up to 100 sessions, 50 tasks, all assessments, and up to 200 enrollments with progress.

**Fix:** Optional `?sections=` (default `all` = backward compatible). Overview loads core enrollment/program/progress/counts only. Tabs fetch sessions/tasks/materials/certificate/trainees when opened.

**Result:** Code + merge tests. Course tab lazy loading: **PASS** (local). Not measured in production (no QA session, no deploy).

### Root Cause 7: Notification bell fetched list + unread count on every authenticated layout

**Evidence:** `NotificationBell` enabled `useNotifications({ page_size: 8 })` whenever `user` existed, plus unread-count.

**Fix:** List query `enabled` only when the dropdown is open. Badge uses unread-count.

---

## Before measurements

Client: Windows workstation via public HTTPS. Windows curl does not speak HTTP/2 (`--http2` unsupported). Observed protocol: **HTTP/1.1**. Server: `nginx/1.24.0 (Ubuntu)`.

Handshake from this client (typical): DNS ~0.13 s, TCP connect ~0.18–0.31 s, TLS complete ~0.37–0.55 s.

### Public baseline table

| Page/API | Status | TTFB | Total | Size | Notes |
| -------- | -----: | ---: | ----: | ---: | ----- |
| `GET /` HTML | 200 | 0.56–0.82 s cold / this run **0.74 s** | same | 1167 B raw (~541 B gzip) | gzip **yes**; SPA shell |
| University/institution login HTML | 200 | ~0.55 s | ~0.55 s | SPA shell | Same `index.html`; Last-Modified 17 Aug |
| `GET /health` | 200 | cold ~0.59–0.62 s; **reuse 176 ms** | same | 84 B | no gzip (below min length); FAST on reuse |
| `GET /health/ready` | 200 | cold 1.09–2.73 s; **reuse 786 ms** | same | 51 B | VERY SLOW; Neon `SELECT 1` |
| `GET /api/v1/public/landing-stats` | 200 | cold **1.72 s**; reuse **793 ms** | same | 428 B | no gzip; VERY SLOW / SLOW |
| `GET /assets/index-tSzqNN2G.js` | 200 | ~0.76 s | **~1.65–1.72 s** | **899,055 B** | **not gzipped**; no Cache-Control |
| `GET /assets/index-DC376wxl.css` | 200 | ~0.71–0.77 s | **~1.23–1.33 s** | **409,065 B** | **not gzipped** (prior pass) |
| `GET /api/v1/auth/me` | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Dashboard APIs | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Training course list/detail | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Field-training list | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Notifications summary | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Reports summary | — | — | — | — | **BLOCKED — no safe QA authentication** |
| Origin `http://127.0.0.1:8080` vs public | — | — | — | — | **BLOCKED — SSH publickey denied** |
| Origin `http://127.0.0.1:4400/health` | — | — | — | — | **BLOCKED — SSH** |

Classification (investigation thresholds):

- **FAST (<200 ms):** reused `/health` (176 ms)
- **SLOW (400–800 ms):** reused landing-stats (793 ms), reused `/health/ready` (786 ms)
- **VERY SLOW (>800 ms):** cold landing-stats (1.72 s), uncompressed JS/CSS transfer, cold `/health/ready`

Authenticated route baseline: **BLOCKED — no safe QA authentication**. No real user state was mutated.

Core Web Vitals: **NOT MEASURED** (no browser profiler / field RUM in this session).

---

## Changes implemented

### Frontend optimizations

- Notification bell no longer fetches the 8-item list until the panel opens.
- Trainee course detail: initial `sections=overview`; tab fetch for sessions / materials / tasks / certificate; tab-level spinner.
- Trainer course detail: initial `sections=overview`; tab fetch for sessions / trainees; managers still load lectures/tasks/assessments themselves.
- Student dashboard assessments `page_size` 100 → **30**.
- Google Fonts: drop Tajawal 300/800/900; keep 400–700 with `display=swap` (already in the CSS2 URL).
- `xlsx` / `recharts` remain route/feature chunks. Production **built** `index.html` does **not** modulepreload them. Live production HTML still preloads the old 899 KB bundle (stale deploy).
- Merge helpers so overview responses do not wipe already-loaded tab arrays.

### Backend / API optimizations

- `GET /api/v1/public/landing-stats`: 60s cache; one certificates query; visit increment preserved.
- `GET .../trainee/programs/:programId?sections=`
- `GET .../trainer/courses/:programId?sections=`
- Default omitted `sections` remains full payload (compatibility).
- `PERF_LOGGING=true` logs method + path + status + ms for requests ≥400 ms. No query string, cookies, JWT, or bodies.
- `countPendingEnrollments` left as two queries: Prisma `enrollments` has **no** `cohorts` relation, so a nested `where` would throw.

### Prisma / query optimizations

- Landing stats: 12 parallel queries → cache hit is increment-only; miss is 11 queries (duplicate certificate count removed).
- Trainee overview: enrollment + progress + trainer count (no sessions/tasks/assessments/materials/certificate until those tabs).
- Trainer overview: assignment, program, cohorts, counts — not 200 enrollments / session lists.
- No verbose Prisma query log enabled for production.
- No N+1 loops added. Prior batched report queries were not reintroduced.

### Database indexes

**None added.** No production `EXPLAIN ANALYZE` was possible without SSH. Adding generic `(organization_id, status)` indexes without query evidence was refused.

Existing relevant indexes already present (examples): `idx_training_enrollments_cohort_status`, `idx_enrollments_cohort_id`, `idx_enrollments_student_id`.

### Neon findings

- Repo helper `prismaPoolUrl.js` sets `pgbouncer=true` when the host matches `/-pooler./`, plus `connection_limit` / `pool_timeout` / `connect_timeout`.
- Live pooled vs direct URL: **NOT VERIFIED** (SSH blocked). Credentials not printed.
- Measured DB RTT from the public edge: **~610 ms** (`ready` − `health` on reuse). That floor applies to every Prisma round-trip.

### Nginx findings

Live headers:

- HTML: gzip **on**
- JS/CSS/JSON: gzip **off**
- Hashed assets: no `Cache-Control`
- API: not publicly cached (no `Cache-Control` observed; good, but uncompressed)
- Protocol: HTTP/1.1 from this client

Repo updates (not live):

- `gzip_types` for JS/CSS/JSON/SVG
- `/assets/` immutable cache
- HTML `no-cache`; `/api/` and health `no-store`
- `listen 443 ssl http2` in the host site file

---

## Production deployment

**NOT_PERFORMED.**

```text
ssh orderzhouse → Permission denied (publickey,password)
```

No Docker rebuild, no Nginx reload, no volume prune, no migrate reset. `.env`, uploads, SSL, and database were not touched.

To apply later (operator, not this session):

1. Backup current host Nginx site; copy `deploy/nginx-lms.battechno.com.conf` gzip/`/assets/` locations only; `nginx -t`; reload.
2. Rebuild `frontend` + `backend` images from `/root/BATTECHNO_LMS` with existing compose; do not prune volumes.

---

## After measurements

Production after-table cannot be filled with new numbers: the live origin is unchanged.

| Page/API | Before | After | Change | Result |
| -------- | -----: | ----: | -----: | ------ |
| Homepage HTML | ~0.74 s TTFB (this client) | same live origin | none live | NOT_DEPLOYED |
| Main JS transfer | 899 KB uncompressed | still 899 KB live | none live | NOT_DEPLOYED |
| Local main JS build | 437.42 KB (cleanup) | **437.47 KB** (gzip 141.07 kB) | ~unchanged | PASS |
| `/health` reuse | 176 ms | not redeployed | — | NOT_DEPLOYED |
| `/health/ready` reuse | 786 ms | not redeployed | Neon RTT remains | NOT_DEPLOYED |
| landing-stats cold | 1.72 s | code cached 60s | pending deploy | NOT_DEPLOYED |
| Course overview payload | full tab datasets | sections=overview | pending deploy | NOT_DEPLOYED |

Local verification (this machine):

| Check | Result |
| --- | --- |
| Prisma validate | PASS |
| Backend `node --check` on touched modules | PASS |
| Backend unit tests | **703 pass / 1 skipped / 0 fail** |
| Frontend unit tests | **80 pass / 0 fail** |
| Frontend production build | PASS |
| xlsx/recharts in initial HTML | not preloaded |

---

## Remaining bottlenecks

1. **Production not updated** — gzip, cache headers, smaller bundle, landing cache, and tab APIs have no live effect until deploy + Nginx reload.
2. **Neon RTT ~600 ms** — every DB-backed API has a physical floor; pooling helps connection churn, not speed of light.
3. **Student dashboard still fans out ~9 React Query calls** in parallel (not a sequential waterfall). Payload reduced for assessments only.
4. **Auth `loadCurrentAuthContext` on every authenticated request** — kept for security; not skipped.
5. **`trainingPrograms.service.js` and admin course detail** still large; further splits are architecture, not this pass.
6. **HTTP/2** configured in the repo host file; live still HTTP/1.1 from this client until Nginx reload.
7. **Authenticated API timings** still unknown without a safe QA session.
8. **No new indexes** until `EXPLAIN` can be run on the real slow SQL.

---

## Tests added

- `backend/tests/courseDetailSections.unit.test.js`
- `backend/tests/landingStatsCache.unit.test.js`
- `frontend/tests/mergeCourseDetail.test.js`

Authorization, pagination shapes, and trainer/trainee access checks were not removed.

---

## Suggested commit message

```text
perf: optimize LMS runtime, API queries and production delivery
```
