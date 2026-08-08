# ACCOUNT-DELETION-COMPLIANCE-001

## User flow (mobile)

1. Profile → Settings → **Account Management** → **Delete Account**
2. Read explanation (request ≠ immediate deletion; retention notice)
3. Optional reason + current password + type `DELETE` + checkbox
4. Final confirmation dialog → submit
5. Status shown: pending / processing / completed / rejected / cancelled
6. Cancel allowed only while **pending**

## Backend endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/account/deletion-request` | Bearer | Current user’s latest/active request |
| POST | `/api/v1/account/deletion-request` | Bearer | Create request (`confirmation=DELETE`, `currentPassword`, optional `reason`) |
| POST | `/api/v1/account/deletion-request/cancel` | Bearer | Cancel pending request |
| GET | `/api/v1/account/deletion-requests` | Super Admin (global) | Read-only list |
| PATCH | `/api/v1/account/deletion-requests/:id` | Super Admin (global) | `processing` / `completed` / `rejected` |

User ID always comes from DB-backed auth context — never from the client body.

## Statuses

`pending` → `processing` → `completed` | `rejected`  
`pending` → `cancelled` (user)

## Data policy

**On request submission:** no academic rows deleted; account stays active.

**On completed (admin):** identity anonymized (name/email/phone), status `inactive`, OTPs cleared, push disabled. **Retained:** submissions, grades, attendance, certificates, field-training history, review/audit records.

## Public URLs

- https://lms.battechno.com/account-deletion
- https://lms.battechno.com/privacy-policy

## Google Play field suggestion

> Users can request account deletion in the BATTECHNO LMS app: Profile → Settings → Account Management → Delete Account. Inactive users can use the web form or email privacy@battechno.com from their registered address. Web page: https://lms.battechno.com/account-deletion

## Admin processing

Super Admin API only (no university-scoped exposure). Completing a request anonymizes identity; academic/legal records remain.

## Known limitations

- Inactive users cannot use the authenticated API (`ACCOUNT_INACTIVE`); they use the public page + support email path.
- No public email-only delete form (prevents enumeration / insecure deletion).
- Migration `20260806180000_account_deletion_requests` must be applied to each environment before the API is used there (not applied to production by this task).
- Web admin UI for processing is API-only / operational for now.

## Migration

`backend/prisma/migrations/20260806180000_account_deletion_requests/`
