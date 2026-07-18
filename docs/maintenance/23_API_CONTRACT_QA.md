# 23 — API Contract QA (QA-001)

**Method:** Static compare `frontend/src/services/endpoints.js` + `*.service.js` vs `backend/src/app.js` / `routes` / module routers.  
**Policy:** Do not remove unconsumed APIs in this phase.

---

## Alignment summary

| Class | Count / note |
|-------|----------------|
| FE service → BE handler (primary LMS + FT + academic) | Broadly aligned |
| Confirmed mismatches / dead map entries | See below |
| Dual paths | Enrollment request (student vs legacy) |
| Response shape | ApiError `{ success, message, code }` used widely; not every legacy path audited |

---

## Confirmed contract issues

| ID | Severity | Item | Detail | Classification |
|----|----------|------|--------|----------------|
| **QA-API-001** | P3 | `endpoints.auth.refresh` | FE maps `/api/auth/refresh`; **no BE route**; no FE caller | Safe cleanup candidate |
| **QA-API-002** | P3 | `endpoints.students` | BE `GET /students/:id/submissions\|grades` exists; **no FE service consumer** | Unknown / legacy candidate |
| **QA-API-003** | P2 | Dual enrollment request | SPA uses `POST /student/enrollment-requests`; BE also has `POST /enrollments/request` | Keep both until product unifies |
| **QA-API-004** | P3 | Legacy FT reports | FE can call `/reports/field-training` in legacy mode; primary is `/admin/field-training/reports` | Legacy candidate |
| **QA-API-005** | P3 | Ops endpoints | `GET /ai/test`, storage health | Internal; no SPA consumer |

---

## Academic delivery contracts (verified)

| FE | BE | Notes |
|----|----|-------|
| `POST /assessments/:id/submissions` | Yes | 409 `ACADEMIC_SUBMISSION_EXISTS` |
| `PUT /submissions/:id` | Yes | ownership + final-grade locks |
| `POST /assessments/:id/grades` | Yes | |
| `PUT /grades/:id` | Yes | 409 `GRADE_FINALIZED` |
| `PATCH /grades/:id/finalize` | Yes | idempotent finalize |

Covered by remediation + uniqueness + immutability unit/FE tests.

---

## Pagination / dates / errors

| Topic | Observation | Finding |
|-------|-------------|---------|
| Pagination | List endpoints vary (`page`/`limit` vs unbounded) | **QA-API-006** P2 — audit high-cardinality lists before prod scale |
| Date handling | Mix of ISO strings and date-only fields | Documented risk; no auto-fix |
| Error format | Prefer `code` for SPA branching (academic conflicts) | Good pattern; extend consistently |

---

## Unconsumed BE APIs (not proof of unused)

Classify as **Unknown** until runtime telemetry:

- Any admin-only Excel/PDF export not linked in current nav
- Recognition document nested routes
- Rubric-criteria standalone if only nested UX used

Next action: log access in staging for 1–2 weeks before cleanup (see doc 28).
