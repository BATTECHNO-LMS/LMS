# EPROJECTO SECURITY PHASE 4 — Infrastructure, Containers, Database, Secrets & Supply-Chain Hardening

**Date:** 2026-10-17  
**Execution:** LOCAL / CONFIGURATION HARDENING ONLY  
**Production modified:** NO  
**Production deployment:** NO  

---

## 1. Executive Summary

Phase 4 hardened repository Docker/Nginx/CI/env baselines for non-root containers, capability dropping, read-only rootfs with minimal writable paths, secret/env separation, Neon test-DB fail-closed gates, production startup TLS/URL validation, and CI security gates (Gitleaks, advisory npm audit, Semgrep).

**Local Docker image build, Trivy scan, SBOM, and container smoke could not run** — Docker CLI is not installed on the Windows agent host. Those acceptance items are documented as **NOT_AVAILABLE / NOT_RUN** and must complete on a Docker-capable runner before production deploy approval.

| Area | Result |
|---|---|
| Non-root Dockerfiles + compose | PASS (config) |
| Privileged / docker.sock | NONE found |
| Secrets in images/bundles | NO evidence in repo build path; FE dist scanned clean |
| Critical npm CVEs (`proxy-addr`, `tar`) | Fixed via overrides |
| Remaining high CVEs | Exception register |
| Local Docker build/scan/smoke | NOT_AVAILABLE |
| Production deploy | NOT performed |

**Status: PARTIAL** — configuration hardening complete; Docker-dependent validation deferred.

---

## 2. Docker Architecture

| Service | Base Image | Runtime User | Root? | Writable Paths | Capabilities | Risk |
|---|---|---|---|---|---|---|
| backend | `node:20.19-alpine` | `node` (1000) | No | `/app/uploads` (bind), tmpfs `/tmp`, `/app/tmp`, `/home/node/.cache` | `cap_drop: ALL` | Medium (Chromium `--no-sandbox`) |
| frontend | build `node:20.19-alpine` → runtime `nginxinc/nginx-unprivileged:1.27-alpine` | `nginx` | No | tmpfs `/tmp`, `/var/cache/nginx`, `/var/run` | `cap_drop: ALL` | Low |

Compose publishes **loopback only**: `127.0.0.1:4400→4000`, `127.0.0.1:8080→8080`. Host Nginx (deploy templates) terminates TLS.

---

## 3. Container Users

- Backend: `USER node` after root package/font install; compose `user: "1000:1000"`.
- Frontend: unprivileged Nginx image user `nginx`; no root at runtime.
- Puppeteer/LibreOffice retained; Chromium still needs `--no-sandbox` on Alpine (documented exception).

---

## 4. Capabilities

- `cap_drop: ALL` on both services.
- `security_opt: no-new-privileges:true`.
- No `privileged: true`.
- Soft `pids_limit: 256` / `mem_limit: 1536m` on backend (tune after measurement).

---

## 5. Filesystem

- `read_only: true` with explicit tmpfs for caches/temp reports.
- Uploads: `./storage/uploads:/app/uploads` only intentional host bind.
- No `chmod 777` on app tree; ownership `node:node` / `nginx:nginx`.

**Read-only filesystem: PARTIAL** — feasible with tmpfs + uploads mount; full RO without tmpfs would break PDF/LibreOffice.

---

## 6. Docker Networks

- Default Compose network for frontend→`backend:4000`.
- No docker.sock mounts.
- No broad host mounts (`/`, `/etc`, `/root`, SSH keys).

---

## 7. Docker Secrets Exposure

- No `COPY .env` / `ARG SECRET` / credential echo in Dockerfiles.
- Runtime secrets via `env_file: ./backend/.env` (host file, not baked).
- `.dockerignore` excludes `.env*`, git, dumps, keys, uploads, coverage.

---

## 8. Base Images

| Image | Pinning | Notes |
|---|---|---|
| `node:20.19-alpine` | Version-pinned (not `latest`) | Digest pinning recommended later for deploy |
| `nginxinc/nginx-unprivileged:1.27-alpine` | Minor-pinned | Prefer digest at deploy |

