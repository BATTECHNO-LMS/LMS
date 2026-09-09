# BATTECHNO LMS — Correct Server Performance Audit

**Date:** 2026-08-26  
**Scope:** Diagnosis only. No source, Nginx, Docker, environment, or database changes.  
**Correct production IP:** `187.55.228.232`  
**Production domain:** `https://lms.battechno.com`  
**Wrong server (invalid for this product):** `72.61.179.29`

This report uses only measurements and inspection of `187.55.228.232` plus current repository static analysis. Infrastructure numbers from the previous `72.61.179.29` audit are not reused as evidence.

---

## 1. Executive Summary

BATTECHNO LMS is slow because **every database round trip from the Paris application server to Neon `us-east-2` costs ~500 ms**, and the **currently running production backend still pays that cost sequentially** on almost every authenticated request.

The Node process itself is fast (`/health` ~2 ms locally). PostgreSQL execution of `SELECT 1` is 0.019 ms. The VPS is idle (load 0.08, 13 GiB RAM free, no swap, no OOM, no container restarts). Host Nginx adds ~13 ms, not seconds.

What *does* add seconds:

1. **App → Neon path is HIGH_LATENCY** (warm `SELECT 1` median **499.8 ms**; local `/health/ready` median **500.9 ms**).
2. **Production auth is still sequential** (backend image started **2026-08-19**). A typical authenticated request performs **8–9 serial Prisma queries** before the route handler runs: **~4.0–4.5 s of auth alone**.
3. **Dashboards then fire many authenticated APIs**, each repeating that auth tax. The student dashboard currently starts **10 business APIs** plus layout CMS/unread calls.
4. **Production frontend is outdated** (built **2026-08-17**). Live Nginx inside the frontend container has **no gzip** and **no immutable cache headers**. Main JS is **899 KB uncompressed**. Current repo `frontend/dist` hashes do not match production.

Current git `main` already contains auth parallelization (`3ac9390`, 2026-08-23) and a frontend `nginx.conf` with gzip + hashed-asset caching. **Those fixes are not what production is running.**

**Final verdict: MIXED** — primary **DATABASE_NETWORK_BOUND**, secondary **TOO_MANY_DB_ROUND_TRIPS**, with a real but smaller **NGINX_STATIC_DELIVERY_BOUND** gap on the live frontend.

---

## 2. Correct Server Verification

| Check | Result |
|---|---|
| Target | `187.55.228.232` |
| SSH | Connected as `root` (password auth). Key auth with `id_ed25519` failed; Orderz House/`72.61.179.29` config was not used. |
| Hostname | `srv1829646` (`srv1829646.hstgr.cloud`) |
| Project directory | `/root/BATTECHNO_LMS` |
| Compose project | `battechno_lms` |
| LMS identity | Confirmed: containers `battechno-lms-backend` / `battechno-lms-frontend` |

Same VPS also runs **gigzhouse** (`3100`/`4100`). Those containers were ignored as LMS evidence.

---

## 3. DNS

| Field | Value |
|---|---|
| Domain | `lms.battechno.com` |
| Resolved IP | `187.55.228.232` |
| Expected IP | `187.55.228.232` |
| DNS verification | **PASS** |

External `curl` `remote_ip` for `https://lms.battechno.com/` also returned `187.55.228.232`.

---

## 4. Deployment Map

| Item | Value |
|---|---|
| Project directory | `/root/BATTECHNO_LMS` |
| Compose file | `/root/BATTECHNO_LMS/docker-compose.yml` |
| Frontend container | `battechno-lms-frontend` — `127.0.0.1:8080->80/tcp` — Up 8 days (healthy) — created **2026-08-17T14:53:16Z** |
| Backend container | `battechno-lms-backend` — `127.0.0.1:4400->4000/tcp` — Up 7 days (healthy) — created **2026-08-19T09:50:51Z** |
| Frontend local port | `8080` (host) → `80` (container) |
| Backend local port | **`4400`** (host) → `4000` (container) |
| Backend local URL | `http://127.0.0.1:4400` |
| Host Nginx | Ubuntu nginx/1.24.0 listening on `:80` and `:443`; site file `/etc/nginx/sites-available/lms.battechno.com` |
| Restart counts | backend `0`, frontend `0` |
| OOMKilled | `false` / `false` |

