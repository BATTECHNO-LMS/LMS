# BATTECHNO LMS Performance and Stability Audit

**Mode:** diagnostic only. No production changes, restarts, deploys, pool edits, or code fixes were made.

**Audit time:** 2026-09-10 14:30–14:32 UTC  
**Auditor origin:** external HTTPS probes to `https://lms.battechno.com` plus repository inspection of `d:\LMS`.  
**Authenticated browser session:** not performed (no production credentials). Logged-in FCP/LCP/TTI and per-page API waterfalls are therefore estimated from architecture plus public measurements, not captured in DevTools.

---

## TOP PERFORMANCE BOTTLENECKS

Ranked by user impact using evidence from this audit.

| Rank | Cause | Evidence | Impact |
|---|---|---|---|
| **P1** | **~500 ms database round-trip per Prisma query** | Warm `GET /health` p50 **106 ms**. Warm `GET /health/ready` (`SELECT 1`) p50 **613 ms**, max **1251 ms**. 8/8 ready responses `database: connected`. | 5 |
| **P2** | **Every authenticated API reloads authorization from Postgres** | `auth.middleware.js` → `loadCurrentAuthContextFromDb`: 3+ Prisma queries before business logic. Multiplies P1 on every click. | 5 |
| **P3** | **Sequential Prisma waterfalls on Field Training and student dashboard** | Eligibility: find opportunity → applications → profiles → hours → tasks → official results. Student dashboard: 9 parallel services then `getStudentOpportunityProgress`. | 4 |
| **P4** | **Auth bootstrap blocks the entire SPA** | `AuthProvider.bootstrap` keeps `isAuthReady=false` until `GET /api/auth/me`. `ProtectedRoute` renders a full-page spinner. Login is `POST /login` then `/me`. | 4 |
| **P5** | **Frontend N+1 on Student Attendance** | Assessments → sessions per cohort → attendance per session; page spinner waits for the whole chain. | 4 |
| **P6** | **Unpaginated eligibility JSON + 151 heavy cards** | `listOpportunityEligibility` returns all approved applications with full `qualification` objects. UI maps every row to `EligibilityStudentCard`. No list virtualization. | 4 |
| **P7** | **Global layout APIs on every authenticated route** | Notification unread poll 60s, announcements, popups, onboarding tour, universities (global admin), student attendance-window poll 12–30s. | 3 |
| **P8** | **Axios 30s timeout vs Nginx 300s + React Query retry 2 + refetchOnReconnect** | Looks like disconnect/reconnect when a slow DB chain or PDF/Excel holds the event loop. | 4 |
| **P9** | **PDF/Excel on the API process** | `pdfRenderer.js` serial Chromium queue; ExcelJS workbooks built on the request thread. Docker healthcheck timeout is 5s on `/health`. | 3 |
| **P10** | **First-load frontend weight** | Main JS 737 KB uncompressed / **206 KB gzip**; CSS 422 KB / **69 KB gzip**; logo PNG **385 KB**; **7** Google Font TTF files (~480 KB). Gzip works. Logo and extra font weights still cost first paint. | 3 |

---

## Why is BATTECHNO LMS slow?

The origin is up. Warm `/health` is ~100 ms. The application becomes slow because **almost every user action pays a ~500 ms Postgres round-trip**, then pays it again for auth, then again for each sequential Prisma call. Field Training eligibility and the student dashboard chain several of those queries. The SPA also **refuses to paint protected pages until `/me` finishes**, so a 1–2 s `/me` looks like “the site is loading.”

## Why does data fetching feel delayed?

1. Auth middleware hits the database on every API.  
2. Endpoints such as eligibility and student progress run **query A, wait, query B, wait** instead of one round.  
3. Some screens wait for **all** requests (global spinner) instead of painting shells.  
4. Student Attendance fans out one HTTP call per cohort and per session.

## Why does the frontend appear to disconnect from the backend?

During this window the backend **did not go down** (`/health` and `/health/ready` both 8/8 HTTP 200). Container restart counts could not be read (SSH denied).

The disconnect **appearance** is explained by:

- Requests that sit on sequential DB work until Axios hits **30 s** (Nginx would wait **300 s**).
- React Query **retries twice** on network/5xx/408 (up to ~90 s of spinner).
- `refetchOnReconnect: true` refires in-flight queries after a blip.
- Any **401** with a Bearer token **logs the user out** (`triggerUnauthorized`).
- PDF/Excel can block the Node event loop; Docker healthcheck is only 5 s.

**Not confirmed:** Nginx losing upstream, pool exhaustion, or container restart loops.

**Top three actual causes**

1. Database RTT ≈ 500 ms per query.  
2. Per-request DB authorization + sequential Prisma chains.  
3. Frontend bootstrap/timeout/retry behavior that looks like a dropped backend.

