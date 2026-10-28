# EPROJECTO REGISTRATION 500 ROOT-CAUSE FIX REPORT

**Date:** 2026-10-26  
**Execution:** LOCAL ONLY (no production SSH / deploy / migrations)  
**Suggested commit message:** `fix: support directory universities and majors in public registration`  
*(Note: actual fix targets OTP-after-create 500 semantics; directory-without-tenant was investigated and is not the failing path.)*

---

## 1. Exact root cause

`POST /api/auth/register` **successfully created the student user** (university + specialty + email-domain validation passed), then **`issueEmailVerificationOtp` → `sendEmailVerificationOtp` (Resend) threw**.

The thrown `Error('Failed to send verification email')` was not an `ApiError`, so `error.middleware` returned **HTTP 500** with the generic Arabic message. The account already existed → retries returned **409 EMAIL_ALREADY_EXISTS**.

Production evidence (prior incident logs): Resend rejected `RESEND_FROM_EMAIL` with  
`The associated domain with your API key is not verified` for HTU registrant `*@htu.edu.jo`.

This is **not** caused by Jordan directory codes being passed as UUIDs, and **not** caused by Cybersecurity major enum rejection — those layers succeeded before OTP send.

---

## 2. Exact failing line/path

```text
RegisterForm.onSubmit
  → AuthContext.signUp
  → POST /api/auth/register
  → auth.validation.registerSchema
  → auth.controller.register
  → auth.service.register
       … createStudentUser (COMMITTED)
       … notifyAdmins / audit / domain event
       → issueEmailVerificationOtp(user)          ← FAILING SEGMENT
            → email.service.sendEmailVerificationOtp
            → throw Error('Failed to send verification email')
  → error.middleware → 500 SERVER_ERROR
```

Failing call site (before fix): `backend/src/modules/auth/auth.service.js` `register()` awaiting `issueEmailVerificationOtp` after user create.  
Throw origin: `backend/src/shared/services/email.service.js` when Resend returns `result.error`.

---

## 3. Actual failing request payload shape

Frontend sends **only** (actual names):

```json
{
  "full_name": "HA'A ALDEEN ABU-FARASH",
  "email": "21220019@htu.edu.jo",
  "password": "<omitted>",
  "university_id": "<tenant UUID>",
  "university_specialty_id": "<university_specialties UUID>",
  "phone": "+962788658736"
}
```

`confirm_password` is frontend-only (Zod on client).  
There is **no** `facultyCode` / `majorCode` / `universityDirectoryCode` / `trackCode` / `role` on this endpoint.

RTL visual confusion (`htu.edu.jo@21220019`) is a display risk; the payload uses `email.trim().toLowerCase()` and Zod `email()` — LTR `dir="ltr"` was added on email/phone/password inputs.

---

## 4. Exception category

**email/OTP failure** (provider / From-domain verification), after successful persistence.

Not: Prisma FK, invalid UUID (validated earlier), enum major, track missing, or directory-code-as-UUID.

---

## 5. University directory vs tenant architecture

| Surface | Source | ID type |
|--------|--------|---------|
| Public internship journey | Jordan directory (`internshipJourney.universities.js`) | directory codes e.g. `HTU` |
| Student self-registration | Tenant `universities` + email domains | UUID `university_id` |

Auth registration **requires** an active eprojecto tenant university with at least one active email domain. HTU (`htu.edu.jo`) is a **seeded tenant** in `baselineCatalog.js` with Cybersecurity specialty — not a directory-only selection.

**No schema change** was made to add `universityDirectoryCode` / nullable-tenant intake for public register. Doing so would be a **new product feature**, not the fix for the observed 500. Directory-without-tenant registration remains **out of scope** of this root-cause fix (documented as remaining product gap if desired later).

Trusted mapping for internship journey already uses explicit directory codes; auth register continues to use tenant UUIDs from `/api/auth/register/universities`.

---

## 6. Faculty / Major validation

- **Auth register:** validates `university_specialty_id` belongs to `university_id` via `assertActiveUniversitySpecialtyForUniversity` → controlled **400** `UNIVERSITY_SPECIALTY_MISMATCH`.
- **Internship journey (separate API):** faculty→major taxonomy enforces `INFORMATION_TECHNOLOGY` + `CYBERSECURITY` valid; `BUSINESS` + `CYBERSECURITY` invalid; track derived server-side (`TRACK_NOT_CONFIGURED` / `REQUIRES_REVIEW` where needed). Covered by `internshipJourney.public.unit.test.js`.