Do not assume ports `4000`, `3007`, or Orderz House ports. LMS host backend port is **4400**.

---

## 5. Server Resources

Measured on `187.55.228.232` (read-only).

| Metric | Value |
|---|---|
| CPU/load | `0.08, 0.02, 0.01` (uptime ~42 days) |
| RAM | 15 Gi total, **1.6 Gi used** |
| Available RAM | **~13 Gi** |
| Swap | **0** (none configured / unused) |
| Disk | 193 G, **8.5 G used (5%)** |
| Backend container memory | **102.4 MiB** / 15.62 GiB (0.64%, CPU 0.00%) |
| Frontend container memory | **5.1 MiB** / 15.62 GiB (0.03%, CPU 0.00%) |
| Container restart counts | **0 / 0** |
| dmesg OOM | none |

**Looked for:** high CPU, memory pressure, swap, disk full, OOM, restarting containers, abnormal load.  
**Result:** none. Containers **HEALTHY**. This is not a server-resource problem.

Recent backend logs contain many `prisma:error Error in PostgreSQL connection: Error { kind: Closed }`. That matches Neon pooler idle disconnects, not RAM exhaustion. Production `db.js` already retries transient disconnects.

---

## 6. Local Backend Benchmark

From **inside** `187.55.228.232`, 20 samples against `http://127.0.0.1:4400/health` (no PostgreSQL). All HTTP 200.

| | ms |
|---|---:|
| min | 1.41 |
| median | **2.07** |
| average | 2.83 |
| p95 | 6.24 |
| max | 7.03 |

**LOCAL BACKEND BASELINE:** Node/Express is healthy. Seconds of user-visible delay are not coming from the Node event loop.

---

## 7. Database Readiness Benchmark

20 samples against `http://127.0.0.1:4400/health/ready` (DB readiness query). All HTTP 200.

| | ms |
|---|---:|
| min | 496.58 |
| median | **500.88** |
| average | 507.63 |
| p95 | 533.21 |
| max | 535.56 |

Implied DB round-trip cost:

`median(/health/ready) − median(/health)` = **500.88 − 2.07 ≈ 498.8 ms**

| | |
|---|---|
| LOCAL BACKEND BASELINE | **2.07 ms** |
| LOCAL READY | **500.88 ms** |
| IMPLIED DB ROUND-TRIP COST | **~499 ms** |

---

## 8. SELECT 1 Benchmark

Ran inside `battechno-lms-backend` using the production Prisma client and runtime `DATABASE_URL` (credentials not printed).

| | ms |
|---|---|
| Cold / first request | **1267.4** |
| Warm min | 498.11 |
| Warm median | **499.76** |
| Warm average | 500.31 |
| Warm p95 | 504.50 |
| Warm max | 504.99 |

Warm samples are extremely tight (498–505 ms). This is a stable path cost, not a one-off cold start.

`EXPLAIN (ANALYZE, BUFFERS) SELECT 1`:

- Planning Time: **0.018 ms**
- Execution Time: **0.019 ms**

**SQL execution: FAST.** The ~500 ms is network/wait time to Neon, not SQL.

---

## 9. Neon Pooling

Inspected runtime environment **without printing secrets**.

| Check | Result |
|---|---|
| Runtime DATABASE_URL uses Neon pooler | **YES** (`host_kind: neon-pooler`) |
| PgBouncer/pooler | **YES** (hostname `-pooler.`) |
| Raw env `pgbouncer=` param | not set on the env string |
| Prisma applies `pgbouncer=true` for pooler hosts | **YES** (`/app/src/config/prismaPoolUrl.js`) |
| `DIRECT_URL` | **NOT_PRESENT** |
| Direct URL used only for migrations | **UNCLEAR** (no `DIRECT_URL`; migrate path not separately configured) |
| `PRISMA_CONNECTION_LIMIT` | `25` |
| `PRISMA_POOL_TIMEOUT` | `20` |
| Prisma runtime pooling | **PASS** |

