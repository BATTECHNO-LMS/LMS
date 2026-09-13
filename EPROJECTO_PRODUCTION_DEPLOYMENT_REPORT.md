# EPROJECTO Production Deployment Report

**Date:** 2026-09-13  
**Server:** `187.55.228.232` (`srv1829646`)  
**Project:** BATTECHNO LMS / EPROJECTO  
**Project root:** `/root/BATTECHNO_LMS`  
**Canonical domain:** `https://eprojecto.com`  
**Overall status:** PARTIAL

Secrets, credentials, tokens, and environment values are not included in this report.

---

## 1. Server verified

| Check | Result |
| --- | --- |
| Hostname | `srv1829646` |
| User | `root` |
| Public IPv4 | `187.55.228.232` |
| Live LMS containers | `battechno-lms-backend`, `battechno-lms-frontend` |
| Host mappings | `127.0.0.1:4400→4000`, `127.0.0.1:8080→80` |
| Other projects on host | GigzHouse, Mazare3, Jeeran — **not modified** |

## 2. Repository verified

`/root/BATTECHNO_LMS` was the live Docker project but was **not** a Git working tree (historical tarball deploys). The Git clone of this project on the same host is `/root/LMS`.

| Item | Value |
| --- | --- |
| Remote | `git@github.com:BATTECHNO-LMS/LMS.git` |
| GitHub SSH | Authenticated as the existing GitHub user for this repo |
| Production branch | `main` |
| Git attach | After pull, `.git` was copied onto `/root/BATTECHNO_LMS` so the live tree is now a Git checkout |

Working-tree preservation:

- `backend/.env` was not overwritten (`ENV_UNCHANGED=YES` before public URL edits).
- `storage/uploads` was preserved.
- A first rsync exclude of `storage/` accidentally skipped `backend/src/shared/storage/`; those source files were re-copied from Git immediately and Git status was clean before compose/env edits.

## 3. Branch / commits

| Field | Value |
| --- | --- |
| Branch | `main` |
| **PRE_DEPLOY_COMMIT** | `7f287793a985adfb0fcd4bd95ae49fd54a4737a4` |
| **POST_PULL_COMMIT** | `1ccc848388058d408a056d170b10b9f46a3fd414` |
| Git pull | `git pull --ff-only origin main` — **PASS** |

**COMMITS_DEPLOYED**

- `445f27e` `u`
- `1ccc848` `feat: add field-training recorded lectures and Zarqa assessment deadlines`

Rollback image tags:

- `battechno_lms-backend:pre-eprojecto-20260913-1257`
- `battechno_lms-frontend:pre-eprojecto-20260913-1257`

Backup directory (outside the Git tree):

```text
/root/deployment-backups/eprojecto-20260913-1257/
```

Contains: previous Nginx, previous `.env` (secret file, not printed), compose, `nginx -T`, and final Nginx files.

## 4. Database migrations

Inspected SQL for migrations introduced by the pulled commits:

| Migration | Verdict |
| --- | --- |
| `20260912120000_field_training_assessment_closes_at` | Additive `ADD COLUMN IF NOT EXISTS closes_at`. Already applied 2026-09-12. |
| `20260912140000_field_training_recorded_lectures` | Additive enums/tables/indexes. Already applied 2026-09-12. |
| `20260912160000_field_training_recorded_lecture_watch_progress` | Additive tables/FKs/indexes. No `DROP TABLE` / `DROP COLUMN` / `TRUNCATE` / `DELETE FROM`. |

Live schema for recorded-lecture tables matched the migration (tables, columns, FKs, indexes). Row counts were `0/0/0` (empty new tables). No historical Field Training rows were mutated.

Apply notes:

1. `prisma migrate deploy` raced and left one failed `_prisma_migrations` row plus one finished row for `20260912160000_*`.
2. Failed duplicate row was deleted (metadata only).
3. `prisma migrate status` then reported: **Database schema is up to date.**
4. New backend boot then hit Neon **P1002 advisory lock** (`pg_advisory_lock(72707369)`), so the API was started once with `SKIP_PRISMA_MIGRATE_ON_START=true`. That flag was **removed from `.env` after boot** so future deploys still migrate by default.