Auth register does **not** accept faculty/major codes; specialty is the university specialty UUID shown in the form.

---

## 7. Track handling

Auth registration does **not** require a training track. Internship journey derives track; unconfigured track does not apply to `/api/auth/register`.

---

## 8–10. HTU / Cybersecurity / existing tenant

| Case | Result |
|------|--------|
| HTU tenant + Cybersecurity specialty + valid `@htu.edu.jo` email | Validation path OK; previously failed only at OTP send |
| After fix | User create + OTP persist succeed; response **200** even if Resend fails (`emailDeliveryFailed: true`) |
| Existing tenant universities | Unchanged UUID + specialty flow |

Local DB writes against production Neon were **not** executed (guard).

---

## 11. Error-response normalization

| Condition | Status / code |
|-----------|----------------|
| Invalid body / non-UUID university | 400 Zod / `VALIDATION_ERROR` |
| University not found | **400** `UNIVERSITY_NOT_FOUND` (was 404) |
| Specialty mismatch | 400 `UNIVERSITY_SPECIALTY_MISMATCH` |
| Email domain mismatch | 400 `EMAIL_DOMAIN_MISMATCH` |
| Duplicate email | 409 `EMAIL_ALREADY_EXISTS` (also Prisma P2002 mapped) |
| OTP send failure **after** create | **Success** + `emailDeliveryFailed: true` (no 500) |
| Explicit resend when provider fails | 503 `EMAIL_DELIVERY_FAILED` |

Frontend maps known codes to Arabic; generic fallback may append `requestId`.

---

## 12. Email / RTL investigation

- Payload email is logical `local@domain` after trim/lower — not reversed by code.
- Inputs `register-email`, `register-phone`, passwords: `dir="ltr"` (and email `inputMode="email"`).

---

## 13. Email-delivery failure semantics (canonical)

**Chosen:** account remains created; OTP hash persisted; registration returns success with `requiresEmailVerification: true` and `emailDeliveryFailed: true`; UI directs user to verify-email / resend.

**Not chosen:** rolling back the user (would require transactional email + create, and was not prior design).

Audit: non-strict (failures logged, do not abort).  
Admin notify: `.catch(() => null)` so notify failures cannot 500 registration.

---

## 14. Database changes

**NONE** (no migration).

---

## 15. Tests

**Backend (new):**
- `tests/auth.register.emailDelivery.unit.test.js`
- `tests/auth.register.validation.unit.test.js`

**Frontend (new):**
- `tests/registerForm.presentation.test.js`

Also green: internship journey faculty/major tests, Isra/AAU/MEU registration catalog tests, email OTP utils.

**Frontend production build:** PASS (required installing missing `qrcode` dependency already listed in `package.json`).

**Local browser smoke / live register against Neon:** NOT RUN (would write production-like DB). Unit coverage substitutes.

---

## 16. Remaining risks

1. Resend From/domain must still be verified for OTP emails to actually arrive (`emailDeliveryFailed` path).
2. Public register still **cannot** enroll students for Jordan directory universities that are not eprojecto tenants — by current product design.
3. Orphan inactive users can still appear if clients ignore success and retry with same email → 409 (expected).
4. Frontend build previously failed without `node_modules/qrcode` — ensure install in CI/deploy images.

---

## 17. Production rollout requirements

1. Deploy backend + frontend with this fix.
2. Confirm `RESEND_FROM_EMAIL` uses a **verified** domain for the API key (prefer `no-reply@eprojecto.com` once verified; temporary `onboarding@resend.dev` only if still required).
3. Smoke: HTU + Cybersecurity register → 2xx → OTP email or clear resend UX.
4. Do **not** treat directory-without-tenant as deployed until a separate intake feature is designed.

---

## Code changes summary

| File | Change |
|------|--------|
| `backend/src/modules/auth/emailVerification.service.js` | Soft-fail OTP send; injectable deps for tests; resend → 503 if delivery fails |
| `backend/src/modules/auth/auth.service.js` | Return `emailDeliveryFailed`; university not found 400; soft-fail admin notify |
| `backend/src/utils/authErrorCatalog.js` | `EMAIL_DELIVERY_FAILED`, `UNIVERSITY_SPECIALTY_MISMATCH` |
| `backend/src/modules/universitySpecialties/universitySpecialties.service.js` | Stable mismatch code |
| `frontend/.../RegisterForm.jsx` | LTR fields; error map; delivery-failed success copy |
| `frontend/.../auth.service.js` + `AuthContext.jsx` | Pass through `emailDeliveryFailed` |
