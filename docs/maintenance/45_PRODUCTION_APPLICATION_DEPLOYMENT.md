# 45 — Production Application Deployment (PROD-DEPLOY-001)

**Date:** 2026-07-18  
**Verdict:** **MANUAL DEPLOYMENT REQUIRED**

This agent environment has **no Render CLI, no `RENDER_API_KEY`, no Vercel/Netlify/Hostinger CLI, and no `gh` auth**. Deployment was **not** executed. Pre-deploy validation passed. Exact operator steps are below.

**JWT_SECRET was not changed** (local or Render). Owner will sync fingerprint `eec7827fb0` in a later task.

---

## 1. Source equivalence

| Item | Result |
|------|--------|
| Working tree | Clean |
| `.env` tracked/staged | No |
| `e3cadb1` → `4eeec0f` diff | **Documentation only** (`docs/maintenance/*`) |
| Application source (`backend/`, `frontend/`, `.github/`) | **Byte-equivalent** between commits |
| Approved application baseline | **`e3cadb1`** |
| Deployable tip (docs included) | **`4eeec0f`** (same app bytes as `e3cadb1`) |

---

## 2. Pre-deployment validation (this session)

| Check | Result |
|-------|--------|
| Backend unit | **318 pass** |
| Frontend unit | **42 pass** |
| Integration (disposable PG only) | **8 pass** |
| Prisma validate | Pass |
| `prisma:check-history` | **27/27**, 0 pending, 0 failed |
| `prisma migrate status` | Up to date |
| Baseline validate | v1 OK |
| Frontend production build | Pass |
| Build embeds `https://lms-7txx.onrender.com` | Yes (3 hits) |
| Localhost / staging in build | 0 |
| Secretish patterns in build | 0 |
| Local `VITE_API_BASE_URL` | Exact production API |

---

## 3. Rollback targets (pre-deploy snapshot)

| Layer | Identifier / note |
|-------|-------------------|
| Git approved app | `e3cadb1` |
| Git tip (docs) | `4eeec0f` |
| Live API | `https://lms-7txx.onrender.com` — health 200; `x-render-origin-server=Render`; Cloudflare in front |
| Live FE | `https://lms.battechno.com` — 200; `Server=hcdn` (Hostinger CDN) |
| Live API request sample | `X-Request-ID` observed (ephemeral; not a deploy version id) |
| Prior Git on `main` | `e8048c6` (`origin/main`) — **older** than maintenance branch |
| Neon PITR | Available (same as predeploy) |
| Env snapshot | Render/Hostinger dashboards hold current values — **do not paste** into Git |
| Schema rollback compatibility | Current DB **27/27** with uniqueness index; rolling app **back** to older code that expects this schema is OK; **do not** reset DB |

Exact Render “deploy id” / Hostinger “release id” were **not** readable without dashboard access — record them in the dashboard UI at deploy time.

---

## 4. Backend deployment result

**Not performed** (no Render access).

### Manual Backend deploy steps (Render)

1. Open Render Dashboard → service for **`https://lms-7txx.onrender.com`**.  
2. Confirm Git repo `BATTECHNO-LMS/LMS` (or connected fork) and that this service is production API (not staging).  
3. **Do not** edit `JWT_SECRET`, `DATABASE_URL`, or provider keys.  
4. Deploy commit **`e3cadb1`** (or **`4eeec0f`** if docs-only tip is preferred — same app code). Options:  
   - **Manual Deploy** → select commit SHA, or  
   - Merge/push `maintenance/test-safety-baseline` at that SHA into the branch Render watches (only if that is your established prod branch policy).  
5. Root / build: Backend Dockerfile or `backend/` as root per existing service settings (`npm ci`, `prisma generate` via postinstall, `npm start`).  
6. If deploy hook runs `prisma migrate deploy`, expect **no-op** (already 27/27).  
7. Wait until status **Live**.  
8. Check logs for crash loop / missing env / Prisma errors (**redact secrets**).  
9. Verify:  
   - `GET https://lms-7txx.onrender.com/health` → 200  
   - `GET https://lms-7txx.onrender.com/health/ready` → 200  

---

## 5. Frontend deployment result

**Not performed** (no Hostinger/FE deploy access). FE currently served via Hostinger (`hcdn`).

### Manual Frontend deploy steps

1. On a clean machine with approved source at `e3cadb1` / `4eeec0f`:  
   ```bash
   cd frontend
   # Build-time only — do not upload .env to the host
   set VITE_API_BASE_URL=https://lms-7txx.onrender.com
   set VITE_APP_ORIGINS=https://lms.battechno.com,https://www.lms.battechno.com
   npm ci
   npm run build
   ```  
2. Confirm `dist/` contains `lms-7txx.onrender.com` and **no** localhost.  
3. Upload/publish `dist/` to the Hostinger site bound to **`lms.battechno.com`** (existing domain).  
4. Keep SPA fallback: all routes → `index.html`.  
5. Verify HTTPS, `/`, `/login`, nested route refresh, AR/EN.  

---

## 6. Health / smoke (current live — pre-redeploy)

| Check | Result |
|-------|--------|
| API `/health` | 200 |
| API `/health/ready` | 200 |
| FE `/` | 200 |
| Login/token smoke with new build | **Not run** (new build not deployed) |
| CORS from `lms.battechno.com` | Previously verified; re-check after FE deploy |

---

## 7. Database post-check (read-only, this session)

| Check | Result |
|-------|--------|
| Migrations | **27/27**, 0 pending, 0 failed |
| Unique index | Present |
| Users | **423** |
| Submissions | **0** |

---

## 8. Provider configuration (local approved env presence)

| Provider | Present (config-level) |
|----------|------------------------|
| Resend | Yes |
| Gemini | Yes |
| R2 | Yes (`r2:health` previously OK when STORAGE_BACKEND=r2) |
| YouTube | Yes |
| `R2_PUBLIC_BASE_URL` | Empty — still intentionally optional |
| Live provider calls this task | **None** |

---

## 9. Remaining manual actions

1. Deploy Backend from `e3cadb1`/`4eeec0f` on Render (**without** changing JWT).  
2. Deploy Frontend `dist/` to Hostinger for `lms.battechno.com`.  
3. Login + `/me` smoke on production.  
4. Later (separate): sync JWT fingerprint `eec7827fb0` + session-reset smoke.  
5. Later: production release tag (not this task).  

Keep **QA-AUTH-001** / **QA-AUTH-003** open.

---

## 10. Verdict

### **MANUAL DEPLOYMENT REQUIRED**

Pre-deploy gates are green; application source is approved and docs-only ahead of `e3cadb1`. Automated deployment credentials are unavailable in this environment, so production was **not** updated.
