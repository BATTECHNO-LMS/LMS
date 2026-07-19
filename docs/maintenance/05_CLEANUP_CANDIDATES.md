# 05 — Cleanup Candidate Register

**Do not delete anything in this phase.** Candidates only.

---

## CLN-001 — Unmounted lazy pages (QA/Risk/Integrity CRUD + old reviewer FT)

| Field | Content |
|-------|---------|
| Item | Exports in `frontend/src/app/router/lazyPages.js` not referenced in `router/index.jsx` |
| Why unused | No `Route` element wires them; list pages exist without create/edit routes |
| Static refs | lazyPages definitions; possibly unused imports elsewhere |
| Dynamic | Checked router — not mounted |
| Nav | Not in adminNavigation deep links for create/edit |
| CLI/tests | N/A |
| External | Unlikely |
| Runtime evidence needed | Analytics/heatmap if users deep-link old URLs |
| PO confirmation | Yes — incomplete feature vs dead |
| Deletion risk | Medium if planned for next sprint |
| Next action | Keep; track as product backlog or mount routes |

---

## CLN-002 — `endpoints.auth.refresh`

| Field | Content |
|-------|---------|
| Item | `frontend/src/services/endpoints.js` → `auth.refresh` |
| Why unused | No BE `/api/auth/refresh`; no FE caller |
| Static | endpoints.js only |
| Dynamic | Grep — no usage |
| Deletion risk | Low |
| Next action | Remove constant after sweep (ISS-005) |

---

## CLN-003 — `role.middleware.requireRoles`

| Field | Content |
|-------|---------|
| Item | `backend/src/middlewares/role.middleware.js` |
| Why unused | Zero imports; wrong shape (`role` vs `roles[]`) |
| Deletion risk | Low |
| Next action | Delete file after confirm (ISS-006) |

---

## CLN-004 — `cohort_status_changed` event case

| Field | Content |
|-------|---------|
| Item | `eventDispatcher.service.js` case |
| Why unused | Never dispatched |
| Deletion risk | Low |
| Next action | Remove or implement emitter (ISS-007) |

---

## CLN-005 — Duplicate `POST /enrollments/request`

| Field | Content |
|-------|---------|
| Item | Parallel to `POST /student/enrollment-requests` |
| Why candidate | SPA uses student path only |
| Possible consumers | External/mobile/Postman — Unknown |
| Deletion risk | Medium until telemetry |
| Next action | Mark deprecated; monitor; then remove (ISS-008) |

---

## CLN-006 — Legacy FT report base `/api/v1/reports/field-training`

| Field | Content |
|-------|---------|
| Item | `fieldTrainingReport.routes.js` mounted under reports; FE `mode:'legacy'` constructable but UI uses admin/academic |
| Why candidate | SPA prefers `/admin/field-training/reports` and academic paths |
| External | Unknown |
| Deletion risk | Medium |
| Next action | Confirm no external report consumers |

---

## CLN-007 — Analytics domain GETs unused by SPA

| Field | Content |
|-------|---------|
| Item | `GET /api/v1/analytics/:domain` helper `fetchAnalyticsDomain` unused by pages; overview/exports used |
| Why candidate | Dead FE helper; BE domains may still be hit manually |
| Deletion risk | Low for FE helper; keep BE |
| Next action | Remove unused FE function or wire UI |

---

## CLN-008 — `endpoints` constants unused by services

| Field | Content |
|-------|---------|
| Item | `auth.registerSpecialties`, `files.health`, `ai.test`, `endpoints.students` |
| Why unused | Defined; no service calls found (BE routes may exist for health/test/students) |
| Deletion risk | Low for FE constants |
| Next action | Align endpoints map with actual clients |

---

## CLN-009 — `attempt_status` enum without attempts model

| Field | Content |
|-------|---------|
| Item | Prisma `enum attempt_status` |
| Why unused | No model field references it; FT attempts separate |
| Deletion risk | Migration needed to drop enum — careful |
| PO confirmation | Yes |
| Next action | Document; defer schema drop (ISS schema gap) |

---

## CLN-010 — FT enum statuses never written

| Field | Content |
|-------|---------|
| Item | `task_pending`, `post_assessment_pending`, `failed` |
| Why unused | No assignments in services |
| Deletion risk | High if UI/docs mention them |
| Next action | Align product language; do not drop enum yet (ISS-003) |

---

## CLN-011 — Hard-coded CORS origins + env merge

| Field | Content |
|-------|---------|
| Item | `app.js` allowlist literals + `CORS_ORIGINS` |
| Why candidate | Dual source of truth (not unused — ops smell) |
| Deletion risk | High if removing prod hosts carelessly |
| Next action | Ops decision: env-only vs keep hard-coded prod hosts |

---

## Summary

No deletions recommended until PO + runtime evidence for API dual paths and unmounted pages. Safest cleanups later: CLN-002, CLN-003, CLN-008 (FE-only).