Trade-off: floating patch tags vs digest pin — digest is stronger reproducibility; minor pin is acceptable interim.

---

## 9. Nginx

### Container (`frontend/nginx.conf`)

- Listen **8080**, `server_tokens off`, `autoindex off`
- Deny `/\.` and sensitive extensions
- Security headers; SSE location unbuffered / 3600s
- Proxy headers: Host, X-Real-IP, X-Forwarded-For/Proto, X-Request-Id

### Host templates (`deploy/nginx-eprojecto.com.conf`, legacy redirect)

- HSTS (no preload), CSP baseline, unknown Host → `444`
- HTTP→HTTPS canonical `https://eprojecto.com`
- www → apex; legacy `lms.battechno.com` → eprojecto
- SSE location; `server_tokens off`
- **Not applied to live host** (deployment phase only)

---

## 10. TLS

**Recommendation (deploy):** TLS 1.2 + 1.3 only via Certbot `options-ssl-nginx.conf`; disable 1.0/1.1; monitor cert expiry.

**HSTS:** Configured in repo template (`max-age=31536000; includeSubDomains`). **Do not add preload** until all subdomains confirmed HTTPS. Live apply = DEPLOYMENT_REQUIRED.

---

## 11. Proxy Headers

Preserves Phase 1A trust model: host Nginx sets `X-Request-Id` / forwarded headers; container Nginx forwards; backend trusts bounded proxy hops only. Clients cannot invent trusted request IDs across the trust boundary when host Nginx overwrites.

---

## 12. Environment Secrets

| Secret Name | Used By | Environment | Exposure Risk | Rotation Required |
|---|---|---|---|---|
| `DATABASE_URL` | backend | runtime | Critical if leaked | On leak / staff change |
| `DIRECT_URL` | migrate | runtime/deploy | Critical | With DB credentials |
| `JWT_SECRET` | backend | runtime | Critical | On leak / rotate policy |
| `MFA_ENCRYPTION_KEY` | backend | runtime | Critical (MFA secrets at rest) | On leak — re-enroll MFA |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | backend | runtime | High | Scoped token rotate |
| `RESEND_API_KEY` | backend | runtime | High | On leak |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | backend | runtime | High | On leak |
| `YOUTUBE_API_KEY` | backend | runtime | Medium | On leak |
| Firebase admin credentials (if file/env) | backend push | runtime | High | On leak |

Values never printed in this report.

---

## 13. Frontend Secret Exposure

`VITE_*` used: `VITE_API_BASE_URL`, `VITE_APP_ORIGINS`, `VITE_API_VERSION`, `VITE_API_PROXY_TARGET` (dev).  
Production build scanned: **no** JWT/MFA/R2/DB patterns in `dist`. Source maps disabled (`sourcemap: false`); Dockerfile also deletes `*.map`.

---

## 14. Database Privileges

| Capability | Runtime App Needs? | Current Known State | Recommended |
|---|---|---|---|
| SELECT/INSERT/UPDATE/DELETE | Yes | Neon role used by app (not inspected live) | Keep least privilege |
| DDL / migrations | No at runtime | `prisma migrate deploy` at container start via start-production | Separate migrator role + `DIRECT_URL` |
| SUPERUSER / CREATEDB | No | Unknown on prod (do not invent) | Confirm not SUPERUSER |
| audit_logs UPDATE/DELETE | Prefer No | App currently uses normal Prisma role | Future INSERT+SELECT-only connection |

**Migration role separation:** READY (documented) — DEFERRED for live Neon role changes.

---

## 15. Database TLS

Production startup refuses non-TLS-looking `DATABASE_URL` unless Neon host (provider-enforced TLS) or `sslmode=require|verify-*` / `ssl=true`. Do not weaken.

---

## 16. Database Pooling

`prismaPoolUrl.js` sets `connection_limit` (default 25), `pool_timeout`, `connect_timeout`, `pgbouncer=true` for `-pooler` hosts. Compose sets `PRISMA_CONNECTION_LIMIT=25`. Mitigates connection exhaustion.

---

## 17. Backup Security

