# 48 — Production Migration Drift Reconciliation (PROD-DRIFT-001 / PROD-DRIFT-RECOVERY-002)

**Date:** 2026-07-20  
**Main HEAD:** `f48274f`  
**Task status:** **COMPLETE (OPTION-B)** — canonical migration + schema in repo; production checksum reconciled to `411b2fe3…`; Neon and repository aligned **28/28**. See `49_PRODUCTION_MIGRATION_HISTORY_RECONCILIATION.md`.

No secrets, tokens, or connection strings are recorded here.

---

## 1. Phase 1 — Local repository state

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD / `origin/main` | `f48274faff1b71fe418baa2e6d6bb3dc324e8462` |
| Working tree | Dirty with RELEASE-FINAL-001 docs only (`29`, `46`, `47`, backlog); **no migration files added** |
| Migration directories on disk | **27** |
| Baseline v1 cutoff | `20260718120000_academic_submission_uniqueness` |
| Baseline represented count | **27** |
| `20260719120000_field_training_required_hours` in working tree | **Absent** |
| Tracked `.env` | **None** |

---

## 2. Phase 2 — Locate missing migration

Searched (read-only):

- All local branches (`main`, `maintenance/test-safety-baseline`, `lms1`)
- All remote-tracking branches already present (`origin/main`, `origin/B1`, `origin/B2`, `origin/lms1`, `origin/maintenance/test-safety-baseline`)
- `git log --all` path/`-S` searches for `field_training_required_hours`, `required_training_hours`, `requiredHours`
- Reflog, stashes (empty), docs, agent transcripts, Desktop/OneDrive name search

### Results

| Question | Answer |
|----------|--------|
| Exact migration directory in any fetched Git ref? | **No** |
| Commit SHA containing it? | **None found** |
| Branch containing it? | **None found** |
| Related Backend / Frontend / tests in Git? | **None** referencing `required_training_hours` |
| How it likely reached production | Applied **2026-07-19 ~13:14 UTC** via Prisma migrate from a **local (uncommitted / never-pushed)** migration directory, then the SQL was discarded or never committed |

Production application on `main` does **not** model this column in `schema.prisma` or FT validators/UI. Live column is therefore **schema drift without matching app code on `main`**.

---

## 3. Phase 3 — Read-only production evidence

### `_prisma_migrations` row

| Field | Value |
|-------|-------|
| Migration name | `20260719120000_field_training_required_hours` |
| Started | `2026-07-19T13:14:40.459Z` |
| Finished | `2026-07-19T13:14:41.306Z` |
| Applied steps | `1` |
| Rolled back | **null** |
| Logs present | **false** |
| Checksum (SHA-256 of applied `migration.sql` bytes) | `c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65` |
| Prisma success | **Yes** (`finished_at` set, not rolled back) |

Checksum algorithm confirmed: production checksums for all **27** repo migrations equal **raw SHA-256** of local `migration.sql` file bytes (Windows CRLF checkout).

### Live schema effect

| Property | Value |
|----------|-------|
| Table | `field_training_opportunities` |
| Column | `required_training_hours` |
| Type | `integer` (`int4`) |
| Nullable | **YES** |
| Default | **none** |
| Indexes / constraints on column | **none** |

### Classification

**Purely additive** nullable column. Not data-transforming, not constraint-changing, not destructive.

Applied totals: **28** successful rows, **0** pending, **0** failed. Repo folders: **27**.

---

## 4. Phase 4 — Recovery attempt (STOPPED)

Preferred order:

| Option | Result |
|--------|--------|
| A. Recover from Git commit/branch | **Failed** — file never in fetched history |
| B. Recover from deployment artifact | **Failed** — no artifact containing SQL located |
| C. Reconstruct to match checksum | **Failed** — exhaustive common Prisma/`ADD COLUMN` / CRLF/LF variants **do not** hash to `c43e180b…` |

### Stop rule applied

> If the production checksum cannot be matched: **Stop. Do not invent history.**

**No** `migration.sql` was written into the working tree. Inventing similar SQL would create a **false** history and break `prisma migrate` checksum verification against Neon.

### Evidence still needed (owner)

Recover the **exact** original file bytes that SHA-256 to:

`c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65`

Possible sources:

1. Machine / USB / zip that ran `prisma migrate deploy` on 2026-07-19 ~13:14 UTC  
2. Editor local history / Recycle Bin / cloud version history for  
   `backend/prisma/migrations/20260719120000_field_training_required_hours/migration.sql`  
