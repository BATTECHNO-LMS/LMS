# EPROJECTO Bulk Export Unauthorized Fix

## Failing request

Observed client error body (exact catalog shape from `authenticate` when no Bearer token is present):

```json
{
  "success": false,
  "message": "انتهت جلستك أو غير مصرح لك. سجّل الدخول مرة أخرى.",
  "code": "UNAUTHORIZED"
}
```

Protected flow under test:

| Step | Method | URL pattern |
|------|--------|-------------|
| Preview | `POST` | `/api/v1/admin/field-training/:id/reports/students/bulk-export/preview` |
| Create job | `POST` | `/api/v1/admin/field-training/:id/reports/students/bulk-export` |
| Job status | `GET` | `/api/v1/admin/field-training/:id/reports/students/bulk-export/jobs/:jobId` |
| ZIP download | `GET` | `/api/v1/admin/field-training/:id/reports/students/bulk-export/jobs/:jobId/download` |

Unauthenticated probes of all four routes return **401** with `code: UNAUTHORIZED` (verified via `supertest`).

`code: UNAUTHORIZED` (not `TOKEN_INVALID`) means **`req.user` was missing because no Bearer token was extracted** — not a role/permission denial (those are **403** with different Arabic copy).

## Root cause

1. **Auth architecture is Bearer JWT**, attached by `frontend/src/services/apiClient.js` from `localStorage` (`battechno_lms_auth_token`). Not HttpOnly cookies.
2. The Eligibility bulk ZIP client path already called `apiClient.get(..., { responseType: 'blob' })` — **not** `window.location` / `window.open` for the API download.
3. Export ZIP files were stored under `uploads/ft-student-report-exports/...`, which sits behind `app.use('/uploads', authenticate, express.static(...))`. Any request to that static path **without** `Authorization` (or legacy `?access_token=`) returns **exactly** this 401 body. That is unsafe even for authenticated users (static auth ≠ job/org authorization).
4. Download used `res.sendFile` instead of the proven authenticated stream pattern (`createReadStream` + `pipe`) used by completion-letter PDFs.
5. Blob JSON error handling needed hardening so 401/JSON-as-Blob never surfaces as `[object Blob]`, and so disguised JSON bodies are mapped to the correct status.

## Auth architecture discovered

| Item | Finding |
|------|---------|
| Mechanism | **Bearer** `Authorization: Bearer <jwt>` |
| Cookie session | **No** (login does not set auth cookies) |
| Canonical client | `apiClient` (`frontend/src/services/apiClient.js`) |
| Same-origin API | Yes — empty `VITE_API_BASE_URL`, Nginx `/api` → backend |
| Query-string JWT allowed by middleware on GET | Yes for `/uploads` tabs only — **not used** for bulk ZIP API |

## Working request comparison

| Check | Working FT blob download (e.g. completion-letter ZIP / comprehensive PDF) | Bulk ZIP (before → after) |
|-------|--------------------------------------------------------------------------|---------------------------|
| Client | `apiClient` + interceptor | Same (already) → reinforced |
| `Authorization` | Bearer from storage | Same → `headers.set` path hardened |
| `responseType` | `blob` | `blob` + `Accept: application/zip,...` |
| Browser navigation | Object URL download helper | Same helper; delayed `revokeObjectURL` |
| Backend send | `createReadStream` / `res.send(buffer)` | `sendFile` → **`createReadStream`** |
| File location | Not exposed via static for letters | Was under `/uploads/...` → **`uploads/private/...` + static block** |

## Direct browser navigation caused the issue?

**NO** for the implemented Eligibility bulk flow (`ManageEligibilityTab` → `downloadBulkStudentReportsZip` → `apiClient`).

Static `/uploads/...` access without Bearer **would** produce this exact 401; that path is now blocked (404) for both legacy and private export prefixes.

## Frontend fix

- Keep all create/status/download calls on `apiClient` (Bearer interceptor).
- `assertBlobDownloadSuccess` + stronger `rethrowBlobApiError` for JSON-as-Blob.
- Delayed object-URL revoke; double-download guard (`downloadInFlight`).
- Distinct Arabic session-expired UX vs generic download failure.
- `apiClient` Authorization set/read via AxiosHeaders-safe helpers.

## Backend fix

- Store ZIPs under `uploads/private/ft-student-report-exports/` (persists on uploads volume).
- Block static serving of `/uploads/private` and legacy `/uploads/ft-student-report-exports` (404 before `express.static`).
- Stream ZIP with `createReadStream` + `Cache-Control: private, no-store`.
- Job snapshot includes `isGlobal` + `permissions` for background PDF generation.
- Download still requires `authenticate` → staff roles → opportunity manage access → **job owner (or system-wide admin)**.

## 401 / 403 behavior

| Case | Expected |
|------|----------|
| No / invalid session | **401** `UNAUTHORIZED` / `TOKEN_INVALID` |
| Authenticated, wrong role | **403** `FORBIDDEN` |
| Authenticated, other university / other user's job | **403** (or 404 when job/opportunity not in scope) |
| Static export path | **404** (not downloadable) |

## Job authorization

`assertJobReadable`: only `createdById === user.userId` or `isSystemWideAdmin(user)`. Cross-org / cross-user download remains denied (unit-tested).

## Security preserved

- Endpoint remains authenticated + authorized.
- No JWT in URL / query / filename for bulk ZIP.
- No public/anonymous download route.
- CORS/auth headers not loosened.
- Global 401 interceptor still logs out only when the request had Authorization.

## Tests

Backend:

- Unauthenticated bulk preview/start/status/download → 401
- Static private + legacy export paths → 404
- Cross-university job download → 403
- Owner download metadata path includes `private`

Frontend:

- Source contract: apiClient blob download, no `window.open` / `?token=`
- Blob JSON 401 parsing
- Object URL revoke scheduling contract
- Existing eligibility UI wiring tests

## Production deployment

**NO** (this fix task). Deploy is a separate controlled step.

## Suggested commit message

`fix: preserve authentication for bulk report downloads`