| Item | Status |
|---|---|
| Provider PITR (Neon) | Assumed available if Neon — confirm in deploy phase |
| Dump scripts in repo | Ops scripts exist; must not land in web root |
| Encryption / permissions | POLICY for host filesystem — DEPLOYMENT |
| RPO/RTO | **POLICY_REQUIRED** |
| Restore test | **NOT_RUN** (local strategy: restore to disposable DB only) |

Retention classes: ACTIVE / REQUIRED / RETENTION_REVIEW / OLD_UNKNOWN — classify existing host backups without deleting shared multi-product artifacts.

---

## 18. R2 / Object Storage

- Browser uploads go through API (no broad public PUT CORS required by default).
- Credentials: account/bucket scoped keys recommended (least privilege: object R/W on app bucket only).
- Signed downloads for private objects (prior phases).
- Lifecycle for temp reports/ZIPs: document cleanup jobs; do not retain forever.

---

## 19. Dependency Security

### Critical (resolved locally)

| Package | Severity | Direct/Transitive | Production Reachable | Fix |
|---|---|---|---|---|
| `proxy-addr` | critical | transitive (Express) | Yes | override `2.0.8` + express 4.22.3 |
| `tar` | critical | transitive (bcrypt tooling) | Install-time primarily | override `^7.5.22` |

### High (selected)

| Package | Severity | Direct/Transitive | Production Reachable | Fix |
|---|---|---|---|---|
| `axios` (frontend) | high | direct | Yes (browser) | bumped `1.20.0` |
| `puppeteer` chain | high | direct | Yes (PDF) | exception — major deferred |
| `xlsx` | high | direct FE | Yes (parse) | no fix — exception |
| `vite` / `tailwind` / `sharp` | high | FE build | Build-time | exception — majors deferred |
| `firebase-admin` tree | high/mod | direct | Push path | exception |

Full register: `docs/security/DEPENDENCY_EXCEPTIONS.md`.  
No `npm audit fix --force`.

---

## 20. Secret Scanning

| Item | Result |
|---|---|
| Tool | Pattern scan local + CI Gitleaks job prepared |
| Tracked `.env` | Ignored (`backend/.env`, `frontend/.env`) |
| Verified production secrets in tracked source | **NO** |
| CI dummy Postgres URLs | Placeholder only (allowlisted conceptually) |
| Values in this report | **NO** |

---

## 21. SAST

- CI job `sast-semgrep` with `p/owasp-top-ten`, `continue-on-error: true` until tuned.
- Local Semgrep binary: not available on agent.

---

## 22. Container Scanning

| Image | Critical | High | Medium | Action |
|---|---:|---:|---:|---|
| frontend (local) | N/A | N/A | N/A | Build+Trivy on Docker host |
| backend (local) | N/A | N/A | N/A | Build+Trivy on Docker host |

**SBOM:** NOT_AVAILABLE (no Syft/Trivy locally).

---

## 23. CI Security Gates

Documented in `docs/security/CI_SECURITY_GATES.md`. Workflow updates:

1. Frontend dist secret/source-map checks  
2. `secret-scan` (Gitleaks)  
3. `dependency-audit` (advisory `continue-on-error`)  
4. `sast-semgrep` (advisory)

Block policy target: verified secrets + failing tests + confirmed reachable criticals.

---

## 24. Supply Chain

- Lockfiles present (`backend`/`frontend` package-lock).
- Prefer `npm ci` in Docker/CI.
- Install scripts: prisma, bcrypt, puppeteer, firebase util, protobufjs — legitimate; do not globally disable.
- No `git:` / HTTP dependency URLs found in primary manifests during audit.
- Image signing (Cosign): recommended future — registry readiness required.

---

## 25. Production Filesystem

Recommendations only (do not execute on prod):

```bash
# examples — operator runbook
chmod 600 /path/to/backend/.env
chown root:root /path/to/backend/.env
# Nginx/Docker logs: restrict group read; no world-readable dumps under /var/www
```

---

## 26. SSH / Firewall Recommendations