`new PrismaClient(` appears once in `backend/src/config/db.js` (repo and production). One shared client per Node process. **PrismaClient lifecycle: PASS.**

---

## 10. Server vs DB Region

Independently verified for **this** IP/database. Frankfurt / 625 ms from the wrong-server audit are **not** reused.

| | |
|---|---|
| Application server | `187.55.228.232` / `srv1829646.hstgr.cloud` |
| Country | **France** |
| Region/city | **Paris, Île-de-France** (ipinfo.io; Hostinger AS47583) |
| Neon provider | **Neon** (AWS) |
| Neon region | **`us-east-2`** (from pooler hostname labels, no credentials printed) |

Cross-Atlantic placement is real. Measured RTT is **~500 ms**, which is worse than a typical Paris→Ohio ICMP RTT, but it is **measured**, not inferred from names. Possible contributors: Neon pooler extra hop, TLS/session setup, routing. Warm reuse still sits at 500 ms, so this is not explained by “first query only.”

---

## 11. Public vs Local Comparison

From **the same server** (`187.55.228.232`):

| Endpoint | Local backend | Public domain | Added proxy/TLS cost |
|---|---:|---:|---:|
| `/health` | 2.07 ms median | 15.06 ms median | **~13 ms** |
| `/health/ready` | 500.88 ms median | 505.39 ms median | **~4.5 ms** |
| `/` (SPA HTML) | n/a | 8.48 ms median | n/a (static via frontend) |

Host Nginx + TLS + Docker frontend proxy are **not** where seconds are lost.

Public samples used Python `urllib` (includes TLS). Keep-alive reuse on the public URL still showed `/health` at 9–20 ms vs local 2 ms.

---

## 12. Nginx

Inspected **only** `/etc/nginx/sites-available/lms.battechno.com` (enabled). Other vhosts (`gigzhouse.com`, `jeeran.battechno.com`) were not used as LMS evidence.

**Host site (`lms.battechno.com`):**

| Setting | Live value |
|---|---|
| `server_name` | `lms.battechno.com www.lms.battechno.com` |
| Frontend upstream | `proxy_pass http://127.0.0.1:8080;` (entire `location /`) |
| API upstream | **none at host** — `/api` is proxied by the **frontend container** to `http://backend:4000` |
| HTTP/2 | **not enabled** (`listen 443 ssl;` only; certbot options have TLS1.2/1.3, no `http2`) |
| gzip (host) | **not configured** |
| `proxy_http_version` | `1.1` |
| proxy keepalive | `Connection ""` (does not force close) — **PASS** |
| `proxy_read_timeout` | `300s` |
| asset caching | **not at host** |
| `index.html` caching | **not at host** |

**Live frontend container Nginx** (what actually serves JS/CSS):

```
location / { try_files $uri $uri/ /index.html; }
```

No `gzip on`. No `/assets/` immutable cache. No `index.html` `no-store`. This does **not** match current repo `frontend/nginx.conf` (gzip + `/assets/` `max-age=31536000, immutable`).

| Nginx area | Verdict |
|---|---|
| Proxy | **PASS** (~13 ms overhead, keepalive sane) |
| Compression | **ISSUE** |
| Caching | **ISSUE** |
| HTTP/2 | **ISSUE** (minor vs 500 ms DB) |

---

## 13. Static Assets

Live `index.html` (production, 2026-08-26):

- `/assets/index-tSzqNN2G.js`
- `/assets/react-vendor-CCvOV8qn.js`
- `/assets/i18n-Co4clWl7.js`
- `/assets/tanstack-query-DICeth5A.js`
- `/assets/react-router-B_xAidoW.js`
- `/assets/lucide-BarOSCQf.js`
- `/assets/index-DC376wxl.css`

`index.html`: `Content-Length: 1167`, `Last-Modified: Mon, 17 Aug 2026 14:50:30 GMT`, no `Cache-Control`, no gzip.

Tested with `Accept-Encoding: gzip` (external workstation and from the server).

