# BATTECHNO LMS P0.1A — Direct Production Database Latency Verification

**Date:** 2026-09-10 (UTC)  
**Mode:** Direct production diagnostic only. No DATABASE_URL change, no Neon region change, no deploy, no restart, no migrations.  
**Production:** `https://lms.battechno.com` → `187.55.228.232`  
**Project:** `/root/BATTECHNO_LMS`  
**Backend container:** `battechno-lms-backend` (`127.0.0.1:4400` → `4000`)  
**Suggested commit (not created):** `chore: verify production neon latency from backend server`

Secrets were parsed on the server and never printed (no passwords, JWT, or full `DATABASE_URL`).

---

## Production identity

| Check | Result |
|---|---|
| SSH | PASS (`root@187.55.228.232`) |
| Hostname | `srv1829646` / `srv1829646.hstgr.cloud` |
| Public IPv4 | `187.55.228.232` on `eth0` |
| Project root | `/root/BATTECHNO_LMS` present |
| Backend container | `battechno-lms-backend` Up 31 hours (healthy) |
| Port map | `127.0.0.1:4400->4000/tcp` |
| Image workdir | `/app` |
| `orderzhouse` / `72.61.179.29` | **Not used** |

This is the BATTECHNO LMS production host. Diagnostic continued.

---

## Server location

```text
Server provider: Hostinger International Limited (AS47583, “HOSTINGER FR”)
Server hostname: srv1829646 / srv1829646.hstgr.cloud
Server region: Île-de-France
Server country: France (Paris)
Confidence: CONFIRMED
```

Evidence:

* `ipinfo.io`: city Paris, `Europe/Paris`, org AS47583 Hostinger
* `ip-api.com`: country France, ISP HOSTINGER FR
* `hostnamectl`: KVM VM, Ubuntu 24.04.4 LTS

No networking was changed.

---

## Live Neon endpoint

```text
Neon cloud: AWS
Neon region: us-east-2 (Ohio)
Neon endpoint type: POOLED
Live Database Endpoint: POOLED
```

```text
DB host: ep-divine-dust-ajorp5w4-pooler.c-3.us-east-2.aws.neon.tech
DB port: 5432
DB name: neondb
SSL: sslmode=require
Endpoint type: POOLED
Pooler detected: YES
```

DNS:

* CNAME → `c-3.us-east-2.aws.neon.tech`
* A records: `13.58.237.212`, `3.21.66.37`, `18.216.137.125` (AWS us-east-2)
* TLS certificate CN: `*.c-3.us-east-2.aws.neon.tech`

**Region mismatch: YES** (Paris Hostinger VPS ↔ Neon AWS us-east-2).

---

## Prisma / PgBouncer configuration

Live container **environment** `DATABASE_URL` does **not** itself contain `pgbouncer`, `connection_limit`, `pool_timeout`, or `connect_timeout`.

The running image **does** apply them at Prisma client construction (`/app/src/config/prismaPoolUrl.js`), because the hostname contains `-pooler`:

```text
runtime_pgbouncer: true
runtime_connection_limit: 25
runtime_pool_timeout: 20
runtime_connect_timeout: 15
PRISMA_CONNECTION_LIMIT env: 25
PRISMA_POOL_TIMEOUT env: 20
NODE_ENV: production
```

```text
PgBouncer: YES (Prisma query-string pgbouncer=true on pooled Neon host)
Connection reuse: YES
```

Do **not** raise `connection_limit` based on this investigation.

---

## Local health benchmark (from the VPS)

Removes browser/user Internet latency.

### `http://127.0.0.1:4400/health` (liveness, no DB) — 10 samples

| | ms |
|---|---|
| samples | 16.3, 3.8, 1.6, 2.0, 1.4, 1.3, 1.2, 2.5, 2.8, 1.6 |
| min | 1.2 |
| average | 3.5 |
| **p50** | **1.6** |
| p95 | 16.3 |
| max | 16.3 |
| HTTP | 200 × 10 |

The Node process and loopback HTTP path are not the 500 ms problem.

### `http://127.0.0.1:4400/health/ready` (Prisma `SELECT 1`) — 10 samples

| | ms |
|---|---|
| samples | 1262.6, 511.9, 511.5, 511.5, 514.7, 509.2, 512.9, 517.1, 515.2, 512.4 |
| min | 509.2 |
| average | 587.9 |
| **p50** | **512.4** |
| p95 | 1262.6 |
| max | 1262.6 |
| HTTP | 200 × 10, `database: connected` |

