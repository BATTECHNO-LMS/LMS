# BATTECHNO LMS — Product Scope Reduction Report

Date: 2026-08-23  
Scope: User-facing product cleanup around Courses, Micro-Credentials, and Field Training.  
Database: **no tables dropped**, no migrations deleted, no production data mutated.

---

## 1. Phase A — Classification

| Existing module | Decision | Final domain | Reason |
| --- | --- | --- | --- |
| Training courses (`training_programs`) | KEEP | Courses | Production-ready shared course engine |
| E-learning catalog (`/admin/courses`, `/student/courses`) | KEEP_TEMPORARILY | Courses | Separate Prisma model; SA + university student catalog still live. No destructive DB merge |
| Micro-credentials | KEEP | Micro-Credentials | Core product |
| Tracks | KEEP / MERGE | Micro-Credentials | Required `track_id` parent; hidden from top nav |
| Learning outcomes | KEEP data + nested UI | Micro-Credentials | Used on MC view; standalone nav removed |
| Academic cohorts / enrollments / sessions / attendance / assessments / rubrics / submissions / grades | KEEP | Micro-Credentials / Courses delivery | Operational engine, not accreditation |
| Field Training | KEEP | Field Training | University-only (+ Super Admin) |
| QA dashboard / QA reviews | REMOVE | — | Out of product scope |
| Corrective actions | REMOVE | — | QA/accreditation only |
| Risk cases / at-risk students (standalone) | REMOVE | — | Standalone case management; in-course progress warnings kept |
| Integrity cases | REMOVE | — | Academic misconduct workflow |
| Recognition requests / documents | REMOVE | — | Prior-learning workflow, not MC certificates |
| Standalone Evidence pages | REMOVE | — | Accreditation evidence; shared `files` storage kept |
| Rubrics (standalone page) | KEEP_TEMPORARILY | Micro-Credentials | Linked to academic assessments |
| Content Hub (help/tours/popups/announcements/notification rules) | INFRASTRUCTURE | Help / Settings | Keep |
| Auth / users / orgs / roles / files / notifications / certificates / audit / settings | INFRASTRUCTURE | Shared | Keep |
| Generic `/admin/reports` | KEEP / MERGE | Reports | Recognition report type removed from UI; FT reports remain university-only |
| Super Admin analytics | KEEP_TEMPORARILY | Reports | Route kept for SA; QA/risk/integrity/recognition cards removed from UI |
| `/academic/field-training/*` | KEEP | Field Training | Reviewer/admin FT report aliases |

---

## 2. Final product domains

**Institutions:** Courses, Micro-Credentials  

**Universities:** Courses, Micro-Credentials, Field Training  

**Shared infrastructure:** Authentication, Users, Roles, Organizations, Files, Notifications, Reports, Certificates, Audit Logs, Settings, Help  

User-facing product modules outside those three domains: **NONE** (infrastructure and temporary dual course engines excepted).

---

## 3. Removed modules (detail)

### QA
- Why: Out of final product scope  
- Frontend removed: `/admin/qa`, `/admin/qa-reviews` pages, QA feature client  
- Backend removed: `/qa-reviews` unmounted; module files deleted when present  
- Database retained: YES (`qa_reviews`) — `LEGACY_DATABASE_TABLE`  
- Replacement: NONE  

### Corrective actions
- Why: QA/accreditation only  
- Frontend removed: `/admin/corrective-actions`  
- Backend removed: `/corrective-actions` unmounted  
- Database retained: YES (`corrective_actions`)  
- Replacement: NONE  

### Risk (standalone)
- Why: Standalone academic risk case-management  
- Frontend removed: `/admin/risk-cases`, `/admin/at-risk-students`, `/instructor/risk-students`  
- Backend removed: `/risk-cases` unmounted  
- Database retained: YES (`risk_cases`)  
- Replacement: Course/FT progress warnings and reports (kept)  

### Integrity
- Why: Separate misconduct workflow  
- Frontend removed: `/admin/integrity-cases`  
- Backend removed: `/integrity-cases` unmounted  
- Database retained: YES (`integrity_cases`)  
- Replacement: NONE (normal validation/security unchanged)  

### Recognition
- Why: Prior-learning, not Micro-Credential issuance  
- Frontend removed: `/admin/recognition-requests`, `/reviewer/recognition-requests`  
- Backend removed: `/recognition-requests`, `/recognition-documents` unmounted  
- Database retained: YES (`recognition_requests`, `recognition_documents`)  
- Replacement: NONE (Certificates + Micro-Credentials remain distinct)  

