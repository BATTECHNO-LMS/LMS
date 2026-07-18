# 25 — UI / Accessibility QA (QA-001)

**Scope:** Representative verification notes + staging checklist.  
**Policy:** No redesign; fix only confirmed blocking defects (none auto-fixed this phase).

---

## Automated / code-level observations

| Topic | Evidence | Status |
|-------|----------|--------|
| i18n AR + EN namespaces | `frontend/src/i18n/locales/*` | Present for academic/users/common |
| RTL | App locale-driven; not fully audited | **Pending staging** |
| Large JS chunks | Vite build warning >500kB | **QA-PERF-001** |
| Academic forms | ISS-002 pages + schemas | Unit FE coverage |
| FT manage UI | Complex tabs | Integration covers API; UI responsive **Pending** |

---

## Viewport checklist (manual staging)

For each role’s primary dashboard + one dense table + one form, test **360 / 390 / 768 / 1024 / 1440**:

| Check | Status |
|-------|--------|
| No horizontal overflow | Pending |
| Tables usable (scroll/stack) | Pending |
| Modals fit + scroll | Pending |
| Nav / hamburger | Pending |
| Long Arabic labels wrap | Pending |
| Focus visible on controls | Pending |
| Keyboard tab order on login + submit forms | Pending |
| Dialog focus trap | Pending |
| Image alt on marketing/public | Pending |
| Color contrast spot-check | Pending |

**Pages to prioritize:** Login, Student assessment submit, Instructor grade, Admin users list, FT student detail, Analytics (SA).

---

## Confirmed non-blocking issues

| ID | Severity | Note |
|----|----------|------|
| **QA-UI-001** | P3 | Bundle size / code-split opportunity (observability) |
| **QA-UI-002** | P3 | Admin “all permissions true” UI matrix vs real API RBAC — characterization known (ISS-001) |

No P0 layout defect reproduced in code review this phase.
