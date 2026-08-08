# Account deletion requests (ACCOUNT-DELETION-COMPLIANCE-001)

Additive migration: `prisma/migrations/20260806180000_account_deletion_requests/`

Do **not** apply this migration to production from the agent workflow. Operators apply with the normal deploy path (`prisma migrate deploy`) when ready.

## Self-service API

- `GET /api/v1/account/deletion-request`
- `POST /api/v1/account/deletion-request` — body: `{ confirmation: "DELETE", currentPassword, reason? }`
- `POST /api/v1/account/deletion-request/cancel`

## Super Admin processing

- `GET /api/v1/account/deletion-requests`
- `PATCH /api/v1/account/deletion-requests/:id` — `{ status: "processing"|"completed"|"rejected", confirmation: "DELETE", resolution_note? }`

Completing a request anonymizes identity fields and sets `users.status=inactive`. Academic/legal/audit rows are retained.

See mobile doc: `mobile/battechno_lms_app/docs/ACCOUNT_DELETION.md`.