**Fix first:** confirm Neon region vs `187.55.228.232` and stop paying full DB auth on every request (short-TTL in-memory auth context cache). Relocating the database (or the app) next to each other is the largest possible win if they are in different regions.

**Biggest performance improvement:** cutting that ~500 ms RTT (region/compute) **or**, if the database must stay remote, collapsing auth + sequential queries so a page pays 1–2 RTTs instead of 8–12.

---

## Architecture map (production request path)

Verified DNS: `lms.battechno.com` → **187.55.228.232** (matches the specified production server).

```
Browser
  -> DNS A 187.55.228.232 (8 ms; no Cloudflare)
  -> TLS 1.3 Let's Encrypt (~168 ms first connection)
  -> Host Nginx 1.24.0 Ubuntu :443
       gzip, proxy_http_version 1.1, proxy_read_timeout 300s
       / and /api and /health all proxy_pass http://127.0.0.1:8080
  -> Frontend container nginx :80 (host bind 127.0.0.1:8080)
       /assets hashed files (immutable cache)
       /api /uploads /health -> http://backend:4000
  -> Backend container :4000 (host bind 127.0.0.1:4400)
       JWT Bearer in Authorization (localStorage, not cookies)
       auth middleware reloads roles/org from Prisma
       Prisma client pool default connection_limit=25, pool_timeout=20s, connect_timeout=15s
  -> Neon PostgreSQL (DATABASE_URL; no local Postgres service in compose)
```

**Frontend API base:** production Docker build sets `VITE_API_BASE_URL=""`. The live HTML uses same-origin `/assets/...` and `/api/...`. No `localhost` origin in the production document.

**Auth flow:** `POST /api/auth/login` returns JWT → stored in localStorage → `GET /api/auth/me` (authenticate + profile). JWT default expiry `7d`. No refresh-token endpoint. Cookies are not the session.

**Health:** `/health` liveness (no DB). `/health/ready` runs `SELECT 1`.

**Double proxy:** host Nginx does **not** send `/api` to `127.0.0.1:4400`. It always goes through the frontend container. Extra hop is small compared with DB RTT (health still ~100 ms).

**www:** `www.lms.battechno.com` has **no DNS A record** (`ENOTFOUND`). Certificate SAN is apex only.

---

## Latency table (measured)

| Endpoint | Calls | Average | P50 | P95 | Max | Payload | DB queries | Result |
|---|---|---|---|---|---|---|---|---|
| `GET /health` | 8 | 142 ms | 106 ms | 362 ms | 362 ms | 84 B | 0 | Warm ~105 ms. First sample 362 ms (new TLS). |
| `GET /health/ready` | 8 | 705 ms | 613 ms | 1251 ms | **1251 ms** | 51 B JSON | 1 (`SELECT 1`) | **Above 500 ms and 1000 ms.** DB RTT. |
| `GET /` | 1 | 107 ms | — | — | 107 ms | 1449 B HTML | 0 | SPA shell. |
| `GET /login` | 1 | 126 ms | — | — | 126 ms | SPA HTML | 0 | Same shell (client router). |
| `GET /api/auth/me` (no token) | 1 | 147 ms | — | — | 147 ms | 139 B | 0 | 401, no DB. Authenticated `/me` was not timed. |
| `GET /api/v1/universities` (no token) | 1 | 109 ms | — | — | 109 ms | 139 B | 0 | 401. |
| `GET /assets/index-CUxTz4B_.js` | 1 | 608 ms gzip | — | — | 608 ms | 206 KB gzip / 737 KB raw | n/a | Cache immutable. |
| `GET /assets/index-C5tZjQvg.css` | 1 | 92 ms gzip | — | — | 92 ms | 69 KB gzip / 422 KB raw | n/a | Gzip works. |
| Logo PNG | 1 | 654 ms | — | — | 654 ms | **385 KB** | n/a | Not compressible. |

Authenticated Field Training / dashboard / students APIs: **not measured** (no session). They are expected **well above 1000 ms** if they issue several sequential Prisma queries on top of P1+P2.

---

## Page performance table