3. CI/deploy logs that printed the migration contents (unlikely)  
4. Any private fork or laptop clone not present in this workspace’s remotes  

Once recovered, place the directory with the **exact** name and verify:

```text
sha256(migration.sql) === c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65
```

Then continue Phases 5–8 of this task.

---

## 5. Phase 5 — Related application code

| Area | Classification | Notes |
|------|----------------|-------|
| `schema.prisma` `field_training_opportunities` | **A missing on main** | No `required_training_hours` field |
| FT create/update validators | **A / D** | No references |
| FE opportunity forms | **A / D** | No references (`duration_hours` is micro-credentials only) |
| Reports / completion | **C unclear** | No code path found on main |
| Production runtime dependency | **Likely none on main build** | Prisma client ignores unknown DB columns on read; writes won’t set the column |

**No application code restored** (nothing authoritative to restore without inventing a feature).

---

## 6. Phases 6–8 — Alignment / baseline / empty-DB

| Gate | Status |
|------|--------|
| Repo migration count → 28 | **Blocked** (no file) |
| `prisma migrate status` vs Neon → aligned 28/28 | **Blocked** |
| Baseline v1 cutoff unchanged | **Still correct** — must remain `20260718120000_academic_submission_uniqueness` / 27 represented |
| Empty-DB: init 27 → deploy migration 28 | **Not run** (blocked on missing SQL) |

When the checksum-matched file is restored, expected empty-DB behavior (do **not** regenerate baseline v1):

1. `db:validate-baseline` / `db:init-empty` → 27 represented  
2. Migration 28 remains **pending**  
3. `prisma migrate deploy` applies it  
4. Final disposable DB **28/28** with column present  

---

## 7. Phase 9 — Frontend bundle drift

| Signal | Evidence |
|--------|----------|
| Live main bundle | `/assets/index-Cmf0WSFP.js` (675 832 bytes) |
| Local `main` rebuild | `/assets/index-CuYaHmIt.js` (731 305 bytes) |
| Live `Last-Modified` | **Wed, 15 Jul 2026 10:13:26 GMT** |
| Content SHA-256 prefix | Live `f8c9d0d33c74f2ab` ≠ local `69ef9ab97e8c015a` |
| API embedding | Both embed `lms-7txx.onrender.com`; no localhost |
| Public `.map` | URL returns SPA HTML (not a real sourcemap) |
| Vite | `5.4.21` (local) |

### Cause determination

**E — Older deployed frontend** (primary), with possible contribution from build-env differences after source advanced.

Not explained by hash nondeterminism alone: byte length differs by ~55 KB and live asset predates PR #2 merge (2026-07-19).

### Hostinger redeploy steps (do **not** execute in this task)

1. On a clean `main` checkout at the intended release SHA, set production Vite env (`VITE_API_BASE_URL=https://lms-7txx.onrender.com`, origins as in `docs/DEPLOYMENT.md`).  
2. `cd frontend && npm ci && npm run build`.  
3. Upload/replace Hostinger `public_html` (or site root) with `frontend/dist` contents.  
4. Hard-refresh / purge CDN cache if Hostinger CDN caches `index.html`.  
5. Confirm live HTML references the **new** `/assets/index-*.js` and `Last-Modified` updates.

---

## 8. Phase 10 — Render deployed SHA

Non-invasive probes:

- `/health`, `/health/ready` — no commit field  
- `/version`, `/api/version` — **404**  
- Headers — `x-render-origin-server: Render` only  

**Render SHA: unknown / not recorded.**

### Manual steps for owner

1. Open Render Dashboard → Backend service for `lms-7txx.onrender.com`.  
2. Open **Events** or **Deploys**.  
3. Open the current **Live** deployment.  
4. Copy the **Git commit SHA**.  
5. Record it in this doc / `47` without pasting secrets.

---

## 9. Remaining release blockers (unchanged + this stop)

1. **PROD-DRIFT-001** — recover checksum-matched migration SQL (this document).  
2. **REL-JWT-001** — Render JWT ≠ fingerprint `eec7827fb0`.  
3. **REL-FE-001** — redeploy FE from merged `main`.  
4. Record Render deploy SHA.  
5. QA-AUTH-001 / QA-AUTH-003 — accepted temporarily; not resolved.

---

