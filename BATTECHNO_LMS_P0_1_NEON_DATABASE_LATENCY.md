# BATTECHNO LMS P0.1 — Neon Database Connection Latency

**Date:** 2026-09-10  
**Mode:** Diagnose the Neon connection path only. No application-query, auth, frontend, or Nginx work.  
**Production:** `https://lms.battechno.com` → `187.55.228.232`  
**Expected project:** `/root/BATTECHNO_LMS`  
**Expected container:** `battechno-lms-backend` (`127.0.0.1:4400` → `4000`)

---

## Diagnosis

```text
Database provider: Neon PostgreSQL (from repo + prior on-server inventory; live container env not readable this session)
Database region: AWS us-east-2 (Ohio) — HIGH_CONFIDENCE from hostname DNS + 2026-08-26 on-server inventory
Application server region: Hostinger VPS 187.55.228.232 (Paris / srv1829646) — HIGH_CONFIDENCE from prior on-server audit; not re-verified this session
Endpoint type: POOLED (hostname contains -pooler) — HIGH_CONFIDENCE from 2026-08-26 container inspect + DNS still resolves; live env UNKNOWN this session
Prisma pooling: connection_limit=25, pool_timeout=20s, connect_timeout=15s, pgbouncer=true when host is -pooler (repo + compose). Live URL params UNKNOWN this session.
Cold-start latency: first SELECT 1 1267 ms on 2026-08-26 inside container (not re-measured)
Warm DB latency: ~500 ms SELECT 1 from inside container (2026-08-26); this session public /health/ready p50 568 ms
Network latency: ~500 ms app→Neon RTT (SQL itself ~0.02 ms on 2026-08-26)
Connection setup latency: ~760 ms extra on first query vs warm (1267 − 500) on 2026-08-26
```

### This session — Step 1 SSH

```text
ssh -o BatchMode=yes -o IdentitiesOnly=yes -i %USERPROFILE%\.ssh\id_ed25519 root@187.55.228.232
```

**Result:** `Permission denied (publickey,password)`.

| Check | Result |
|---|---|
| TCP/SSH reachable | YES (OpenSSH_9.6p1 Ubuntu) |
| Host key | known (`known_hosts` line 7) |
| Key offered | `id_ed25519` fingerprint `SHA256:mdI3Y+3CGuAXSvtxk3016t9WOjjb0N73b4ESe+A6sso` |
| Key accepted | NO |
| Password attempted | NO (non-interactive; BatchMode) |
| `hostname` / `docker ps` / `/root/BATTECHNO_LMS` | NOT RUN |

**Access required to continue P0.1 on the server**

1. **Preferred:** install this workstation’s public key on the VPS:

```text
# on 187.55.228.232 as root
mkdir -p /root/.ssh
chmod 700 /root/.ssh
# append:
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIh7fbRifK3e9RcofbrEWLTUoCljF5b5vniM6alRqMDn bahaaabufarash@gmail.com
chmod 600 /root/.ssh/authorized_keys
```

2. **Or** provide the **root password** for `187.55.228.232` (a previous on-server audit used password auth; this environment cannot type an interactive password).

3. Do **not** use SSH config host `orderzhouse` (`72.61.179.29`). That is a different server.

Until one of those is available: **STOP**. No container inspect, no Prisma probe inside the backend, no config change.

### Steps 2–10 — what could still be said without SSH

Live container `DATABASE_URL` was **not** read. The following is **not** a substitute for Step 2.

**Repo / compose (what the backend *would* apply if production still uses that image):**

| Setting | Value |
|---|---|
| `PRISMA_CONNECTION_LIMIT` | `25` (`docker-compose.yml`) |
| `PRISMA_POOL_TIMEOUT` | `20` |
| `connect_timeout` | `15` (injected by `prismaPoolUrl.js` if missing) |
| `pgbouncer=true` | set automatically **only if** hostname contains `-pooler` |
| Runtime vs migrate | `DATABASE_URL` stays pooled; `start-production.js` strips `-pooler` for `prisma migrate deploy` only |

**Prior on-server inventory (2026-08-26, password SSH, same IP):**

```text
Host: ep-divine-dust-ajorp5w4-pooler.c-3.us-east-2.aws.neon.tech
Port: 5432
Pooler: YES
SSL: YES
Database: neondb
Connection limit: 25
```

**This session DNS (no credentials):** that pooler hostname still aliases to `c-3.us-east-2.aws.neon.tech` with AWS `us-east-2` addresses (`13.58.237.212`, `3.21.66.37`, `18.216.137.125`). That supports **Ohio**, not Paris.

**Geographic mismatch (not changed this session):**

```text
BATTECHNO server: Paris (Hostinger srv1829646)     vs
Neon database:    AWS us-east-2 (Ohio)
```

Meaningful mismatch: **YES** (HIGH_CONFIDENCE). Transatlantic RTT of ~80–120 ms one-way is enough to produce ~500 ms observed Prisma `SELECT 1` when TLS/auth/pooler overhead is included.