| Page | Load time | API time | Frontend render | Requests | Slowest endpoint | Result |
|---|---|---|---|---|---|---|
| Public login / any SPA URL | HTML 107–126 ms; main JS gzip 608 ms; CSS 92 ms; logo 654 ms | `/me` only if token present | Parse ~737 KB JS + 422 KB CSS | 1 HTML + 8 JS/CSS + fonts + logo | Main JS + logo | First visit **POOR** until assets cached. Repeat visit assets cached 1y. |
| Authenticated any route | Blocked until `/me` | `/me` + 4–6 layout APIs | Full-page `LoadingSpinner` until `isAuthReady` | Layout: unread, announcements, popups, onboarding, optional universities | `/api/auth/me` | **SEQUENTIAL_FETCH_WATERFALL** at bootstrap. |
| Admin dashboard | After `/me` | `GET .../dashboard/admin-stats` (6 counts in parallel) | Spinner until stats | 1 page API + layout | admin-stats | Likely 1–2 s if auth+counts each pay DB RTT. |
| Field Training list | After `/me` | list + stats + instructors + specialties | Spinner | 4 page APIs | list or stats | Parallel on the client; each still pays auth DB. |
| Field Training eligibility | After `/me` | **one** heavy `GET .../eligibility` | 151 cards, no virtualization | 1 + layout | eligibility | Highest-confidence slow **data** page. |
| Field Training manage overview | After `/me` | opportunity + overview-summary | Tab gated (good) | 2 | overview-summary or detail | Better than loading every tab. |
| Students / users list | After `/me` | `page_size: 500` | `DataTable` no virtualization | 1 large list | users list | **CLIENT_RENDERING_BOTTLENECK** risk after API returns. |
| Student dashboard | After `/me` | `GET .../student/dashboard-summary` then nested progress | Many section spinners | 1 API (internally 9+1 DB work) | dashboard-summary | Backend waterfall after fan-out. |
| Student Field Training list | After `/me` | opportunities + my applications | Dual spinners | 2 | student opportunities (unbounded) | Parallel. |
| Student Field Training detail | After `/me` | opportunity then progress | Skeleton until first | 2 sequential | progress | **SEQUENTIAL_FETCH_WATERFALL**. |
| Student Attendance | After `/me` | assessments → N cohorts → M sessions | Full spinner | **1 + N + M** | last attendance GET | Confirmed frontend N+1. |
| Courses / micro-credentials / notifications / account | After `/me` | paginated where implemented | Typical list spinner | layout + 1 | varies | Notifications list is paginated (`page_size` 8 in the bell). |
| Reports / PDF / Excel | Not timed | PDF queue / ExcelJS on request thread | Download wait | 1 long | PDF/Excel | Can stall **other** users (event loop). |

FCP/LCP/TTI: not captured with Performance panel. Public first load is dominated by JS+logo+fonts after a 107 ms HTML TTFB.

---

## Top 20 slowest requests (this audit)

Only public/unauthenticated requests were captured. Ranked by duration.

| # | Request | Status | Duration | Notes |
|---|---|---|---|---|
| 1 | `GET /health/ready` | 200 | 1251 ms | First sample; `SELECT 1`. |
| 2 | `GET /health/ready` | 200 | 724 ms | Warm. |
| 3 | `GET /health/ready` | 200 | 613–614 ms | Typical. |
| 4 | Logo PNG | 200 | 654 ms | 385 KB. |
| 5 | `GET /health/ready` | 200 | 603–612 ms | Six samples in this band. |
| 6 | Main JS gzip | 200 | 608 ms | 206 KB on wire. |
| 7 | Main JS uncompressed (no Accept-Encoding) | 200 | 535 ms | 737 KB. Browsers use gzip. |
| 8 | CSS uncompressed (no AE) | 200 | 444 ms | 422 KB; gzip is 92 ms / 69 KB. |
| 9 | `GET /health` first | 200 | 362 ms | Cold connection. |
| 10 | IBM Plex Arabic TTF | 200 | 170 ms | ~96–101 KB each. |
| 11 | `GET /api/auth/me` no token | 401 | 147 ms | No DB. |
| 12 | Lucide chunk | 200 | 151 ms | |
| 13 | Framer Motion gzip | 200 | 98–151 ms | 42 KB gzip. |
| 14 | `GET /health` later | 200 | 104–129 ms | Keep-alive. |
| 15 | Google Fonts CSS | 200 | 93 ms | Then 7 TTF files. |
| 16 | TLS handshake | — | 168 ms | First connection only. |
| 17 | New TCP+TLS `/health` | 200 | 225–239 ms | vs ~110 ms keep-alive. |
| 18 | `GET /` HTML | 200 | 107 ms | |
| 19 | `GET /api/v1/universities` | 401 | 109 ms | |
| 20 | Source map `index-*.js.map` | 404 | 82 ms | Not exposed. |

Authenticated eligibility / dashboard-summary would outrank most of this list if timed.

---

## BACKEND DISCONNECT / RECONNECT INVESTIGATION