## 10. Working-tree note

This task **did not** add migration or schema files. Documentation updates only (`48`, plus roll-forward notes in `47` / `46` / `29`).

**Not ready to claim 28/28.** Ready only for owner to supply the original `migration.sql` bytes.

---

## 11. PROD-DRIFT-RECOVERY-002 — Exhaustive checksum recovery (2026-07-20)

**Target checksum:** `c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65`  
**Exact match found:** **No**  
**Migration file created:** **No**  
**schema.prisma aligned:** **No** (blocked on exact recovery)

### Sources searched

| Source | Result |
|--------|--------|
| Reachable Git commits / all local + remote-tracking branches | No migration path; no `-S` history |
| `git fsck --full --unreachable --no-reflogs` | **471** unreachable blobs inspected; **29** content mentions (docs/scripts only); **0** checksum matches |
| Small SQL-sized dangling blobs (<4 KB) with `ALTER TABLE` + `field_training_opportunities` | **0** real migration SQL blobs; only prior recovery scripts |
| Stashes | None |
| Cursor `User/History` + VS Code History (deep walk, **8787** files) | **0** content hits for `required_training_hours` |
| Cursor/Code workspaceStorage | No migration artifact |
| OneDrive Desktop / Downloads / project copies | **0** directories named `20260719120000_field_training_required_hours`; **0** `migration.sql` containing the column |
| Windows File History local store | **Not present** on this machine |
| Recycle Bin | Exists; not safely enumerable without admin / destructive restore |
| OneDrive **web** Recycle Bin / Version History | **Requires user interaction** (steps below) |
| PSReadLine history | Many `prisma migrate deploy/dev` lines; **no** `field_training_required_hours` / `required_training_hours` / `20260719120000` |
| Bash history / `.prisma` cache | Empty / absent |
| Neon `_prisma_migrations` row | Confirmed; `logs` **null**; checksum unchanged |
| Neon SQL query history for exact statement bytes | **Not available** via this workspace (no Neon console API session) |
| Render / CI artifacts for migration SQL | Not available non-invasively |
| Bounded reconstruction | **1558** unique candidate hashes; **0** hits |

### Reconstruction method (Phase 7)

Evidence-bound variants only: Prisma `-- AlterTable` comment, quoted identifiers, `INTEGER` / `IF NOT EXISTS` / indent styles matching neighboring FT migrations, LF/CRLF, trailing newline presence/absence, optional BOM, optional `BEGIN/COMMIT`, schema-qualified names. No general SHA-256 preimage search.

### Owner steps still available (Option A)

1. **OneDrive web:** open the file or folder `…/backend/prisma/migrations/` → Version history / Recycle bin for deleted `20260719120000_field_training_required_hours`.  
2. Check other devices / USB / email zips from **2026-07-19 ~13:14 UTC**.  
3. If found, verify: `Get-FileHash -Algorithm SHA256 migration.sql` equals `c43e180b…` before placing into the repo.

### Last-resort Option B (proposal only — **not executed**)

If Option A fails permanently, a **separate explicit approval** would be required to:

1. Choose a **canonical** `migration.sql` believed equivalent to the live additive column (most likely Prisma-style):

```sql
-- AlterTable
ALTER TABLE "field_training_opportunities" ADD COLUMN "required_training_hours" INTEGER;
```

(CRLF vs LF changes the checksum; Windows checkouts of this repo historically store CRLF for migration SQL.)

2. Compute its raw SHA-256.  
3. **After Neon backup**, update the single `_prisma_migrations.checksum` row for `20260719120000_field_training_required_hours` to that hash (or use Prisma-supported checksum repair if available for the installed Prisma 6.x).  
4. Commit the canonical file to `main`.

**Why live schema is insufficient:** it proves the **end state**, not comments, whitespace, `IF NOT EXISTS`, multi-statements, or prior transient side effects.  
**Risks:** history rewrite; future `migrate` checksum failures if wrong; Prisma support may treat manual checksum edits as unsupported; rollback of “what SQL was applied” becomes fictional.  
**Not done in this task.**

### Post-recovery expectations (when exact file exists)

- Repo **28** / Neon **28** / pending **0**  
- Baseline v1 stays at **27** + uniqueness cutoff  
- Empty DB: init → 27 resolved → deploy applies #28 → column present  
- Then minimal `schema.prisma` optional Int field; UI/API wiring remains follow-up feature work