### Standalone Evidence
- Why: Accreditation evidence module  
- Frontend removed: `/admin/evidence`, `/instructor/evidence`, `/reviewer/evidence`  
- Backend removed: `/evidence` unmounted  
- Database retained: YES (`evidence`)  
- Replacement: Shared `files` storage for tasks/assessments/FT/certificates  

---

## 4. Merged / repositioned

| From | To |
| --- | --- |
| University “Courses” nav | `/admin/training-courses` (same engine as institutions) |
| Tracks | Extra university path under Micro-Credentials (not a top-level product) |
| Learning outcomes | Nested on Micro-Credential view; standalone nav removed |
| Instructor “My Courses” | `/instructor/cohorts` (MC delivery) |
| Student Micro-Credentials | `/student/available-cohorts` |
| Reports UI types | Courses/MC/certificates/attendance/assessments; recognition type dropped from picker |
| Unknown shell routes | Real 404 (`NotFoundPage`) instead of Module Placeholder |

---

## 5. Infrastructure retained

Authentication, users, roles, organizations (UNIVERSITY/INSTITUTION), files, notifications (inbox + rules), reports engines, certificates (academic + training sources), audit logs, settings, help/content hub, attendance, tasks, assessments.

---

## 6. Frontend routes removed

- `/admin/qa`, `/admin/qa-reviews/*`
- `/admin/corrective-actions/*`
- `/admin/at-risk-students`, `/admin/risk-cases/*`
- `/admin/integrity-cases/*`
- `/admin/recognition-requests/*`
- `/admin/evidence/*`
- `/instructor/evidence/*`, `/instructor/risk-students`
- `/reviewer/recognition-requests/*`, `/reviewer/evidence`

These URLs now render **404** (admin/role shells) rather than Coming Soon / placeholder.

`/instructor/at-risk-students` no longer redirects to a live module; it 404s.

---

## 7. Backend routes removed (unmounted)

Write/list APIs no longer mounted:

- `GET/POST /api/v1/qa-reviews`
- `GET/POST /api/v1/corrective-actions`
- `GET/POST /api/v1/risk-cases`
- `GET/POST /api/v1/integrity-cases`
- `GET/POST /api/v1/recognition-requests`
- `GET/POST /api/v1/recognition-documents`
- `GET/POST /api/v1/evidence`

### LEGACY_API_PENDING_REVIEW (kept)

- `GET /api/v1/reports/recognition` — generic report engine still accepts the type; UI picker no longer offers it  
- `GET /api/v1/analytics/qa-integrity`, `/analytics/evidence`, `/analytics/recognition` — Super Admin analytics backend still queries legacy tables  
- Event dispatcher handlers for recognition/corrective/integrity — dead if no emitters remain  

---

## 8. Pages / components / clients removed

Admin QA/corrective/risk/integrity/recognition/evidence pages; instructor evidence + risk-students; reviewer recognition + evidence viewer.  
Frontend feature folders: `qa`, `correctiveActions`, `risks`, `integrity`, `recognition`, `evidence`.  
`frontend/src/utils/recognitionPermissions.js`.

---

## 9. Permissions

Backend `permissionCatalog.js` already had no QA/risk/integrity/recognition module keys.  
UI keys `canUploadEvidence`, `canManageRiskStudents`, `canViewRecognitionRequests`, `canViewReviewerEvidence` remain in the matrix as **false** for instructor/reviewer (ADMIN_ALL still true for admin shells). Route maps for those URLs were removed so they 404 as unknown shell paths.

---

## 10. Legacy database tables retained (`LEGACY_DATABASE_TABLE`)

`qa_reviews`, `corrective_actions`, `risk_cases`, `integrity_cases`, `recognition_requests`, `recognition_documents`, `evidence` (and related FKs).  
No DROP / migrate reset. Schema deprecation is a later project.

---

## 11. Dual course engines (technical debt)

| Engine | Tables | Who uses it now |
| --- | --- | --- |
| Training Course Engine | `training_programs` + related | Institution + University admin “الدورات التدريبية”; trainer/trainee |
| E-learning catalog | `courses` / lessons | Super Admin `/admin/courses` (hidden extra path); university `/student/courses` |
| Academic MC delivery | tracks → micro_credentials → cohorts → sessions/assessments | Micro-Credentials |

**Not merged in this task.** UI/navigation unified around training courses for admin “Courses”. Future schema consolidation required.