Extra 5 warm samples on the already-running pool: 609.0, 507.1, 510.3, 512.8, 511.8.

The first ready sample (~1263 ms) is a **new/cold connection** cost. Steady ready samples sit at **~510–517 ms**.

---

## Prisma `SELECT 1` (inside `battechno-lms-backend`)

New Node process using production `/app/src/config/db.js` (same pool params as the API). 1 first query + 15 sequential warm queries. Read-only. No restart.

```text
first (connection + query): 1555.3 ms
warm samples (ms):
511.9, 512.5, 513.2, 513.5, 511.7, 511.4, 512.3, 515.6,
512.5, 511.8, 512.1, 513.7, 513.5, 514.5, 511.3
```

| Warm Prisma SELECT 1 | ms |
|---|---|
| n | 15 |
| min | 511.3 |
| **average** | **512.8** |
| **p50** | **512.5** |
| p95 | 515.6 |
| **max** | **515.6** |

Matches `/health/ready` on the live process. Extremely tight spread (511–516 ms).

---

## Native PostgreSQL `SELECT 1` (`psql`, already installed)

Same live URL (never printed). One session, `\timing`, 16× `SELECT 1`.

| | ms |
|---|---|
| separate process (connect + query) | 824.7 |
| in-session samples | 90.1 … 92.3 |
| first in session | 90.1 |
| warm min | 90.0 |
| warm average | 90.8 |
| **p50** | **90.5** |
| p95 | 92.3 |
| max | 92.3 |

**Prisma is ~5.6× slower than native `psql` on the same host and database** (512 ms vs 91 ms). Prisma is therefore **not** “just the transatlantic ping,” and native SQL is **not** 500 ms.

---

## DNS

| | |
|---|---|
| `dig` query time | **1 ms** (systemd-resolved `127.0.0.53`) |
| `getent hosts` 8× | 3.5–14.2 ms, avg 9.1 ms |

DNS does **not** explain 500 ms request latency.

---

## TCP connect (port 5432)

| Target | p50 |
|---|---|
| Neon hostname | **95.9 ms** (8 samples, 91.8–101.7) |
| Repeat hostname | **93.7 ms** |
| IPv4 `13.58.237.212` | **98.5 ms** |

```text
TCP connect p50: ~96 ms
```

IPv4 vs hostname is the same. Not an IPv6-only penalty.

This **is** compatible with Paris → AWS Ohio (one TCP handshake ≈ one RTT).

---

## TLS / Postgres connection setup

| Layer | Estimate |
|---|---|
| TCP connect | ~96 ms |
| `openssl s_client` to `:5432` (TCP+TLS) p50 | **313 ms** |
| Implied TLS after TCP | ~200–220 ms (~2 extra RTTs) |
| `psql` new process | 825 ms |
| Prisma first query | 1555 ms |
| Extra vs warm Prisma | 1555 − 513 ≈ **1043 ms** |

```text
Connection setup latency: ~735–1040 ms on a brand-new connection
Warm reused connection extra setup: ~0 ms
```

OpenSSL presented a valid Let’s Encrypt cert for `*.c-3.us-east-2.aws.neon.tech`.

---

## Connection reuse and pool status

```text
Connection reuse: YES
Pool saturation: NO
```

Evidence:

* Prisma first query 1555 ms, then 15 queries locked at 511–516 ms (not reconnecting each time).
* Live `/health/ready` after the process has been up 31 hours: ~510 ms.
* `P2024` in backend logs last 48h: **0**
* Pool-timeout-like log lines last 48h: **0**

`pg_stat_activity` (counts only):

| state | n |
|---|---|
| idle | 9 |
| null | 7 |
| active | 1 |
| waiting (non-idle with wait_event) | 0 |

No connection-queue or Neon limit saturation signal.

---

## Cold vs warm / Neon compute

```text
Classification: STEADY_STATE_LATENCY
Cold start dominant: NO
Neon autosuspend: not the warm-path cause
```

Warm Prisma and warm `/health/ready` stay ~512 ms **consistently**. If compute were cold, later samples would drop. They do not.

A **new** Prisma process still pays ~1.5 s on the first query (TCP+TLS+auth+first SELECT). That is mixed setup cost, not production’s steady API path (container already warm for 31 hours).

---

## Safe traceroute

`traceroute` not installed. `tracepath` (IPv6) to the Neon hostname:

* Hops 1–8: Hostinger / European transit, **&lt; 2 ms**
* Hop 9 onward: **~81–104 ms** into AWS (`2620:107:4000:…`)