`prisma migrate reset` was not used. `prisma migrate dev` was not used.

## 5. Domain / origin classification

Occurrences of `lms.battechno.com` were classified, not blindly replaced.

| Location | Action |
| --- | --- |
| Production `PUBLIC_BASE_URL` | Updated to `https://eprojecto.com` |
| Production `CORS_ORIGINS` | Added `https://eprojecto.com` and `https://www.eprojecto.com`; kept legacy origins for transition |
| Compose `VITE_APP_ORIGINS` | Updated to `https://eprojecto.com,https://www.eprojecto.com` (server-local compose change) |
| `VITE_API_BASE_URL` | Left empty (same-origin `/api` via Nginx) |
| Hardcoded CORS in `app.js` | Left as-is; new origins come from `CORS_ORIGINS` |
| `RESEND_FROM_EMAIL` | **Not changed.** OTP emails do not embed app URLs. Changing the From domain without a verified Resend sender would break mail. |
| Nginx `lms.battechno.com` | Converted to 301 redirect only; certificate kept |
| QA/docs/scripts in Git | Left unchanged (not production origin config) |

## 6. Nginx / SSL

Production compose file: `/root/BATTECHNO_LMS/docker-compose.yml`.

Canonical host `eprojecto.com` proxies to `127.0.0.1:8080` (frontend already proxies `/api` to backend). `/api` topology unchanged.

| Host | Role |
| --- | --- |
| `https://eprojecto.com` | Canonical LMS app + `/api` |
| `https://www.eprojecto.com` | `301 https://eprojecto.com$request_uri` |
| `https://lms.battechno.com` | `301 https://eprojecto.com$request_uri` (TLS kept) |
| HTTP `eprojecto.com` / `www` / `lms` | `301 https://eprojecto.com$request_uri` |

`nginx -t` succeeded before reload. `systemctl reload nginx` used (not restart). GigzHouse and Mazare3 vhosts were not edited.

Certificates:

| Name | Status |
| --- | --- |
| `eprojecto.com` + `www.eprojecto.com` | Issued by Certbot 2026-09-13, expires 2026-12-12 |
| `lms.battechno.com` | Existing cert kept, expires 2026-11-10 |

DNS (from the server): `eprojecto.com` and `www.eprojecto.com` resolve to `187.55.228.232`.

## 7. Containers rebuilt

| Service | Result |
| --- | --- |
| Frontend | Rebuilt `--no-cache`, running, healthy |
| Backend | Rebuilt, running, healthy |
| Database provider | Not restarted (Neon, external) |
| GigzHouse / Mazare3 | Untouched and still healthy |

## 8. Smoke tests

### Health / API

| Test | Result |
| --- | --- |
| `http://127.0.0.1:4400/health` | PASS |
| `http://127.0.0.1:4400/health/ready` | PASS (`database: connected`) |
| `https://eprojecto.com/health` | PASS |
| `https://eprojecto.com/health/ready` | PASS |
| `https://eprojecto.com/api/...` through Nginx | PASS (no 502/503/504) |
| Public `GET /api/v1/public/landing-stats` | PASS 200 |
| Public `GET /api/auth/register/universities` | PASS 200 |

### Redirects

| Test | Result |
| --- | --- |
| `https://www.eprojecto.com` → `https://eprojecto.com/` | PASS 301 |
| `https://www.eprojecto.com/login` → `https://eprojecto.com/login` | PASS |
| `https://lms.battechno.com` → `https://eprojecto.com/` | PASS 301 |
| `https://lms.battechno.com/login` → `https://eprojecto.com/login` | PASS |
| Query `.../login?test=1` | PASS (`/login?test=1` preserved) |
| Path `.../field-training/opportunities/123` | PASS |
| Redirect loop | **NO** (`eprojecto.com` returns 200, 0 redirects) |
| `https://eprojecto.com/login` does not bounce to old host | PASS |

### CORS / auth / cookies