| Question | Answer |
|---|---|
| Is the backend container restarting? | **INCONCLUSIVE** (SSH denied). Process answered `/health` for 16 s. |
| Is Nginx losing upstream? | **NO** in sample (0 × 502/503/504). Historical logs unavailable. |
| Is database connectivity dropping? | **NO** in sample (`database: connected` × 8). |
| Is authentication expiring? | **NO** as the primary cause. JWT default **7d**. No refresh race. A **401** does force logout. |
| Are frontend requests timing out? | **HIGH_CONFIDENCE they can.** Axios **30 s**; slow sequential DB + PDF can exceed that. Not observed in the public sample. |
| Are retries creating the appearance of reconnecting? | **HIGH_CONFIDENCE.** React Query retries 2 times on non-4xx (except 408). `refetchOnReconnect: true`. |
| Are 502/503/504 occurring? | **NO** in this sample. Historical: **NEEDS_MORE_DATA**. |
| Are connection pools exhausted? | **NEEDS_MORE_DATA** (no `pg_stat_activity`). Limit 25 in compose. |
| Are requests cancelled by frontend navigation? | **SUSPECTED** (React Query + route changes). Not captured in DevTools. |

**Verdict:** the product feels like it “loses the backend” because **requests stall on the database** and the **SPA treats timeout/401/reconnect as session failure**, not because we observed the Node process disappearing.

---

## Findings

### F01 — SELECT 1 costs ~500 ms from production

- **Severity:** CRITICAL  
- **Impact:** 5  
- **Confidence:** CONFIRMED  
- **Layer:** DATABASE  
- **Affected pages:** all data pages  
- **Affected endpoints:** every Prisma query, measured via `/health/ready`  
- **Measured latency:** ready p50 613 ms / max 1251 ms vs health p50 106 ms  
- **Expected:** `<20–40 ms` for `SELECT 1` on a warm local or same-region pool  
- **Evidence:** `qa-artifacts/performance/endpoint-latencies.json`  
- **Root cause:** geographic or compute distance between app server and Neon (region not readable; SSH denied), or Neon cold compute that stays slow even after 8 probes  
- **Why it causes slowness:** every query, count, and auth lookup inherits this RTT  
- **Recommended fix:** inspect `DATABASE_URL` host (pooler vs direct) and Neon region on the server; place DB in the same region as `187.55.228.232` or move the app to the DB region; confirm pooler URL (`-pooler` + `pgbouncer=true`)  
- **Expected improvement:** 5–20× on API TTFB if RTT drops to tens of milliseconds  
- **Risk of fix:** MEDIUM (region move / connection string). Do not change pool blindly.

### F02 — Authorization is loaded from the database on every request

- **Severity:** CRITICAL  
- **Impact:** 5  
- **Confidence:** CONFIRMED (code) + HIGH_CONFIDENCE (production impact given F01)  
- **Layer:** AUTHENTICATION / BACKEND  
- **Affected pages:** all authenticated navigation  
- **Affected endpoints:** all `authenticate` routes including `/api/auth/me`  
- **Measured latency:** unauthenticated `/me` 147 ms; authenticated not measured  
- **Expected:** JWT verify in-process `<5 ms`; optional DB revalidation with cache  
- **Evidence:** `backend/src/middlewares/auth.middleware.js`, `currentAuthContext.js` (parallel `users` + `user_roles` + reviewer assignment, then roles/permissions/university)  
- **Root cause:** JWT roles are explicitly non-authoritative; every request rebuilds `req.user` from Postgres  
- **Why it causes slowness / disconnect:** 1–2 extra 500 ms RTTs on **each** API. A page with 5 APIs pays auth five times.  
- **Recommended fix:** in-memory TTL cache keyed by `userId` (15–60 s) with invalidation on role/org writes; keep a kill-switch for immediate revocation  
- **Expected improvement:** minus 0.5–1.5 s per API after lookup caches are warm  
- **Risk of fix:** MEDIUM (stale permissions up to TTL)

### F03 — Auth bootstrap blocks all protected UI

- **Severity:** HIGH  
- **Impact:** 4  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND / AUTHENTICATION  
- **Affected pages:** every `ProtectedRoute`  
- **Affected endpoints:** `GET /api/auth/me`  
- **Measured latency:** `/me` without token 147 ms; with token expected 0.6–2 s given F01+F02  
- **Expected:** paint cached user immediately; refresh `/me` in background  
- **Evidence:** `AuthContext.jsx` lines 98–117 set `isAuthReady(false)` even when `authUser` is cached; `ProtectedRoute.jsx` returns `<LoadingSpinner />` until ready; login `persistTokenAndHydrate` waits for `/me` after `POST /login`  
- **Root cause:** avoiding stale role flashes by blocking paint  
- **Why it causes slowness:** the site looks down until one DB-backed `/me` returns  
- **Recommended fix:** treat cached user as ready; revalidate `/me` without unmounting the shell; only logout on confirmed 401  
- **Expected improvement:** perceived startup 1–3 s faster  
- **Risk of fix:** LOW–MEDIUM (brief stale role)