The jump at hop 9 is the Atlantic crossing. Path is Europe → US East, not a mystery 500 ms LAN issue.

ICMP ping was blocked/failed (`timeout 8 ping`).

---

## Latency decomposition

```text
Browser/user -> VPS:
not re-measured from a public client this session.
P0.1 public /health/ready p50 ~568 ms ≈ local ready ~512 ms,
so user→VPS is small vs the database.

VPS local /health:
p50 1.6 ms

VPS local /health/ready:
p50 512.4 ms (steady ~510–517; first sample 1263 ms)

Prisma SELECT 1 (inside container, warm):
p50 512.5 ms  avg 512.8 ms  max 515.6 ms

Native SELECT 1 (psql, same session, warm):
p50 90.5 ms

DNS:
~1 ms (dig); getent ~9 ms avg — not material

TCP connect:
p50 ~96 ms

TLS/Postgres connection:
openssl TCP+TLS p50 ~313 ms
new psql process ~825 ms
new Prisma process first query ~1555 ms
```

---

## Root cause

```text
Primary Root Cause: MULTIPLE_FACTORS
Confidence: HIGH_CONFIDENCE
```

Validated factors:

1. **REGION_DISTANCE — CONFIRMED (~90–100 ms RTT)**  
   Paris Hostinger → Neon AWS `us-east-2`. TCP ~96 ms, `psql SELECT 1` ~91 ms, transatlantic hop ~85–104 ms.  
   **Not** “Paris to Ohio = 500 ms”. A single network round trip is ~90–100 ms.

2. **PRISMA_OVERHEAD — HIGH_CONFIDENCE (~420 ms extra per `SELECT 1`)**  
   Warm Prisma / `/health/ready` ≈ **512 ms** vs native `psql` **91 ms** on the same path.  
   Ratio ≈ **5.6×**, and Prisma warm samples are almost perfectly flat. That is consistent with several **sequential PostgreSQL protocol round trips** (extended query / engine chatty-ness), each paying the ~90 ms RTT:  
   `5–6 × ~90 ms ≈ 450–540 ms`.  
   `psql` uses a simple query (one RTT).

3. **CONNECTION_SETUP — CONFIRMED for new connections only**  
   Extra ~0.7–1.0 s vs warm. Not the steady 512 ms.

Ruled out as the **warm 512 ms** cause:

| Candidate | Verdict |
|---|---|
| POOL_SATURATION | NO (0× P2024, idle connections, no wait) |
| POOL_CONFIGURATION (limit 25) | Not saturated; `pgbouncer=true` is appropriate for `-pooler` |
| NEON_COLD_COMPUTE | NO for warm path |
| DNS_LATENCY | NO (~1 ms) |
| SERVER_NETWORKING (VPS CPU/HTTP) | NO (`/health` 1.6 ms) |
| “500 ms is just geography” | **False** — geography is ~90 ms; Prisma multiplies it |

---

## EU target (estimate only)

Best practical Neon region for this Paris VPS: **AWS `eu-central-1` (Frankfurt)**.  
Alternative: `eu-west-1` (Ireland).

Do **not** treat this as a promise:

* Today: 1 RTT ≈ 90–100 ms; Prisma `SELECT 1` ≈ 512 ms (≈ 5–6 RTTs).
* If Frankfurt RTT is ~10–20 ms (typical, **not measured from this VPS to a Neon EU endpoint**):  
  Prisma `SELECT 1` could fall to **roughly 80–150 ms** if the same Prisma round-trip count remains.
* Native `psql SELECT 1` could fall to **roughly 10–30 ms**.

**Estimated improvement (conservative):** on the order of **350–430 ms** off each Prisma database round trip, **if** protocol chatter stays similar. Not guaranteed without an EU endpoint measurement.

---

## Migration decision

```text
EU_MIGRATION_STRONGLY_RECOMMENDED
```

Region mismatch is real and multiplies Prisma’s per-query RTT count. Pooling/connection-limit changes are **not** the primary fix and should **not** be done first.

* Do **not** blindly increase `connection_limit`.
* Keep pooled Neon + `pgbouncer=true` if the EU endpoint is also a pooler.
* A later Prisma protocol/simple-query investigation could reduce the multiplier **without** migration, but it would not remove the 90 ms RTT, and every extra Prisma round trip would still be expensive until the database is close to Paris.

**This phase made no production change.**

---

## Production change made

**NO**

* No `DATABASE_URL` change  
* No Neon region change  
* No dump/restore  
* No restart  
* No package install  
* Temporary `/tmp` probe files removed