---

## 12. Final navigation

### Super Admin
Dashboard · Organizations (Universities, Institutions) · Training (Courses, Micro-Credentials, Field Training) · Users · Reports · Certificates · Notifications · Audit Logs · Settings · Roles · Help

### University Admin
Dashboard · الدورات التدريبية · الشهادات المصغرة · التدريب الميداني · الطلاب · المشرفون · التقارير · الشهادات · الإشعارات · المساعدة

### Institution Admin
Dashboard · الدورات التدريبية · الشهادات المصغرة · المتدربون · المدربون · التقارير · الشهادات · الإشعارات · المساعدة  
(No Field Training)

### Reviewer
Dashboard · Reports · Certificates · Field Training reports (UNIVERSITY only) · Enrollment requests (MC) · Help · Notifications

### Instructor (university)
Dashboard · دوراتي (cohorts) · التدريب الميداني (single link) · الحضور · التسليمات · التقييمات · الدرجات · الإشعارات · الدليل

### Trainer
Dashboard · الدورات التدريبية · الإشعارات · الدليل · الملف  
Attendance, materials, lectures, tasks, assessments, progress, reports remain **in-course tabs** on `/trainer/courses/:id`.

### Student (university)
Dashboard · دوراتي · الدورات التدريبية · الشهادات المصغرة · التدريب الميداني · التقدم · الشهادات · الإشعارات · الدليل

### Trainee
Dashboard · دوراتي التدريبية · الشهادات · الإشعارات · الدليل · الملف  
No Field Training. Dedicated trainee Micro-Credential catalog page does not exist (`KEEP_TEMPORARILY` — no new product module created).

---

## 13. Security corrections (this cleanup)

1. **Field Training organization gate:** `requireOrganizationType('UNIVERSITY')` already on admin/academic FT routers; **added** to instructor and student FT routers (after `authenticate`). Institution callers receive `403 PORTAL_MISMATCH`. Super Admin `isGlobal` still bypasses.  
2. **Frontend FT shell:** Institution admin (non-global) hitting `/admin/field-training` gets Unauthorized, not the FT UI.  
3. **`scopeAdminListQuery`:** Non-global user with **null `universityId` no longer receives an unscoped (global) query**. A deny sentinel university id is applied.  
4. **Reports `scopeFiltersForUser`:** Same deny-all when university scope is missing.  
5. **Dashboard `countUniversities`:** Non-global users without a university id count **0**, not all universities.  
6. **`resolveUniversityIdFilter`:** Documented that `undefined` is **not** global for non-`isGlobal` callers.

---

## 14. Remaining out-of-scope / debt

- Dual course engines (training_programs vs courses)  
- Academic delivery pages still exist as extra paths for MC  
- Super Admin analytics still queries legacy QA/recognition tables (`LEGACY_API_PENDING_REVIEW`)  
- Reports `/recognition` endpoint still mounted  
- Trainee Micro-Credentials top-level page not added (no existing trainee MC catalog)  
- Trainer desired top-level Attendance/Materials/… items live inside the course, not duplicate sidebar links  
- i18n JSON for removed modules left registered (unused)  
- Backend service files for unmounted modules may still exist on disk if restored; they are **not mounted**

---

## 15. Test results

| Check | Result |
| --- | --- |
| Prisma validate | PASS |
| Backend unit | PASS (707 pass, 1 skip) + new isolation tests |
| Frontend unit | PASS (86) including `productScope.nav.test.js` |
| Frontend production build | PASS (~429.8 KB main JS) |
| Backend syntax (`node --check`) | PASS |
| Runtime smoke (QA accounts) | **BLOCKED — safe QA account unavailable** |

---

## 16. Retained workflow status

| Workflow | Status |
| --- | --- |
| Institution Course engine (create → trainer → trainees → sessions → attendance → materials → tasks → assessments → evaluation → reports → certificate) | PASS (code retained; not end-to-end runtime) |
| University Course (admin nav now training-courses; student e-learning catalog kept) | PARTIAL (two engines remain) |
| Micro-Credentials | PASS (definition, outcomes panel, cohorts, assessments, certificates) |
| Field Training | PASS (university isolation tests) |
| Reports | PASS (picker cleaned; FT reports university-only) |
| Certificates | PASS (shared presentation; dual storage kept) |

---

## 17. Suggested commit (not created)

```text
refactor: simplify LMS around courses, micro-credentials and field training
```