Auth is JWT Bearer in the JSON body / `Authorization` header (not host cookies). `Set-Cookie` was not issued on login. Cookie domain migration was not required. Existing sessions on the old host must log in again on `eprojecto.com` (acceptable).

| Test | Result |
| --- | --- |
| OPTIONS `/api/auth/login` `Origin: https://eprojecto.com` | PASS (`access-control-allow-origin: https://eprojecto.com`) |
| Login on `eprojecto.com` | PASS |
| `GET /api/auth/me` | PASS |
| Protected Field Training / Courses / Micro-Credentials APIs | PASS 200 |
| Logout | PASS |
| Re-login | PASS |

### Application pages

SPA routes returned 200 HTML (client router). Authenticated APIs returned 200 JSON.

| Area | Result |
| --- | --- |
| Login page | PASS |
| Field Training list API + `/admin/field-training` / `/student/field-training` | PASS |
| Recorded Lectures admin/student chunks present; player page bundled; no 500; no production lecture rows created | PASS |
| Courses API + `/admin/courses` | PASS |
| Micro-Credentials API + `/admin/micro-credentials` | PASS |
| Frontend JS/CSS on `eprojecto.com` | PASS 200 |
| Mixed content / `lms.battechno.com` in `index.html` | PASS none |
| Frontend bundle hard-coded `lms.battechno.com` | PASS none (same-origin `/api`) |

PRE/POST assessment pages were not mutated; basic Field Training access was verified via the authenticated admin list API.

## 9. Logs inspected

Backend access log after cutover: expected 401 on unauthenticated admin routes, 404 on incorrect probe paths, 200 on health/login/FT/courses/MC. No `500`, `502`, `503`, `504`, `CORS`, `ECONNRESET`, `ETIMEDOUT`, `P1001`, `P1017`, `P2024`, certificate errors, or redirect loops in the post-boot window.

Nginx error log tail showed only older GigzHouse header-size errors, unrelated to this deploy. 301 responses are intentional.

## 10. Issues found

1. **R2 bucket CORS could not be updated.** `node scripts/r2-setup-cors.js` and `GetBucketCors` both returned `Access Denied` with the running R2 key. Browser **presigned** uploads from `https://eprojecto.com` may fail until the Cloudflare R2 CORS allowed origins are updated in the R2 dashboard to include `https://eprojecto.com` (and `https://www.eprojecto.com` if needed). Same-origin API traffic itself is fine.
2. **Neon Prisma advisory lock (P1002)** blocked `migrate deploy` during container start even after schema was current. Backend was recovered with a one-time skip. A future `docker compose up`/`restart` of backend may hit the same lock until Neon releases `pg_advisory_lock(72707369)`.
3. **`RESEND_FROM_EMAIL` still uses `no-reply@lms.battechno.com`.** Intentional: OTP mail has no app links; From-domain cutover needs a verified EPROJECTO sender in Resend first.
4. Live compose `VITE_APP_ORIGINS` is a **server-local** uncommitted change on `docker-compose.yml`. Suggested later commit: `chore: migrate production domain to eprojecto.com`.

## 11. Rollback readiness

**YES.**

Application rollback:

```text
cd /root/BATTECHNO_LMS
docker compose stop backend frontend
docker tag battechno_lms-backend:pre-eprojecto-20260913-1257 battechno_lms-backend:latest
docker tag battechno_lms-frontend:pre-eprojecto-20260913-1257 battechno_lms-frontend:latest
docker compose up -d backend frontend
```

Nginx rollback (restore previous LMS vhost; keep both certificates):

```text
cp /root/deployment-backups/eprojecto-20260913-1257/lms.battechno.com.nginx /etc/nginx/sites-available/lms.battechno.com
nginx -t && systemctl reload nginx
```

Do not delete `lms.battechno.com` DNS or its Let's Encrypt certificate. Do not delete the new `eprojecto.com` certificate during rollback.

Env rollback copy: `/root/deployment-backups/eprojecto-20260913-1257/backend.env`.

---

Suggested Git message (not committed):

```text
chore: migrate production domain to eprojecto.com
```