| | Main JS | Main CSS |
|---|---|---|
| Path | `/assets/index-tSzqNN2G.js` | `/assets/index-DC376wxl.css` |
| Content-Length | **899055** (~878 KiB) | **409065** (~400 KiB) |
| Content-Encoding | **none** | **none** |
| Cache-Control | **none** | **none** |
| ETag | `"6a831fb6-db7ef"` | `"6a831fb6-63de9"` |
| Last-Modified | 2026-08-17 14:50:30 GMT | 2026-08-17 14:50:30 GMT |
| External TTFB | 0.876 s | 0.840 s |
| External total | **1.892 s** | **1.735 s** |
| From-server total | 10.5 ms | 8.8 ms |

| Check | Result |
|---|---|
| JS gzip | **FAIL** |
| CSS gzip | **FAIL** |
| Hashed asset immutable caching | **FAIL** |

External download time includes Amman→Paris TCP/TLS. From the server, assets are cheap; they are still uncompressed and uncached for every new browser.

---

## 14. Frontend Version

| | Hash |
|---|---|
| Production main JS | `index-tSzqNN2G.js` (Last-Modified **2026-08-17**) |
| Current repo `frontend/dist` main JS | `index-CcAv4z2I.js` |
| Production CSS | `index-DC376wxl.css` |
| Repo dist CSS | `index-BORDngjN.css` |

Frontend container created **2026-08-17**. Repo commits after that include `8028658` (2026-08-19), `d4d2365` (2026-08-22), `3ac9390` (2026-08-23).

| Current repo build appears deployed | **NO** |
|---|---|
| Status | **OUTDATED PRODUCTION FRONTEND** |
| Production backend image | also **OUTDATED** vs `main` (started **2026-08-19 09:50 UTC**; missing at least Aug 22–23 commits, including sequential-auth fix) |

---

## 15. Auth Cost

### Production runtime (MEASURED code on 187.55.228.232)

`/app/src/modules/auth/currentAuthContext.js` dated **2026-08-19**. Queries are **sequential**:

1. `users.findUnique`
2. `user_roles.findMany`
3. `roles.findMany` (by id)
4. `roles.findMany` again (canonical codes)
5. `role_permissions.findMany`
6. `permissions.findMany`
7. `universities.findUnique` (if scoped)
8. `user_organization_assignments.findFirst` (preferred org)
9. `user_organization_assignments.findFirst` (fallback)

Typical authenticated request on **production**:

| | |
|---|---|
| DB queries | **8–9** (reviewer adds another) |
| Sequential DB waves | **8–9** |
| Time at 500 ms/RTT | **~4.0–4.5 s before the route handler** |

`/auth/me` then runs `findUserProfileById` + `toLoginUser` (university + assignments again). Additional **2–3 queries**, still sequential on this image.

### Current repository (STATICALLY_VERIFIED, **not deployed**)

`loadCurrentAuthContextFromDb`:

- Wave 1: `Promise.all` of user, `user_roles`, assignments, reviewer assignment (**4 queries, 1 RTT**)
- Wave 2: roles + university cache + permission cache (**1–3 queries, 1 RTT**)
- Occasional extra canonical-role / org lookup

`rolePermissionCache` (60 s TTL) and university identity cache exist in **repo only** relative to the Aug 19 image.

Typical authenticated request in **current code**:

| | |
|---|---|
| DB queries | **~6–8** |
| Sequential DB waves | **2** (sometimes 3) |
| Time at 500 ms/RTT | **~1.0–1.5 s** |

`/auth/me` (repo): middleware context is reused for roles/permissions (`authContext: req.user`), then still `findUserProfileById` + `toLoginUser` which **re-queries assignments and university**. Duplicate lookups remain.

| Repeated lookups | assignments + university (middleware vs `/me`) |
| Potential optimization | Return middleware user / skip `toLoginUser` DB; drop redundant canonical `roles.findMany` on production image |

Auth section marked **STATICALLY_VERIFIED** for current repo; production sequential shape was **read from the live container** (not timed with a user session).

---

## 16. Authenticated APIs

**BLOCKED — no safe QA session**