### F04 — Field Training eligibility sequential query + unbounded payload

- **Severity:** HIGH  
- **Impact:** 4  
- **Confidence:** HIGH_CONFIDENCE  
- **Layer:** BACKEND / API_DESIGN / DATABASE  
- **Affected pages:** Manage → Eligibility  
- **Affected endpoints:** `GET /api/v1/admin/field-training/:id/eligibility` (instructor twin exists)  
- **Measured latency:** not timed (auth required)  
- **Expected:** `<300 ms` p50 for a summary list; or paginated  
- **Evidence:** `listOpportunityEligibility` sequential `findById` → `findApplicationsByOpportunity` (no `take`) → profiles → `calculateHoursProgressForApplications` → `calculateTaskProgressForApplications` → final-task `findMany` with submissions → `resolveFieldTrainingApprovedResults`. Hours/tasks are **batched IN queries**, not 151× attendance.  
- **Root cause:** one endpoint computes official qualification for the whole cohort  
- **Why it causes slowness:** 6–10 serial RTTs × 500 ms = multi-second TTFB; JSON includes `qualification` per student  
- **Recommended fix:** parallelize independent queries; return summary columns; paginate; keep full qualification on student-detail  
- **Expected improvement:** 2–8 s → sub-second if DB RTT also drops  
- **Risk of fix:** MEDIUM (UI must accept pagination)

### F05 — Student dashboard 9-way fan-out then sequential progress

- **Severity:** HIGH  
- **Impact:** 4  
- **Confidence:** CONFIRMED (code)  
- **Layer:** BACKEND  
- **Affected pages:** Student dashboard  
- **Affected endpoints:** `GET /api/v1/student/dashboard-summary`  
- **Evidence:** `studentDashboard.service.js` `Promise.all` of 9 services, then `workflowService.getStudentOpportunityProgress` (itself several Prisma counts, then hours, then task progress)  
- **Root cause:** BFF aggregates many domains, then a second sequential workflow  
- **Recommended fix:** run progress in the same `Promise.all`; cap `listSubmissions`/`listGrades` (currently take 200–500)  
- **Expected improvement:** 0.5–2 s  
- **Risk of fix:** LOW

### F06 — Student Attendance frontend N+1 waterfall

- **Severity:** HIGH  
- **Impact:** 4  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND / API_DESIGN  
- **Affected pages:** `/student/attendance`  
- **Affected endpoints:** assessments list → `sessions` by cohort → `attendance` per session  
- **Evidence:** `StudentAttendancePage.jsx` `useQueries` over `cohortIds` then `sessionList`; `loading` is true until **all** finish  
- **Classification:** N+1 HTTP, **SEQUENTIAL_FETCH_WATERFALL**  
- **Recommended fix:** one student attendance summary API  
- **Expected improvement:** 10–100 requests → 1; multi-second wait → one RTT  
- **Risk of fix:** SMALL–MEDIUM

### F07 — Timeout / retry / reconnect mismatch

- **Severity:** HIGH  
- **Impact:** 4  
- **Confidence:** HIGH_CONFIDENCE  
- **Layer:** FRONTEND / NGINX / AUTHENTICATION  
- **Evidence:** axios `timeout: 30000`; Nginx `proxy_read_timeout 300s`; Query `retry` up to 2; `refetchOnReconnect: true`; `refetchOnWindowFocus: false` (good); 401 interceptor logout  
- **Root cause:** frontend gives up 10× earlier than Nginx; retries look like reconnect; 401 looks like “kicked out”  
- **Recommended fix:** do not logout on 401 from clearly transient proxy errors; lower Query retries for GET; align timeout with user-visible operations; keep PDF on a worker  
- **Expected improvement:** fewer false “session expired” / reconnect storms  
- **Risk of fix:** LOW

### F08 — PDF / Excel on the request event loop

- **Severity:** HIGH  
- **Impact:** 3 (4 if someone generates letters during class)  
- **Confidence:** CONFIRMED (code); production overlap NEEDS_MORE_DATA  
- **Layer:** BACKEND  
- **Affected endpoints:** completion letters, reports, Excel exports  
- **Evidence:** `pdfRenderer.js` global `pdfQueue`, Chromium launch 25 s / render 45 s; ExcelJS `Workbook` in report services; Docker healthcheck **5 s**  
- **Why it causes disconnect:** a blocked event loop delays `/health` and all APIs; wget healthcheck can flap  
- **Recommended fix:** separate worker process or queue; never block `/health`  
- **Expected improvement:** interactive APIs stay ~health latency during exports  
- **Risk of fix:** MEDIUM

