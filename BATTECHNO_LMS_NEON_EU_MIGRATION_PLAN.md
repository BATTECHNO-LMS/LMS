# BATTECHNO LMS — Neon EU Region Migration Plan

**Date:** 2026-08-26  
**Status:** PLAN ONLY. Not executed.  
**Production app:** `187.55.228.232` (`srv1829646`, Paris / Hostinger)  
**Production domain:** `https://lms.battechno.com`  
**Current database:** Neon AWS `us-east-2` (Ohio), database `neondb`

This document prepares a later cutover from:

```text
Paris App  →  Neon us-east-2 (Ohio)
```

to:

```text
Paris App  →  Neon EU (Frankfurt)
```

**Do not** create a production target project, copy production data, change `DATABASE_URL` / `DIRECT_URL`, or restart the app onto a new database without explicit user approval.

Neon cannot change the region of an existing project. A new project in the target region is required, then a data migration. See [Neon regions](https://neon.com/docs/introduction/regions) and [region migration](https://neon.com/docs/import/region-migration).

---

## 1. Current database inventory

| Item | Value |
|---|---|
| Provider | Neon PostgreSQL |
| Project region | AWS US East (Ohio) `aws-us-east-2` |
| Pooler host (runtime) | `ep-divine-dust-ajorp5w4-pooler.c-3.us-east-2.aws.neon.tech` |
| Direct host (migrate) | same endpoint with `-pooler` stripped: `ep-divine-dust-ajorp5w4.c-3.us-east-2.aws.neon.tech` |
| Database name | `neondb` |
| Schema | `public` |
| App `DATABASE_URL` | pooled Neon URL (PgBouncer) |
| App `DIRECT_URL` | not set in the production container; `scripts/start-production.js` derives the non-pooler host for `prisma migrate deploy` |
| Prisma | 51 applied migrations after 2026-08-26 deploy (includes additive `20260819120000_training_query_performance_indexes`) |
| Measured warm `SELECT 1` from the Paris app | **median 503.3 ms** (SQL execution itself is ~0.02 ms) |
| Measured local `/health/ready` | **median 484.5 ms** |

Do not print full connection strings or passwords in this plan.

---

## 2. Target region

**Recommended target:** AWS Europe (Frankfurt) — `aws-eu-central-1`.

Reason:

- The application VPS is in Paris.
- Neon’s currently advertised EU AWS regions are **Frankfurt** (`aws-eu-central-1`) and **London** (`aws-eu-west-2`). There is **no Neon Paris (`eu-west-3`)** region.
- Frankfurt is the closer continental EU option for a Paris app and is Neon’s primary EU region.

**Alternative:** `aws-eu-west-2` (London) if legal/residency requirements prefer the UK.

Expected result after cutover (not measured; do not treat as a guarantee):

- App → DB RTT should fall from ~500 ms toward typical same-continent tens of milliseconds.
- Authenticated pages that still need 2 auth waves would drop from ~1.0–1.5 s of DB wait toward ~50–150 ms of DB wait, plus handler time.

---

## 3. Backup

Before any copy:

1. Neon console: create a manual snapshot / PITR checkpoint on the **source** project and record the timestamp.
2. Logical backup from the **direct** (non-pooler) endpoint:

```bash
pg_dump --format=custom --no-owner --no-acl \
  --dbname="$SOURCE_DIRECT_URL" \
  --file=battechno-lms-neondb-$(date -u +%Y%m%dT%H%M%SZ).dump
```

3. Store the dump off the VPS (object storage), and keep a checksum.
4. Do **not** use `DROP DATABASE`, `TRUNCATE`, or `prisma migrate reset`.

---

## 4. Migration strategy

Preferred order (choose one after a staging rehearsal):

1. **Logical replication** (lowest downtime if WAL / publication is available on the source plan).
2. **`pg_dump` / `pg_restore`** during a short maintenance window (simplest, easiest to verify).
3. Neon **Import Data Assistant** only if it covers the full schema + data and is rehearsed on a copy first.

Recommendation for this product: **rehearse dump/restore**, then decide whether replication is worth the extra operational complexity. Training/LMS data is not a multi-terabyte OLTP store; dump/restore is usually enough if the window is announced.

---

## 5. Maintenance / low-downtime strategy

**Dump/restore window (recommended first rehearsal):**

1. Put the LMS in read-only or maintenance (stop writes: backend container stopped or auth disabled).
2. Final `pg_dump` from source direct URL.
3. Restore into the **new** EU project.
4. Reconcile row counts and sequences.
5. Point `DATABASE_URL` / derived `DIRECT_URL` at the EU pooler + direct endpoints.
6. Start backend; confirm `/health/ready`.
7. Keep the Ohio project **untouched** for rollback.

**Replication window (optional later):**

1. Create EU project and empty schema (`prisma migrate deploy` against EU `DIRECT_URL` only).
2. Set up publication/subscription.
3. Wait for catch-up.
4. Quiesce writes, wait for lag = 0, cut over URLs, then drop subscription.

Do not overlap GigzHouse or other VPS sites in the maintenance plan.

---

## 6. Schema

- Create the EU project **empty**.
- Apply the **same Prisma migration history** with `prisma migrate deploy` using the EU **direct** URL.
- Do not `db push --force-reset`.
- Do not invent extra indexes for this move.

---

## 7. Data copy

- Copy **all** current product tables, including legacy QA / recognition / evidence tables (they stay in the schema; they are simply not queried by default analytics).
- Copy large objects only if they live in Postgres. Uploads/certificates files remain on the VPS volume / R2 and must **not** be moved as part of the DB region change.
- Exclude Neon-internal catalogs.

---

## 8. Sequences

After restore, for every `serial` / `identity` / sequence-backed column:

```sql
SELECT pg_get_serial_sequence(table_name, column_name);
SELECT setval(sequence_name, (SELECT COALESCE(MAX(id), 1) FROM table_name));
```

Prisma UUID primary keys do not need sequence repair. Integer sequences (if any) must be repaired or inserts will collide.

---

## 9. Foreign keys

- Restore with constraints enabled **or** restore `--disable-triggers` then `VALIDATE CONSTRAINT` / re-enable.
- After restore, fail the cutover if `pg_constraint` invalid FKs exist.

---

## 10. Indexes

- Confirm `pg_indexes` count and names match source.
- Additive training indexes (`idx_training_enrollments_cohort_status`, attempt indexes) must exist on EU after migrate deploy + restore.

---

## 11. Extensions

Inventory on source before copy:

```sql
SELECT extname, extversion FROM pg_extension ORDER BY 1;
```

Create the same extensions on the EU project **before** restore (`uuid-ossp` / `pgcrypto` / etc. as present).

---

## 12. Verification

On a **staging** EU database first, then on production EU only after approval:

- `prisma migrate status` → up to date
- `/health` and `/health/ready` from the Paris VPS
- Login for University Admin, Institution Admin, Student, Trainee, Instructor, Trainer, Reviewer, Super Admin (read-only)
- One Field Training overview, one course list, one certificate verify
- Compare `information_schema.tables` lists

---

## 13. Row-count reconciliation

For every user-facing table (at minimum):

`users`, `user_roles`, `user_organization_assignments`, `organizations`, `universities`, `cohorts`, `enrollments`, `sessions`, `courses`, `course_lessons`, `assessments`, `submissions`, `grades`, `certificates`, `field_training_opportunities`, `field_training_applications`, `training_programs`, `training_enrollments`, `training_sessions`, `notifications`

```sql
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;
```

Cut over only if source and target counts match (or documented empty-table exceptions).

---

## 14. Application cutover

1. Confirm EU `/health/ready` from a one-off Prisma script **before** changing the running app.
2. Update only BATTECHNO LMS `backend/.env` on `187.55.228.232` (`DATABASE_URL`, and set `DIRECT_URL` explicitly to the EU non-pooler host).
3. `docker compose up -d backend` (LMS only).
4. Do not rebuild unrelated images. Do not `docker system prune`.

---

## 15. `DATABASE_URL` update

- Runtime URL must remain the **pooled** (`-pooler`) endpoint in the new region.
- Keep `sslmode=require`.
- Do not point the Node app at the direct host for normal traffic.

---

## 16. Pooling endpoint

Neon pooler hostname pattern:

```text
ep-<endpoint>-pooler.<region>.aws.neon.tech
```

After EU project creation (when approved), record:

- pooled URL → `DATABASE_URL`
- Prisma connection_limit already set via `PRISMA_CONNECTION_LIMIT=25`

---

## 17. `DIRECT_URL` for migrations

Set `DIRECT_URL` to the **non-pooler** EU host. `prisma migrate deploy` cannot use PgBouncer advisory locks reliably (P1002). The start script already strips `-pooler` if `DIRECT_URL` is empty; setting it explicitly is safer after a region change.

---

## 18. Rollback

Keep the Ohio project **live and unmodified** for at least 72 hours.

Rollback:

1. Restore previous `backend/.env` (`DATABASE_URL` back to us-east-2 pooler).
2. Recreate/restart only `battechno-lms-backend`.
3. Confirm `/health/ready` and a read-only login.

Do not delete the EU project until rollback is no longer needed.

---

## 19. Post-cutover benchmark

Repeat the same probes used in the 2026-08-26 performance fix:

From `187.55.228.232`:

- local `http://127.0.0.1:4400/health` (expect ~2 ms)
- local `/health/ready`
- warm `SELECT 1` inside the backend container
- public `https://lms.battechno.com/health` and `/health/ready`

Success criterion: warm `SELECT 1` **materially below 100 ms**, not ~500 ms.

---

## 20. Explicit non-actions (until approved)

- Do not create the production EU Neon project yet.
- Do not copy production data.
- Do not change `DATABASE_URL`.
- Do not restart production onto a new database.

---

## 21. Approval checklist (for a later session)

- [ ] User approves Frankfurt (`aws-eu-central-1`) vs London (`aws-eu-west-2`)
- [ ] Staging dump/restore rehearsal succeeded
- [ ] Maintenance window scheduled
- [ ] Rollback `.env` backup taken on the VPS
- [ ] Row-count script prepared
- [ ] Explicit go-ahead to create the EU project and copy data