No existing QA cookie/token was used. No production users were created or modified. Authenticated TTFB tables are not fabricated.

Expected order of magnitude from unauthenticated DB math + production auth shape:

- `/api/auth/me`: auth 4–4.5 s + extra profile queries → often **>5 s**
- Any dashboard API: similar floor, then handler queries
- Pages with N parallel APIs: wall clock ≈ slowest call (browser parallel), still **multi-second**

---

## 17. Dashboard Request Counts

### Student dashboard — STATICALLY_VERIFIED (`StudentDashboardPage.jsx`)

**Initial business APIs (10, parallel):**

1. student enrollments  
2. student sessions  
3. assessments  
4. submissions  
5. student grades  
6. certificates  
7. notifications (page_size 5)  
8. student courses  
9. my field-training applications  
10. student training progress (**conditional**, after first active FT application)

**Layout APIs (authenticated shell):**

- `/api/auth/me` (auth bootstrap)
- unread notification count (`NotificationBell`, 60 s poll)
- active popups (`ManagedPopupsHost`)
- active announcements (`AnnouncementsHost`)

| | Count |
|---|---|
| Initial business APIs | **10** (+1 FT progress when applicable) |
| Layout APIs | **3** (+ `/auth/me`) |
| Total first paint cluster | **~13–15** |

**Essential above-the-fold:** enrollments, sessions, courses, field-training applications.  
**Could be delayed:** certificates, notification preview list, grades, submissions, assessments, FT progress until first card is shown.

Each of those APIs currently pays **full sequential auth** on production (~4 s each). Parallelism hides the *sum* but not the *floor*.

### Instructor dashboard — STATICALLY_VERIFIED

| | |
|---|---|
| Cohorts loaded | `useCohorts({})` then `cohortIds.slice(0, 30)` |
| Session pattern | **one HTTP request per cohort**: `GET /cohorts/:id/sessions` |
| Potential maximum session APIs | **30** |
| Also loaded | assessments, submissions |
| Backend batch helper | `findManyByCohortIds` exists for **student** `GET /sessions/me` only |
| Batch HTTP endpoint for instructor | **NO** |

Waterfall: wait for cohorts, then up to 30 authenticated session calls (each with production auth tax).

### Other dashboards (current code)

| Page | Initial APIs |
|---|---|
| Admin | `getAdminDashboardStats` (counts users/universities/cohorts/assessments/pending enrollments/recent audit) — **no QA/integrity tables** |
| Trainer | **1** (`getTrainerDashboard`) |
| Trainee | **1** (`listMyPrograms`) |

### Admin Field Training Manage overview — STATICALLY_VERIFIED

Default tab `overview` sets:

- `needsApplications = true`
- `needsSessions = true`
- `needsSubmissions = true`

Attendance and assessments tabs fetch only when selected.

| | |
|---|---|
| Initial API count | **4** (opportunity + applications + sessions + submissions) |
| Data sets loaded | opportunity, applications, sessions, submissions |
| Potential unnecessary initial requests | sessions + submissions are used only for overview KPIs; could be deferred or folded into one overview payload |
| Attendance / assessments on overview | **not** eagerly loaded |

---

## 18. N+1 Findings

Re-checked **current repository** (not copied from the wrong-server report).

| Area | Status | Current query shape |
|---|---|---|
| **Completion readiness** | **CONFIRMED** | `getProgramCompletionReadiness` loads enrollments once, then **sequential** `calculateTrainingCompletionEligibility` per enrollment. Each call runs `computeAndPersistProgress`: 1 enrollment read + **8 parallel** requirement queries + **upsert write** + possible enrollment update. Program-level tasks/requirements/assessments are **re-queried every enrollment**. |
| **Sessions** | **CONFIRMED** | `serializeSession` does `loadModuleBrief` **per row**. `listByCohort` maps `Promise.all` (parallel per session, still 1 RTT per module). `listMine` also sequentially `findById` per distinct cohort. |
| **Courses** | **CONFIRMED** | `listStudentCourses` `Promise.all` → `computeProgressPercent` per enrolled course (count lessons + progress rows). |
| **Enrollments** | **CONFIRMED** | `serializeEnrollment` fetches student brief **per row**. |
| **Users role counts** | **CONFIRMED** | `countUsersByCanonicalRole` loops **7** canonical roles; each does `roles.findFirst` + `user_roles.findMany` (+ scoped `users.count`). **14–21 sequential queries**. |
| **Cohorts catalog** | **PARTIALLY_FIXED** | `serializeCohortListRows` is batched. `listAvailableForUniversity` still `countEnrollmentsForCapacity` **per cohort**. |
| **Field Training attendance close** | **PARTIALLY_FIXED** | Bulk `createMany`/`updateMany` (comment notes Neon pooler dropping long interactive txs), then chunked `refreshAttendancePercentage`. |
| **Instructor session HTTP** | **CONFIRMED** (frontend) | N HTTP calls; no instructor batch route. |

