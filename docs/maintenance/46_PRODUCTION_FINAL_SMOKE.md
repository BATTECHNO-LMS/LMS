# 46 — Production Final Smoke

**Date:** 2026-07-20 (updated — RELEASE-FINAL-001)  
**Prior run:** 2026-07-18 (CONDITIONAL GO — JWT mismatch)  
**Frontend:** https://lms.battechno.com  
**API:** https://lms-7txx.onrender.com  
**Main merge SHA:** `f48274f` (PR #2)  
**Expected JWT fingerprint:** `eec7827fb0`  
**Verdict:** **NO-GO** for `v1.0.0` (see `47_FINAL_PRODUCTION_GO_DECISION.md`)

No credentials, tokens, or connection strings are recorded here.

---

## Deployed identity

| Item | Result |
|------|--------|
| Backend deployed Git SHA | **Not exposed** by Render health API — confirm in Render dashboard |
| Frontend live main bundle | `/assets/index-Cmf0WSFP.js` (675 832 B; `Last-Modified: 2026-07-15`) |
| Local `main` rebuild main bundle | `/assets/index-CuYaHmIt.js` (731 305 B) |
| FE vs merged main | **Older deploy (E)** — live predates PR #2; redeploy from `main` required |
| FE embeds production API | **Yes** (`lms-7txx.onrender.com`) |
| Localhost API in live JS | **None found** |

---

## Health / frontend / CORS

| Check | Result |
|-------|--------|
| `/health` | **200** |
| `/health/ready` | **200** (`db: true`) |
| FE `/` | **200** |
| FE `/login` | **200** |
| CORS `Origin: https://lms.battechno.com` | Allowed (login/me probes succeed with Origin header) |
| Unexpected 5xx in probes | **None** |

---

## Auth / session / JWT rotation

| Check | Result |
|-------|--------|
| Bogus / wrong-secret token → `/api/auth/me` | **401** |
| New login (synthetic catalog) | **200** |
| `/api/auth/me` with new token | **200** |
| Dashboard landing (student) | **`/student`** |
| Logout endpoint | **200** |
| Post-logout server token | Still **200** on `/me` — **QA-AUTH-001** open |
| Re-login after logout | **200** |
| Local `.env` JWT fingerprint | `eec7827fb0` (match expected) |
| Production-issued token verifies with local secret | **No** (`invalid signature`) |
| Local-minted token accepted by Render | **No** (**401**) |
| Render == approved fingerprint | **Fail / not synchronized** |

---

## Seven-role API smoke

| Role | Login | Allow | Deny | Notes |
|------|-------|-------|------|-------|
| super_admin | 200 | 200 | N/A (SA/global) | Analytics overview allowed |
| university_admin | 200 | 200 | 403 settings | Pass |
| academic_admin | 200 | 200 | 403 settings | Pass |
| qa_officer | 200 | 200 | 403 settings | Pass |
| instructor | 200 | 200 | 403 settings | Pass (re-run may 429) |
| student | 200 | 200 | 403 users | Pass |
| university_reviewer | 200 | 200 | 403 settings | Pass |
| program_admin | — | — | fail-closed | Not seeded; FE → `/login` |

---

## Academic / field-training

| Area | Result |
|------|--------|
| Academic write smoke | **Blocked** — production has **0** assessments/submissions |
| Field training student/instructor lists | **200** |
| Cross-university / privileged analytics as uni admin | **403** |

---

## Database

| Check | Result |
|-------|--------|
| Repo migrations (working tree / post-commit) | **28** |
| Applied `_prisma_migrations` rows | **28** |
| Pending / failed | **0 / 0** |
| Checksum reconcile | **Complete** — production `411b2fe3…` matches canonical file (see `49`) |
| `uq_submissions_assessment_student` | Present |
| Users | **468** (no unexpected reduction vs prior 424) |
| Submissions | **0** |

---

## Automated tests (local)

| Suite | Result |
|-------|--------|
| Backend unit | **324 pass** |
| Frontend unit | **42 pass** |
| Frontend production build | **Pass** |
| Prisma validate | **Pass** |
| Baseline v1 | **OK** (27 represented) |
| Empty-DB disposable | **Pass** |
| Integration (isolated Postgres) | **8 pass** |

---

## Open issues

- **QA-AUTH-001** — Logout does not revoke server-side JWT (accepted temporarily for v1; not resolved).  
- **QA-AUTH-003** — Password reset does not invalidate existing JWTs (accepted temporarily for v1; not resolved).  
- **JWT sync** — Render secret still ≠ approved fingerprint.  
- **FE deploy drift** — live bundle ≠ `main` rebuild.  
- **Migration history (PROD-DRIFT-OPTION-B-001)** — **Resolved** — checksum reconciled; repo and Neon **28/28**. See `49`.

---

## Verdict

### **NO-GO** (release / tag)

Service is Live; release-final gates (JWT sync, FE identity, migration parity) are **not** met. See `47_FINAL_PRODUCTION_GO_DECISION.md`.