### F09 — Global providers fetch on every layout

- **Severity:** MEDIUM  
- **Impact:** 3  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND  
- **Affected pages:** all dashboard layouts (`BaseDashboardLayout`, `StudentLayout`)  
- **Affected endpoints:** unread notifications (60 s), `cms/announcements/active`, `cms/popups/active`, onboarding, `GET` universities if `user.isGlobal`, student `attendance-window/active` (30 s idle / 12 s when open)  
- **Evidence:** `NotificationBell.jsx`, `AnnouncementsHost.jsx`, `ManagedPopupsHost.jsx`, `FieldTrainingTourHost.jsx`, `TenantContext.jsx`, `useActiveAttendanceWindows.js`  
- **Duplicate request notes:** React Query shares keys, so duplicate **hooks** are not always duplicate **HTTP**. Still extra APIs on every navigation if stale.  
- **Recommended fix:** raise `staleTime` for catalogs; do not fetch universities until the tenant switcher opens  
- **Expected improvement:** 3–5 fewer APIs per navigation  
- **Risk of fix:** LOW

### F10 — Users list `page_size` 500 + no table virtualization

- **Severity:** MEDIUM  
- **Impact:** 3  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND / API_DESIGN  
- **Affected pages:** Users list  
- **Affected endpoints:** users list `page=1&page_size=500`  
- **Evidence:** `UsersListPage.jsx` line 118; `DataTable.jsx` has no virtualization  
- **Classification:** possible **CLIENT_RENDERING_BOTTLENECK**  
- **Recommended fix:** real pagination (20–50) or virtualize  
- **Expected improvement:** smaller JSON + no UI freeze  
- **Risk of fix:** SMALL

### F11 — Unbounded student opportunities and analytics grades scan

- **Severity:** MEDIUM  
- **Impact:** 2–3  
- **Confidence:** CONFIRMED (code)  
- **Layer:** BACKEND / API_DESIGN  
- **Evidence:** `findPublishedMany` no `take`; `analytics.service.js` `prisma.grades.findMany({ select: { score: true } })`  
- **Recommended fix:** paginate student catalog; `groupBy`/`avg` instead of loading all grades  
- **Risk of fix:** SMALL

### F12 — First-load assets: logo, fonts, large JS chunk

- **Severity:** MEDIUM  
- **Impact:** 3  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND / NETWORK  
- **Measured:** JS gzip 206 KB (good), CSS gzip 69 KB (good), logo **385 KB PNG**, **7** Google Font files, `display=swap` present  
- **Source maps:** `index-*.js.map` **404** (not exposed)  
- **Cache:** `/assets/*` immutable 1 year — repeat visits are fine  
- **gzip:** working for JS/CSS/HTML  
- **brotli:** not observed  
- **Recommended fix:** compress/replace logo (WebP/SVG); self-host 2 font weights as woff2; keep code splitting (already present)  
- **Expected improvement:** 300–800 ms first LCP  
- **Risk of fix:** LOW

### F13 — Double Nginx hop and 300 s proxy timeout

- **Severity:** LOW  
- **Impact:** 1 for hop; 3 for timeout mismatch with Axios  
- **Confidence:** CONFIRMED  
- **Layer:** NGINX  
- **Evidence:** host nginx `proxy_pass 127.0.0.1:8080` for `/api`; frontend nginx then `backend:4000`  
- **Health 106 ms** shows the hop is not the main cost  
- **Recommended fix:** optional `/api` → `127.0.0.1:4400` to skip one proxy; align timeouts  
- **Risk of fix:** MEDIUM (easy to break `/api` routing)

### F14 — `withDbRetry` can hide Neon blips and lengthen failures

- **Severity:** MEDIUM  
- **Impact:** 3  
- **Confidence:** HIGH_CONFIDENCE  
- **Layer:** DATABASE / BACKEND  
- **Evidence:** `db.js` 3 attempts, 100 ms / 200 ms delays, matches Neon idle disconnects  
- **Why it looks like reconnect:** one user click becomes 3 connection attempts  
- **Recommended fix:** keep retry for true transients; fail fast on user GETs; log retry counts  
- **Risk of fix:** LOW

### F15 — persistMany sequential qualification writes

- **Severity:** MEDIUM  
- **Impact:** 2  
- **Confidence:** CONFIRMED  
- **Layer:** BACKEND  
- **Evidence:** `persistMany` `for` + `await persistQualification`  
- **Not a list-page N+1 for read path.** Hurts bulk recalculation.  
- **Recommended fix:** batch updates  
- **Risk of fix:** MEDIUM

### F16 — loadBatchContext pulls `preview_json` for import batches

