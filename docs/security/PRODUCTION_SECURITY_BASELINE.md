# eprojecto Production Security Baseline (Phase 4)

Local/repository baseline only. Applying this on a live host requires a **separate approved deployment phase**.

## Required runtime environment (names only)

| Variable | Notes |
|---|---|
| `NODE_ENV` | Must be `production` |
| `DATABASE_URL` | TLS required (`sslmode=require` or Neon-enforced TLS) |
| `DIRECT_URL` | Optional Neon non-pooler URL for migrations |
| `JWT_SECRET` | ≥32 chars; rotate on compromise |
| `MFA_ENCRYPTION_KEY` | 32 random bytes (base64 or 64 hex); required when MFA on |
| `MFA_ENABLED` | Must be `true` in production |
| `PUBLIC_BASE_URL` | Canonical HTTPS origin for links (not request Host) |
| `CORS_ORIGINS` | Explicit allowlist |
| `TRUST_PROXY` | Trusted hop count / Phase 1A setting |
| `STORAGE_BACKEND` | `local` or `r2` |
| `R2_*` | Required when `STORAGE_BACKEND=r2` |
| `RESEND_API_KEY` | Email provider (auth/OTP) |
| `UPLOAD_DIR` | Writable uploads path inside container |

## Forbidden production settings

- `MFA_ENABLED=false`
- Weak / short `JWT_SECRET`
- `DEBUG=*` / verbose Prisma query logging left on
- `privileged: true` containers
- Mounting `/var/run/docker.sock` into app containers
- Publishing backend `4000` / frontend `8080` on `0.0.0.0` (use loopback + host Nginx)
- Baking `.env` / secrets into image layers
- `prisma migrate dev` / `db push --force-reset` in deploy scripts
- Sharing production Neon credentials with local/test without explicit allow flags

## Containers

| Service | Runtime user | Root? | Writable paths | Capabilities |
|---|---|---|---|---|
| backend | `node` (uid 1000) | No | `/app/uploads`, tmpfs `/tmp`, `/app/tmp`, `/home/node/.cache` | `cap_drop: ALL` |
| frontend | `nginx` (unprivileged image) | No | tmpfs `/tmp`, `/var/cache/nginx`, `/var/run` | `cap_drop: ALL` |

- `read_only: true` root filesystem
- `no-new-privileges: true`
- No Docker socket
- Healthchecks hit `/health` only (no secrets)

## Required browser / edge headers

- `Strict-Transport-Security` (no `preload` until all subdomains confirmed)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN` (or CSP `frame-ancestors`)
- `Permissions-Policy` restrictive defaults
- CSP tuned for SPA + YouTube + fonts (validate before tightening further)
- `server_tokens off`
- `autoindex off`
- Deny `/\.` and backup/secret extensions

## Database role expectations

| Capability | Runtime app | Migration role |
|---|---|---|
| SELECT/INSERT/UPDATE/DELETE on app tables | Yes | Yes |
| CREATE/ALTER/DROP schema | No | Yes |
| SUPERUSER / CREATEDB / CREATEROLE | No | No |
| audit_logs UPDATE/DELETE | Prefer No (future) | Ops only |

Neon/Prisma: use pooled URL for runtime (`-pooler` + `pgbouncer=true`); `DIRECT_URL` for `prisma migrate deploy` only.

## Secrets handling

- Inject via environment / secret store at runtime — never `COPY .env` into images
- Frontend may only receive non-secret `VITE_*` build args
- Rotate on leak; document owner + date in exception log
- Secret scan (Gitleaks) must pass before merge

## Logging

- Request IDs from trusted proxy (`X-Request-Id`)
- Redact tokens/passwords/bodies (Phase 1A redaction)
- Restrict OS permissions on Nginx/Docker/app log files (ops)
- No stack traces with secrets to clients

## Backups

- Prefer provider PITR (Neon) + encrypted off-host dumps if used
- Never store dumps under web root or world-readable `/tmp`
- Retention: classify ACTIVE / REQUIRED / RETENTION_REVIEW / OLD_UNKNOWN
- RPO/RTO: **POLICY_REQUIRED** until business owners set targets
- Restore drill on non-production only

## Deployment gates

1. Backup / PITR status confirmed
2. `prisma migrate deploy` only (never `migrate dev`)
3. Image digest / Git SHA recorded
4. Secret scan + unit/security tests green
5. Critical reachable dependency CVEs addressed or explicitly excepted
6. Separate human approval for production apply

## CI security sequence (supported)

```text
npm ci → unit tests → integration (guarded test DB) → frontend build
→ secret scan (gitleaks) → npm audit (high+) → (optional) Semgrep / Trivy
```

Container build/scan run on a Docker-capable runner (not required on Windows agent hosts).

## Explicit exceptions format

```text
finding:
reason:
owner:
expiry:
mitigation:
```