---

## 19. Completion Readiness

`getProgramCompletionReadiness` (`trainingCompletion.service.js`):

| | |
|---|---|
| Number of enrollments | **N-dependent** |
| Queries/enrollment | **~10–12** (1 unique enrollment + 8 parallel snapshots + 1 `training_progress` **upsert** + 1 extra enrollment read in `calculateTrainingCompletionEligibility` + optional status update/events) |
| Program-level repeated queries | `training_tasks`, `training_requirements`, `training_assessments`, final task — **same program, every enrollment** |
| Worst-case behavior | Sequential over N. At 500 ms/wave, even the parallel bundle is **one ~500 ms wave plus write**. 50 enrollments ≈ **50 × ~1.0–1.5 s** if waves stay serial across enrollments → **tens of seconds**. Also **writes** on a GET-like readiness board. |
| Destructive finalization | **not executed** |

Table sizes show `training_enrollments` ≈ **50** rows — the algorithm is still N-serial, not “big data.”

---

## 20. DB Query Plans

Justified `EXPLAIN` only for the measured slow path (`SELECT 1`).

| | |
|---|---|
| SQL execution | **FAST** (0.019 ms) |
| Missing indexes supported by evidence | **none for this bottleneck** |
| DB size | **small** (see below) |

Approximate live tuples (`pg_stat_user_tables`, read-only):

| table | approx rows |
|---|---:|
| notifications | 10844 |
| audit_logs | 4644 |
| field_training_attendance | 1710 |
| files | 1412 |
| field_training_task_submissions | 728 |
| users | 575 |
| user_organization_assignments | 571 |
| field_training_applications | 279 |
| course_enrollments | 146 |
| training_enrollments | 50 |

The database is **not large**. Slowness is round-trip count × 500 ms, not sequential scans of huge tables.

---

## 21. Legacy Queries

User-facing QA / Risk / Integrity / Recognition / Evidence were removed from the product surface. **Current code:**

| Surface | Still queries those tables by default? |
|---|---|
| Admin dashboard | **NO** |
| Auth | **NO** |
| Analytics (`analytics.service.js` / `analytics.repository.js`) | **YES** — `qa_reviews`, `corrective_actions`, `integrity_cases`, `recognition_requests`, `evidence_files` |
| Reports (`reports.repository.js`) | **YES** — recognition + open QA counts |
| Excel analytics export | **YES** |

Unnecessary DB round trips remain on **analytics/reports**, not on the main admin/student dashboards. Do not delete tables in this audit.

---

## 22. Corrected Root Causes

### PREVIOUS AUDIT CORRECTIONS

| Old infrastructure conclusion | Status |
|---|---|
| Server `72.61.179.29` | **INVALID** (different product / Orderz House) |
| Frankfurt server region | **INVALID** for BATTECHNO LMS. Correct region is **Paris, FR** |
| ~625 ms app → Neon | **INVALID** as LMS evidence. **This** host measures **~500 ms** warm (independently) |
| Old Docker findings (wrong host) | **INVALID** |
| Old server CPU/RAM (wrong host) | **INVALID** |
| Old Nginx assumptions | **INVALID** if taken from `72.61.179.29`. Live LMS Nginx is the site above; compression/caching **ISSUE** on the **frontend container** |
| Old static-asset measurements | **INVALID** if from the wrong host. Re-measured here: 899 KB JS, **no gzip**, **no cache** |
| Static CODE findings (N+1, student 10 APIs, instructor per-cohort sessions) | **RECHECKED** on current repo — still present (see §18–17) |
| Sequential production auth | **NEW / MEASURED on correct server** — current repo already improved this, **but production is still the Aug 19 sequential loader** |