- **Severity:** MEDIUM  
- **Impact:** 2  
- **Confidence:** HIGH_CONFIDENCE  
- **Layer:** DATABASE / BACKEND  
- **Evidence:** `fieldTrainingEvaluation.service.js` `preview_json: true` on all applied batches  
- **Recommended fix:** select only supervisor name fields  
- **Risk of fix:** LOW

### F17 — CORS is not the disconnect cause

- **Severity:** INFO  
- **Impact:** 1  
- **Confidence:** CONFIRMED (no evidence)  
- **Layer:** NETWORK  
- **Evidence:** same-origin `/api`; unauthenticated 401 JSON returned without CORS failure in Node probe  
- **Do not treat CORS as the incident cause**

### F18 — Window-focus refetch

- **Severity:** INFO  
- **Impact:** 1  
- **Confidence:** CONFIRMED  
- **Layer:** FRONTEND  
- **Evidence:** `queryClient.js` `refetchOnWindowFocus: false`  
- **Tab switch should not storm APIs.** Reconnect still will (`refetchOnReconnect: true`).

### F19 — Keep-alive works; HTTP/2 available on the edge

- **Severity:** INFO  
- **Impact:** 1  
- **Confidence:** CONFIRMED  
- **Layer:** NETWORK / NGINX  
- **Evidence:** reused `/health` 107–116 ms vs new connection 225–239 ms; nginx `listen 443 ssl http2`  
- **Not a material bottleneck vs F01**

### F20 — Classic 151× attendance SQL N+1 is not the eligibility path

- **Severity:** INFO  
- **Impact:** —  
- **Confidence:** CONFIRMED  
- **Layer:** DATABASE  
- **Evidence:** `calculateHoursProgressForApplications` uses `application_id: { in: ids }`; indexes `idx_field_training_attendance_application` exist  
- **Do not spend P0 on that myth.** The cost is **serial batched queries + payload**, not 151 extra SQL round-trips on that screen.

---

## DATABASE PERFORMANCE FINDINGS

| Item | Result |
|---|---|
| Connection type | Compose comments + `prismaPoolUrl.js`: Neon URL; `-pooler` host gets `pgbouncer=true`. **Production URL not read.** |
| Connection latency | `SELECT 1` ≈ **500 ms** steady-state from public `/health/ready` vs `/health` |
| Query latency | Same order of magnitude until proven otherwise |
| Slow queries | See `slow-queries.txt`. No EXPLAIN ANALYZE |
| N+1 | Eligibility **batched**. Student Attendance **HTTP N+1**. `persistMany` sequential writes |
| Missing indexes | Not claimed. Relevant `opportunity_id` / `application_id` indexes exist. EXPLAIN not run |
| Pool | Default 25 connections, 20 s pool timeout. Saturation **NEEDS_MORE_DATA** |
| Region | Neon region **NEEDS_MORE_DATA**. 500 ms `SELECT 1` is consistent with a remote region or constrained compute |
| Connection failures | None in sample |

---

## FRONTEND PERFORMANCE FINDINGS

| Item | Result |
|---|---|
| Waterfalls | Auth `/me` gate; login POST→`/me`; student detail opp→progress; attendance N+1; dashboard progress after fan-out |
| Duplicate requests | Layout: notifications + CMS + onboarding + tenant universities. Admin FT: list+stats+instructors+specialties. Student FT: catalog + my applications. Query keys usually shared. |
| Rerenders | Not profiled. `TenantProvider` rebuilds context on user/scope. |
| Bundle | Main 737 KB / 206 KB gzip; extra chunks for react, i18n, query, router, lucide, framer. No `.map` in production. |
| Blocking loaders | `ProtectedRoute`, many pages `if (isLoading) return <LoadingSpinner />` |
| Client cache | React Query `staleTime` 60 s lists; `gcTime` 10 min. A→B→A within 60 s should reuse lists **if the component stays mounted in cache**. Full remount still reads cache. |
| Refetch | No window-focus refetch. Reconnect refetch **on**. |
| Render bottlenecks | Eligibility cards × cohort size; users table 500 rows; no virtualization |

**React Query:** `retry` 2 for non-4xx; `staleTime` list 60 s; notifications 30 s. Not a “refetch every focus” bug.

**HTTP client:** Axios, 30 s, Bearer from localStorage, 401 → logout. No refresh lock, no retry interceptor on axios itself (Query retries instead).

---

## BACKEND PERFORMANCE FINDINGS