A pooling-parameter tweak **cannot** remove transatlantic distance. Neon cannot move an existing project’s region; a new EU project + data copy is required (`BATTECHNO_LMS_NEON_EU_MIGRATION_PLAN.md`). That migration was **not** executed (out of scope for a low-risk connection-string fix).

### Layer evidence (narrowing “Neon latency”)

| Layer | This session | 2026-08-26 inside `battechno-lms-backend` |
|---|---|---|
| 1. DNS | Pooler hostname resolves (auditor) | Not re-run |
| 2. TCP | Not measured from VPS | Path exists; warm queries stay ~500 ms |
| 3. TLS | Not measured from VPS | Included in first-query 1267 ms |
| 4. PG auth | Unknown | Included in connection setup |
| 5. New connection | Unknown | Cold 1267 ms vs warm ~500 ms |
| 6. Prisma pool wait | Not measured | Warm samples tight 498–505 ms → not waiting on a saturated pool |
| 7. Actual SQL | Not measured | `EXPLAIN ANALYZE SELECT 1` **~0.02 ms** |
| 8. Neon cold/idle | Public `/health/ready` 10 warm samples all 563–613 ms, no 1.2 s spike | First query 1267 ms then steady ~500 ms |
| 9. Network distance | Public ready−health ≈ **490 ms** | Local ready−health ≈ **499 ms** |
| 10. Pool misconfig | Not readable live | Already on `-pooler` + Prisma 25. Larger pool would not cut RTT |

**Classification (warm path):** `STEADY_STATE_DATABASE_RTT`  
**Cold-start:** present as an extra ~700–800 ms on the first query after idle (2026-08-26), **not** the cause of the 500 ms floor.

### External corroboration (auditor machine, not inside the container)

10 warm samples, 2026-09-10, `https://lms.battechno.com`:

| Probe | p50 | average | max | HTTP |
|---|---:|---:|---:|---|
| `/health` | 78 ms | 80 ms | 95 ms | 200 × 10 |
| `/health/ready` | 568 ms | 574 ms | 613 ms | 200 × 10 |

Implied extra DB cost from outside: **~490 ms**. Database remained connected (`/health/ready` never 503).

Prisma `SELECT 1` from inside the container: **not measured this session**.

---

## Root cause

**Primary cause:** the application in Paris talks to Neon in **AWS us-east-2**. Warm `SELECT 1` is ~500 ms of **network RTT**, not slow SQL and not a down database.

**Confidence:** `HIGH_CONFIDENCE` for the region mismatch and steady-state RTT. `NEEDS_MORE_DATA` for live container URL/pool params **this session** because SSH failed.

Not the primary cause (already-known, not changed here): auth query count, sequential Prisma, frontend waterfalls.

---

## Change made

```text
NO PRODUCTION CHANGE MADE
```

Reason: SSH was blocked, so the running container could not be verified or edited. Even with access, the evidence-based fix is **Neon region migration**, which this phase forbids executing automatically.

No `DATABASE_URL` edit, no pool-size change, no container restart.

---

## Before vs After

Inside-container Prisma / `127.0.0.1:4400` probes: **not run** (SSH denied).

Public HTTPS (auditor), 10 warm samples — no config change, so after = before:

```text
/health
BEFORE (this session, public):
p50: 78 ms
average: 80 ms
max: 95 ms

AFTER:
p50: 78 ms
average: 80 ms
max: 95 ms
(no change)

/health/ready
BEFORE (this session, public):
p50: 568 ms
average: 574 ms
max: 613 ms

AFTER:
p50: 568 ms
average: 574 ms
max: 613 ms
(no change)

Prisma SELECT 1
BEFORE (inside container): not measured this session
  (2026-08-26 inside backend: warm p50 499.8 ms, avg 500.3 ms, max 505.0 ms; cold 1267 ms)
AFTER:
not measured
```

Ideal warm DB latency `< 100 ms` was **not** reached. The measured lower bound while Paris remains paired with `us-east-2` is about **500 ms**.

---

## Result

```text
BLOCKED
```

Also: **REQUIRES_REGION_MIGRATION** to get below 100 ms. Do not treat pooling as the remaining lever.

Recommended (do not execute in P0.1): follow `BATTECHNO_LMS_NEON_EU_MIGRATION_PLAN.md` — new Neon project in `aws-eu-central-1` (Frankfurt), copy data, point `DATABASE_URL` / `DIRECT_URL`, then re-benchmark `/health/ready` from `127.0.0.1:4400`.

---

## Next recommended phase

Do not execute it until SSH works **or** after EU cutover.

```text
P0.2 Authentication Database Overhead
```

That phase still pays the 500 ms RTT once per query until the database is closer. Auth caching helps either way.

---

## Regression checks

Not run (no production change, no SSH). Public `/health` and `/health/ready` remain HTTP 200.
