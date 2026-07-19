# 28 — Verified Cleanup Candidates (QA-001)

**Do not delete anything until this register is reviewed.**  
Extends `05_CLEANUP_CANDIDATES.md` with QA-001 evidence.

---

## Register

| ID | Item | Static refs | Dynamic / runtime | External possible? | Confidence | Risk if deleted | Next |
|----|------|-------------|-------------------|--------------------|------------|-----------------|------|
| **CLN-001** | Unmounted lazy QA/Risk/Integrity CRUD pages | `lazyPages.js` | Not in router | Unlikely | High unused-in-SPA | Medium (planned feature) | PO: mount or backlog |
| **CLN-002** | `endpoints.auth.refresh` | endpoints.js only | No caller; no BE | No | High | Low | Remove after sweep |
| **CLN-003** | `role.middleware.js` | zero imports | Dead | No | High | Low | Delete after confirm |
| **CLN-004** | `cohort_status_changed` event case | eventDispatcher | Never dispatched | No | High | Low | Remove or implement |
| **CLN-005** | `POST /enrollments/request` | BE + docs | SPA uses student path | Possible API clients | Medium | Medium | Unify after telemetry |
| **CLN-006** | `endpoints.students` / BE `/students` | endpoints + BE | No FE service | Possible | Medium | Medium | Keep until telemetry |
| **CLN-007** | Legacy `/reports/field-training` | FE legacy mode | Prefer admin/academic reports | Possible | Medium | Medium | Deprecate after notice |
| **CLN-008** | `GET /ai/test`, storage health | BE | Ops/manual | Internal | High | Low | Document as ops-only |
| **CLN-009** | Never-written FT enum values | schema | Never assigned | N/A | High | Product | ISS-003 decision |
| **CLN-010** | Unused DB `permissions` for AuthZ | seeds/roles | Login loads; unused for allow/deny | Future RBAC | High | High if deleted early | ISS-001 redesign |

---

## Classification rules used

- “No SPA consumer” ≠ unused Backend (may be mobile/script/partner).
- Prefer staging access logs before deletion.
- Historical `program_admin` rows are **not** cleanup candidates for deletion.

---

## Approval gate

Any deletion PR must cite this ID, show grep evidence, and include rollback (revert) notes.