### ROOT-CAUSE-001 — Cross-region DB round trip ~500 ms

- **Severity:** CRITICAL  
- **Evidence:** local `/health` 2 ms vs `/health/ready` 501 ms; warm `SELECT 1` median 499.8 ms; SQL 0.019 ms; Neon `us-east-2`; app in Paris  
- **Affected pages:** all DB-backed APIs  
- **Measured or static:** MEASURED  
- **Recommended fix:** Place Neon in an EU region close to Paris **or** move the app next to `us-east-2`. Keep pooler. Add `DIRECT_URL` only for migrations.  
- **Expected impact:** Could cut per-query wait from ~500 ms toward ~20–80 ms (must be re-measured). Multiplies every other fix.

### ROOT-CAUSE-002 — Production auth is sequential (undeployed repo fix)

- **Severity:** CRITICAL  
- **Evidence:** live `currentAuthContext.js` 8–9 serial queries; 8 × 500 ms ≈ 4 s auth floor  
- **Affected pages:** every authenticated route, especially `/auth/me` and dashboards  
- **Measured or static:** live file inspected; latency inferred from SELECT 1 (no QA session)  
- **Recommended fix:** Deploy current backend (`3ac9390` auth waves + permission cache). Further: reuse auth context in `/me`, drop duplicate role fetch.  
- **Expected impact:** Auth floor from ~4–4.5 s → ~1.0–1.5 s at current RTT; ~0.1–0.2 s if RTT is also fixed.

### ROOT-CAUSE-003 — Too many authenticated round trips / N+1

- **Severity:** HIGH  
- **Evidence:** student 10+ APIs; instructor up to 30 session GETs; completion N-serial; courses/enrollments/sessions/users counts N+1  
- **Affected pages:** student dashboard, instructor dashboard/sessions, users admin counts, training completion board, course catalog  
- **Measured or static:** STATICALLY_VERIFIED  
- **Recommended fix:** Batch instructor sessions; defer non-ATF student APIs; batch completion progress; fix remaining N+1.  
- **Expected impact:** Large on those pages even after auth deploy; still multiplied by 500 ms until region is fixed.

### ROOT-CAUSE-004 — Outdated production frontend without gzip/cache

- **Severity:** HIGH (first load / returning users on slow links)  
- **Evidence:** hashes ≠ repo dist; container 2026-08-17; 899 KB JS / 409 KB CSS; gzip FAIL; cache FAIL; Amman JS download 1.89 s  
- **Affected pages:** all SPA routes  
- **Measured or static:** MEASURED  
- **Recommended fix:** Deploy current frontend image (repo `frontend/nginx.conf` already has gzip + immutable `/assets/`).  
- **Expected impact:** JS/CSS bytes typically drop several times; repeat visits near-instant for hashed files. Does **not** fix 4 s API auth.

### ROOT-CAUSE-005 — Prisma connection churn to Neon pooler

- **Severity:** MEDIUM  
- **Evidence:** repeated `PostgreSQL connection: Closed` in backend logs; cold SELECT 1 1267 ms vs warm 500 ms  
- **Affected pages:** first request after idle  
- **Measured or static:** MEASURED  
- **Recommended fix:** Keep pooler + `pgbouncer=true` (already applied in code); avoid extra Prisma clients; consider Neon region move which also shortens idle TLS.  
- **Expected impact:** Reduces cold spikes; does not remove the 500 ms warm floor.

---

## 23. Fix Priority

Do **not** execute these here.

