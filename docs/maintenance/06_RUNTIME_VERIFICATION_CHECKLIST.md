# 06 — Runtime Verification Checklist

Use after an **isolated** test database and non-production secrets are confirmed. Do **not** run against Neon/shared production.

## Preconditions

- [ ] Separate `DATABASE_URL` for test (local Postgres or disposable Neon branch)
- [ ] `NODE_ENV` appropriate; never rely on it alone for safety
- [ ] Resend/AI/R2 keys **unset** or sandbox-only
- [ ] Migrations applied **only** on test DB: `prisma migrate deploy`
- [ ] Optional: `seed:real-baseline` + `seed:test-accounts` on test DB only

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
- [ ] Run `fieldTraining.integration.test.js` on test DB only

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