| Surface | Expectation |
|---|---|
| Public | 80, 443 |
| SSH 22 | Key auth, no password if possible, restrict source IPs, fail2ban optional |
| Backend 4000 / FE 8080 | Loopback or Docker network only |
| Neon | Remote TLS; no public admin UI |

Do not change live SSH/firewall in this phase. Multi-product VPS: never global `docker prune` / shared backup deletion.

---

## 27. Security Baseline

- `docs/security/PRODUCTION_SECURITY_BASELINE.md`
- `docs/security/CI_SECURITY_GATES.md`
- `docs/security/DEPENDENCY_EXCEPTIONS.md`
- `.gitleaks.toml`

---

## 28. Findings Fixed (local/config)

1. Backend Dockerfile non-root + pinned Node + HEALTHCHECK  
2. Frontend unprivileged Nginx + strip maps + HEALTHCHECK  
3. Compose: read_only, tmpfs, cap_drop, no-new-privileges, loopback ports, pids/mem soft limits  
4. Frontend + host Nginx hardening templates (SSE, deny sensitive files, HSTS, default_server 444)  
5. `.dockerignore` root/backend/frontend  
6. Neon test DB second allow flag (`ALLOW_NEON_TEST_DATABASE`)  
7. Production env validation: TLS URL + `PUBLIC_BASE_URL` https  
8. `app.disable('x-powered-by')`  
9. Express/`proxy-addr` + `tar` critical overrides; axios bump  
10. CI secret/audit/SAST gates + FE dist checks  
11. Puppeteer extra disable flags (sandbox still required)  

---

## 29. Remaining Risks

| ID | Severity | Item |
|---|---|---|
| P4-D1 | P1 | Local Docker build/scan/smoke not executed (tooling missing) |
| P4-D2 | P1 | Remaining high CVEs (puppeteer, xlsx, FE build toolchain) |
| P4-D3 | P1 | Live Nginx/TLS/HSTS not applied |
| P4-D4 | P2 | Neon runtime vs migrator role split not live-verified |
| P4-D5 | P2 | Chromium `--no-sandbox` retained |
| P4-D6 | Carry | Phase 1D JWT-in-URL remnants may still exist elsewhere (out of Phase 4 scope) |

No confirmed **P0** infrastructure finding (no privileged containers, no docker.sock, no verified secret committed).

---

## 30. Production Deployment Requirements (manifest — DO NOT EXECUTE)

1. Build images on CI/Docker host; record Git SHA + image digests  
2. Trivy scan; address CRITICAL runtime CVEs or file exceptions  
3. Generate SBOM artifact  
4. Apply `deploy/nginx-eprojecto.com.conf` (+ legacy redirect) carefully; reload Nginx  
5. Ensure host proxy targets **frontend :8080** (port change from older :80 image)  
6. Confirm `.env` permissions 600; `NODE_ENV=production`; MFA/JWT/PUBLIC_BASE_URL set  
7. Confirm Neon role least privilege; migrations via `DIRECT_URL` + `prisma migrate deploy` only  
8. Confirm R2 scoped keys + CORS  
9. Backup/PITR check + restore drill on non-prod  
10. Separate approval gate before any SSH/deploy  

**Suggested commit message (do not auto-commit):**  
`security: harden infrastructure containers secrets and supply chain`

---

## Acceptance Criteria Checklist

| Criterion | Status |
|---|---|
| Non-root where practical | PASS (config) |
| No privileged containers | PASS |
| No docker.sock / bad host mounts | PASS |
| Secrets not baked / FE bundle clean | PASS (local FE build) |
| Env separation + test DB guard | PASS (Neon gate added) |
| Nginx hardened in repo | PASS |
| TLS documented | PASS |
| DB least privilege plan | PARTIAL (documented) |
| DB TLS enforced in startup | PASS |
| Backups recommendations | PARTIAL |
| Critical deps addressed | PASS (proxy-addr/tar) |
| Secret scan | PASS (local patterns; CI ready) |
| SAST | PARTIAL (CI advisory) |
| Container scan | NOT_AVAILABLE |
| Local Docker build/smoke | NOT_AVAILABLE |
| No prod deploy | PASS |