1. **Deploy current backend + frontend to `187.55.228.232`** (auth parallelization, caches, frontend gzip/immutable headers).  
   - Expected impact: **CRITICAL** drop in authenticated TTFB; smaller first-load assets.  
   - Implementation risk: medium (standard compose deploy).  
   - Production risk: medium (restart required; smoke `/health`, `/health/ready`, login, one dashboard per role).

2. **Move Neon to EU (Paris/Frankfurt) or move the app next to `us-east-2`.**  
   - Expected impact: **CRITICAL** on every query (the 500 ms multiplier).  
   - Implementation risk: medium (connection string / region migration).  
   - Production risk: high if done carelessly; schedule + `DIRECT_URL` for migrate; do not print secrets.

3. **Instructor session batch endpoint + stop N HTTP cohort waterfall.**  
   - Expected impact: high on instructor dashboard/sessions.  
   - Implementation risk: low–medium.  
   - Production risk: low.

4. **Completion readiness: batch reads, no per-enrollment sequential `computeAndPersistProgress` on the board; cache program-level rows; avoid writes on GET.**  
   - Expected impact: high on training completion UI.  
   - Implementation risk: medium (eligibility correctness).  
   - Production risk: medium.

5. **Student dashboard: split above-the-fold vs deferred APIs; fix courses/enrollments/sessions N+1; batch user role counts.**  
   - Expected impact: high on student home and admin users.  
   - Implementation risk: low–medium.  
   - Production risk: low.

Optional later: enable HTTP/2 on host Nginx; drop unused analytics/report queries to QA/integrity/recognition/evidence.

---

## Latency budget (correct server)

Using **this** host’s measurements. Auth times for production use 8 waves × 500 ms (live code). Authenticated handler times are **estimated** (no QA session).

| | Production now | After deploying current repo (same 500 ms RTT) | After region + deploy (illustrative 50 ms RTT) |
|---|---:|---:|---:|
| A. Backend no DB | **2 ms** | 2 ms | 2 ms |
| B. One DB round trip | **~500 ms** | ~500 ms | ~50 ms (must re-measure) |
| C. Auth middleware | **~4.0–4.5 s** | **~1.0–1.5 s** | **~0.10–0.15 s** |
| D. Typical simple authenticated endpoint | **~4.5–6 s** | **~1.5–2.5 s** | **~0.2–0.4 s** |
| E. Dashboard (parallel APIs, wall clock ≈ slowest) | **~5–8 s+** (student 10 calls; instructor adds waterfall) | **~2–4 s** still heavy query shapes | **sub-second to low-seconds** depending on N+1 |
| F. Static frontend (Amman, first load JS+CSS) | **~1.9 s + 1.7 s uncompressed** + SPA HTML TLS | gzip should cut transfer a lot | same + HTTP/2 optional |

Where seconds are lost **today:** **C then E**, multiplied by **B**. Not CPU, not disk, not host Nginx.

---

## External domain benchmark (workstation, not mixed into DB math)

Client path includes Amman internet + TLS to Paris. **Do not add this to the 500 ms DB figure.**

| URL | DNS | TCP | TLS (`time_appconnect`) | TTFB | Total | Size | Code |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` | 0.125 s | 0.312 s | 0.678 s | 0.865 s | 0.865 s | 1167 | 200 |
| `/health` (sample) | 0.020 s | 0.205 s | 0.407 s | 0.602 s | 0.602 s | 84 | 200 |
| `/health/ready` (sample) | 0.013 s | 0.188 s | 0.388 s | 1.158 s | 1.158 s | 51 | 200 |

`/health` ×8 TTFB ≈ **0.60–0.65 s** (median ~0.63 s) — mostly TCP/TLS from the client.  
`/health/ready` ×8 TTFB ≈ **1.07–1.74 s** (median ~1.13 s) ≈ client TLS + **~500 ms DB**.

---

## Safety record

| Action | Done? |
|---|---|
| Source code modified | **NO** |
| Database modified | **NO** |
| Nginx modified | **NO** |
| Docker modified | **NO** |
| Production restart | **NO** |
| Indexes / migrations | **NO** |
| git add/commit/push | **NO** |
| Only new file | `BATTECHNO_LMS_CORRECT_SERVER_PERFORMANCE_AUDIT.md` |
