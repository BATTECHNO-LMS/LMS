# 03 — Critical Flow Matrix

Verified against code. Runtime E2E against Neon **not** executed.

Confidence legend: Confirmed / Strong inference / Unknown

---

## Flow: Student register → email OTP → activate → login

| Step | Layer | Evidence | Status |
|------|-------|----------|--------|
| Register | `POST /api/auth/register` | `auth.routes.js` / `auth.service.js` | Confirmed |
| Domain check | `university_email_domains` | auth service + email utils | Confirmed |
| User created | `inactive`, role `student` | auth.repository | Confirmed |
| OTP email | Resend if key set | `email.service.js` | Confirmed code; Unknown delivery in this env |
| Verify OTP | `POST /verify-email-otp` | auth routes | Confirmed |
| Activate | `PATCH /users/:id/activate` etc. | users.routes + `USER_ACTIVATE_ROLE_CODES` | Confirmed |
| Login | JWT + `isGlobal` for super_admin | `auth.service.js` / `jwt.js` | Confirmed |
| FE storage | `localStorage` token | `storage.js` | Confirmed |
| Tests | OTP utils pure; no full E2E | `emailOtp.test.js` | Partial |

**Gaps:** No safe E2E this phase. Logout does not revoke JWT server-side (Confirmed).

---

## Flow: Enrollment request → approve/reject

| Step | Layer | Evidence | Status |
|------|-------|----------|--------|
| Student request (SPA) | `POST /api/v1/student/enrollment-requests` | FE `enrollments.service.js` | Confirmed |
| Alternate API | `POST /api/v1/enrollments/request` | BE only; same service | Confirmed dual path |
| Pending list | `GET /enrollments/pending` | `ENROLLMENT_DECISION_ROLE_CODES` | Confirmed |
| Approve/reject | `PATCH .../approve|reject` | enrollments routes | Confirmed |
| Notifications | types in enum + services | Strong inference | Strong inference |
| Tests | None dedicated for enrollment decision | — | Gap |

---

## Flow: Academic assessment → submission → grade

| Step | Backend | Frontend SPA | Status |
|------|---------|--------------|--------|
| Create assessment | `POST /assessments` (`ACADEMIC_WRITE`) | Yes (`assessments.service`) | Confirmed |
| Student submit | `POST /assessments/:id/submissions` (`student`) | Yes — `StudentAcademicSubmissionPage` | **Resolved (ISS-002)** |
| Duplicate create prevention | App guard + `uq_submissions_assessment_student` → 409 | Conflict refresh → edit | **Resolved (ACADEMIC-SUBMISSION-001)** |
| Update submission | `PUT /submissions/:id` (`student`) | Yes — same page when editable | **Resolved (ISS-002)** |
| List submissions | `GET /submissions` | Yes GET | Confirmed |
| Create grade | `POST /assessments/:id/grades` | Yes — `InstructorAcademicGradePage` | **Resolved (ISS-002)** |
| Update/finalize grade | `PUT/PATCH grades` | Yes — update + confirm finalize | **Resolved (ISS-002)** |
| Finalized grade immutability | `PUT` / create-overwrite → 409 `GRADE_FINALIZED` | SPA read-only + conflict refresh | **Resolved (ACADEMIC-GRADE-001)** |
| Student view grades | `GET /grades` (scoped) | Yes | Confirmed |
| Quiz attempts / answers | Schema placeholders only | No | Confirmed unused (out of scope) |
| Certificate gate on grades | None | — | Confirmed uncoupled |

**Product:** Minimum academic submit/grade loop is reachable in SPA. Analysis: `12_…ANALYSIS.md`. Implementation: `13_…IMPLEMENTATION.md`. Field-training remains a separate write path (**classification G**).

**Tests:** `authorization.iss002.academicSubmissions.characterization.test.js`, `authorization.iss002.academicDelivery.remediation.test.js`, `authorization.academicGrade001.finalizedImmutability.test.js`, `authorization.academicSubmission001.uniqueness.test.js`, `frontend/tests/academicDelivery.iss002.test.js`.

---

## Flow: Field training participant lifecycle

| Transition (observed writers) | Function | Typical actor |
|------------------------------|----------|---------------|
| → `pre_assessment_pending` / `ready_for_training` / `in_training` on approve | `reviewApplication` + `resolveTrainingStatusOnApproval` | Admin FT roles |
| → `pre_assessment_completed` / `in_training` | `submitAssessment` (pre) | Student |
| → `in_training` | `startTraining` | Instructor/admin manage |
| → `task_submitted` | `submitTaskFile` | Student |
| → `post_assessment_completed` | `submitAssessment` (post) | Student |
| → `eligible_for_completion` | `persistEligibility` | System after rules |
| → `completed` | `issueCompletionLetter` | Admin |
| → `expelled` / `none` | `expelParticipant` | Admin/instructor request |

**Never written:** `task_pending`, `post_assessment_pending`, `failed` (Confirmed).

| Tests | Coverage |
|-------|----------|
| `fieldTraining.workflow.test.js` | Pure helpers — ran, pass |
| `fieldTraining.access.test.js` | Access/mapping — ran, pass |
| `fieldTraining.auth.test.js` | 401 — ran, pass |
| `fieldTraining.integration.test.js` | Full path — **skipped** (DB write) |

---

## Flow: Certificate issue → public verify

| Step | Evidence | Status |
|------|----------|--------|
| Issue | `POST /certificates` + `CERTIFICATE_WRITE` | Confirmed |
| Event | `certificate_issued` → audit + notification | Confirmed |
| Public verify | `GET /certificates/verify/:code` + FE `/verify/certificate/:code` | Confirmed |
| Tests | Not in safe suite | Gap |

---

## Flow: Password reset

| Step | Evidence | Status |
|------|----------|--------|
| OTP + reset token utils | `passwordResetToken.test.js` | Pass (safe) |
| HTTP handlers | auth routes | Confirmed code |
| Email send | Resend | Not invoked this phase |

---

## Side effects summary

| Mechanism | When |
|-----------|------|
| `dispatchAppEvent` | On specific writes (recognition, certificate, attendance threshold, overdue-on-write, integrity, QA open) |
| Cron | **None** in repo |
| Queues | **None** |