| Item | Result |
|---|---|
| Slow routes | `/health/ready` measured. Eligibility, dashboard-summary, student progress, PDF/Excel inferred |
| Query counts | Auth 3–6. Eligibility ~8–15. Dashboard-summary many (9 services). Progress ~8+ |
| Event loop | PDF Chromium + ExcelJS + `getObjectBuffer` full-file reads |
| Memory | File downloads via `readFile` into a buffer (`local.provider.js`). R2 presign exists but local/static `/uploads` is `express.static` after `authenticate` |
| CPU | Not measured on host |
| Errors | 0 × 5xx in sample |
| Timeouts | Prisma connect 15 s, pool 20 s, Nginx 300 s |
| Serialization | Eligibility maps qualification per row in JS after queries |
| Large payloads | Eligibility; users 500; analytics all grades; student opportunities unbounded |

---

## INFRASTRUCTURE STABILITY FINDINGS

| Item | Result |
|---|---|
| Nginx | Live Ubuntu 1.24.0; gzip on; 300 s timeouts; `/api` via frontend container |
| Docker | Expected names/bindings from compose. **Restart count unknown** |
| Host resources | **NEEDS_MORE_DATA** |
| Network / TLS / DNS | DNS 8 ms to correct IP. TLS 168 ms. No CDN. Keep-alive works |
| Saturation | Not measured. Do not assume CPU |
| Container restarts | **INCONCLUSIVE** |

---

## Pagination audit

| List | Pagination |
|---|---|
| Users | Yes, but UI requests **500** |
| Courses | Yes (`max` 100) |
| Field Training opportunities (admin) | Yes (`page_size` 50 on the list page) |
| Field Training applications | Validation `max` 100 / default 20 |
| Eligibility participants | **No** |
| Student opportunities | **No** (`findPublishedMany`) |
| Notifications | Yes |
| Audit logs | Yes |
| Reports / Excel / grades / submissions | Caps 200–5000 in places; not always user-paginated |
| Task submissions (manage) | Tab-gated queries; still can be large |

---

## Timeout map

| Layer | Value |
|---|---|
| Axios | 30 s |
| React Query retry | 2 × failing GET |
| Host Nginx `proxy_read_timeout` | 300 s |
| Frontend Nginx `proxy_read_timeout` | 300 s |
| Prisma `connect_timeout` | 15 s |
| Prisma `pool_timeout` | 20 s |
| Docker healthcheck | 5 s |
| PDF launch / render | 25 s / 45 s |
| `withDbRetry` | 3 attempts |

Mismatch: **frontend 30 s vs Nginx 300 s** is enough to look like a drop while the proxy still waits.

---

## QUICK WINS (do not implement in this phase)

| Win | Impact | Complexity |
|---|---|---|
| Cache `loadCurrentAuthContext` 30–60 s in memory | Huge with F01 | SMALL |
| Paint cached user; fetch `/me` in background | Perceived startup | SMALL |
| Parallelize eligibility Prisma steps | Eligibility TTFB | MEDIUM |
| Student attendance summary endpoint | That page | MEDIUM |
| Users `page_size` 20–50 | Students/users list | SMALL |
| Shrink/replace 385 KB logo; 2 font weights woff2 | First paint | SMALL |
| Disable Query retry on timeout or cap at 1 | False reconnect | SMALL |
| Do not `triggerUnauthorized` unless 401 is clearly auth | False logout | SMALL |
| Confirm Neon region vs 187.55.228.232 | All APIs | LARGE (infra) |
| Move PDF/Excel off the API process | Stability under reports | LARGE |

---

## FIX PRIORITY PLAN

**P0 — Immediate stability / perception**

1. Read production `DATABASE_URL` host/region on `187.55.228.232` (no credential dump) and compare to the app region.  
2. Auth-context TTL cache.  
3. Stop treating every 401/timeout as “backend gone.”

**P1 — Major performance**

1. Parallelize / slim eligibility.  
2. Dashboard-summary: include progress in the fan-out; cap nested lists.  
3. Student attendance BFF.  
4. Stop blocking `ProtectedRoute` on `/me` when a cache exists.

**P2 — UX speed**

1. Logo + fonts.  
2. Real users pagination + virtualization.  
3. Optional `/api` straight to backend bind.  
4. Raise staleTime on layout CMS queries.

**P3 — Nice to have**

1. Brotli.  
2. HTTP/2 between Nginx and backend.  
3. Broader query timing (`PERF_LOGGING` exists but must not be flipped on in production during this phase).

---

## What was not measured

- Logged-in DevTools waterfall, FCP, LCP, TTI, cancelled/retry counts  
- Docker restart counts, OOM, host CPU/RAM/disk  
- Nginx access/error 502/504 history  
- Prisma query counts on a live request  
- EXPLAIN ANALYZE  
- Neon connection count  
- Event-loop lag in production  
- Window-focus live test (code says it should **not** refetch)

Do not treat those gaps as proof of innocence or guilt.

---

## Suggested commit message (not committed)

```
chore: add battechno lms performance and stability audit
```
