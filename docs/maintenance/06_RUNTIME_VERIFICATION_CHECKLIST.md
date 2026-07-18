# 06 — Runtime Verification Checklist

Use after an **isolated** test database and non-production secrets are confirmed. Do **not** run against Neon/shared production.

## Preconditions (ISS-011)

- [ ] App `DATABASE_URL` is **not** used for integration tests
- [ ] `TEST_DATABASE_URL` points at a dedicated local (or explicitly approved remote) DB
- [ ] `TEST_DATABASE_URL` ≠ `DATABASE_URL` after normalization
- [ ] `NODE_ENV=test`
- [ ] `ALLOW_TEST_DB_WRITES=true`
- [ ] Remote TEST hosts only with `ALLOW_REMOTE_TEST_DATABASE=true` (never set for app Neon)
- [ ] Resend/AI/R2 keys **unset** or sandbox-only
- [ ] Migrations applied **only** on test DB: `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy`
- [ ] Optional: seed on test DB only (`seed:real-baseline` + `seed:test-accounts` with `DATABASE_URL` = test)

## Migration history (shared / prod-like DB — read-only + deploy guards)

- [ ] `cd backend && npm run prisma:check-history` — expect history present; no failed rows
- [ ] `npx prisma migrate status` — expect **up to date** (or a reviewed pending set only)
- [ ] Confirm `uq_submissions_assessment_student` still present if academic delivery is in scope
- [ ] Do **not** run `prisma db push`, `migrate reset`, or unreviewed `db execute` for schema
- [ ] Do **not** run `npm run db:init-empty` against Neon / shared prod
- [ ] Empty-DB replay: only ephemeral CI/`TEST_DATABASE_URL` Postgres — never shared Neon

## Empty database / new environment bootstrap (DB-MIGRATION-002 / 003)

- [ ] `npm run db:validate-baseline` — manifest/SQL/migration checksums OK
- [ ] Create a truly empty PostgreSQL database
- [ ] `ALLOW_EMPTY_DB_INIT=true DATABASE_URL=<empty> npm run db:init-empty`
- [ ] Confirm applied count equals manifest size when no post-cutoff migrations exist (v1 = 27)
- [ ] `npm run prisma:deploy` then `npm run prisma:status`
- [ ] `npm run db:verify-schema`
- [ ] Optional catalog only: `npm run seed:catalog` (no demo/analytics seeds)
- [ ] CI job `backend-empty-db-reproducibility` green (includes cutoff fixture)
- [ ] Do **not** run `db:init-empty` against Neon / shared prod
- [ ] Do **not** regenerate baseline without `ALLOW_BASELINE_REGENERATION=true`

## Safe commands (no isolated TEST DB)

- [ ] `cd backend && npm run test:unit` — DB-free; expect analytics.trends **2 failures** (ISS-004)
- [ ] `cd backend && npx prisma validate`
- [ ] `cd frontend && npm run build`
- [ ] Do **not** run `npm run test:integration` or `test:all` against Neon

## Integration commands (isolated TEST DB only)

- [ ] `cd backend && npm run test:integration` — must fail closed if guard env incomplete
- [ ] Confirm guard rejects missing `TEST_DATABASE_URL` / `ALLOW_TEST_DB_WRITES`
- [ ] Confirm guard rejects `TEST_DATABASE_URL === DATABASE_URL`
- [ ] Confirm CI `backend-integration` uses ephemeral Postgres, not production secrets

## Auth & access

- [ ] Register student with allowed university domain
- [ ] OTP verify (or admin verify-email on test)
- [ ] Activate pending user
- [ ] Login each role; confirm portal redirect
- [ ] Confirm UA cannot read other university’s users (scope)
- [ ] Confirm PA can (system-wide scope)
- [ ] Confirm SA `isGlobal` reaches analytics/settings
- [ ] Confirm UI button hidden ≠ API blocked (try forbidden role with crafted token only in test)

## Academic assessments (critical)

- [ ] Create assessment as instructor/admin
- [ ] Attempt student submit via API (`POST /assessments/:id/submissions`) — expect success
- [ ] Confirm SPA has no submit control (document gap) **or** test FE after fix
- [ ] Grade via API; confirm SPA read shows grade
- [ ] Finalize grade via API

## Field training

- [ ] Publish opportunity with eligibility
- [ ] Student apply → approve → pre assess → start → task → post → eligibility → letter
- [ ] Instructor limited to assigned opportunity
- [ ] Expel path
- [ ] Run `npm run test:integration` on approved TEST DB only (not Neon app URL)

## Certificates & public

- [ ] Issue certificate
- [ ] Public verify page + API
- [ ] Revoke/status change notification

## Enrollment

- [ ] Student request via SPA path
- [ ] Approve/reject as REV and AA
- [ ] Optionally hit legacy `POST /enrollments/request` and compare

## Ops / negative

- [ ] CORS: allowed origin vs evil origin (covered partially by `health.test.js`)
- [ ] Rate limit smoke (auth)
- [ ] AI disabled when `AI_PROVIDER` empty
- [ ] File presign fails gracefully when storage not R2
- [ ] `cleanup:demo` dry-run on test DB only
- [ ] Confirm seed scripts refuse production when expected

## Observability gaps to note during runtime

- [ ] Where do 500s appear? (logs only — no Sentry)
- [ ] Timing of PDF/Excel export under load
- [ ] Overdue notification: create overdue corrective action and confirm event on write; confirm **no** auto notify without write

## After runtime

- [ ] Update `02_VERIFIED_IMPROVEMENT_BACKLOG.md` with runtime evidence columns
- [ ] Do not promote cleanup deletions without checklist + PO
