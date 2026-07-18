# 21 — Master QA Matrix (QA-001)

**Method:** Code evidence + automated tests + prior maintenance docs.  
**Manual status values:** Pass (code+auto) · Partial · Pending staging · N/A · Fail (finding)

Legend for coverage: **U** unit · **I** integration · **C** characterization · **M** manual staging required

---

## Authentication & account lifecycle

| Feature | Role | Entry | API | Expected | Negative | Auto | Manual | Finding |
|---------|------|-------|-----|----------|----------|------|--------|---------|
| Login valid | all active | `/login/*` | `POST /api/auth/login` | JWT + portal | bad password | U (partial) | Pending staging | — |
| Login inactive | any | login | login | 401/deny | — | C (currentAuth) | Pending | — |
| Logout | all | UI logout | `POST /logout` | client clear | token still valid server-side | Confirmed code | Pending | **QA-AUTH-001** |
| `/me` | authed | — | `GET /me` | current user | stale JWT claims ignored on protected | C | Pending | — |
| Email OTP | student | `/verify-email` | verify/resend OTP | verify activates path | reuse/expiry | U OTP | Pending | **QA-AUTH-002** (enum risk TBD) |
| Password reset | any | forgot/reset | OTP + reset | new password | old JWT may remain | U token | Pending | **QA-AUTH-003** |
| Register | student | `/register` | register | inactive student | bad domain | Partial | Pending | — |

## Role & portal access

| Role | Login destination | Shell | Direct deep-link gate | Cross-uni denial | Auto | Manual | Finding |
|------|-------------------|-------|----------------------|------------------|------|--------|---------|
| super_admin | `/admin` | admin + analytics/courses | RoleBased + wrappers | N/A global | C | Pending staging | — |
| university_admin | `/admin` | admin (nav filtered) | RoleBased | BE scope | C scope | Pending | — |
| academic_admin | `/admin` + `/academic` | admin + academic FT reports | RoleBased | BE scope | C | Pending | **QA-ROLE-001** FT admin UI vs BE |
| qa_officer | `/admin` | admin QA nav | RoleBased | BE | C | Pending | — |
| instructor | `/instructor` | instructor + outlet | RoleBased + UI perms | ownership | C + I | Pending | — |
| student | `/student` | student + outlet | RoleBased + UI perms | own data | C + U | Pending | — |
| university_reviewer | `/reviewer` | reviewer | RoleBased | uni scope | C | Pending | — |
| program_admin | none | deny-all UI | fail closed | N/A | C PA phases | Pending | — |

## User & university administration

| Feature | Actor | API | Expected | Cross-uni | Auto | Manual | Finding |
|---------|-------|-----|----------|-----------|------|--------|---------|
| Create user | SA (write) | `POST /users` | create | scoped | Partial | Pending | — |
| Reject program_admin assign | write roles | users service | reject | — | U PA freeze | Pending | — |
| Reject non-global SA assign | non-global | users | reject | — | U IDENTITY-001 | Pending | — |
| Activate / deactivate | activate roles | PATCH status | next request enforces | — | C currentAuth | Pending | — |
| Universities CRUD | SA/UA | `/universities` | CRUD | scope | Partial | Pending | — |

## Academic delivery

| Step | Actor | Route / API | Expected | Auto | Manual | Finding |
|------|-------|-------------|----------|------|--------|---------|
| Create assessment | instructor/admin | assessments | created | U/C | Pending | — |
| Student submit | student | `/student/assessments/:id/submit` · POST submissions | 201 | U+FE | Pending | — |
| Duplicate submit | student | same | 409 `ACADEMIC_SUBMISSION_EXISTS` | U | Pending | — |
| Edit submission | student | PUT submission | same row | U | Pending | — |
| Grade create/update | instructor | grade page · POST/PUT grades | saved | U+FE | Pending | — |
| Finalize | instructor | PATCH finalize | is_final | U | Pending | — |
| Mutate finalized | any | PUT grade | 409 `GRADE_FINALIZED` | U | Pending | — |
| Quiz attempts | — | — | unused | Confirmed unused | N/A | **QA-PROD-001** |
| Certificate grade gate | — | — | none | Confirmed | N/A | **QA-PROD-002** |

## Field training (summary — detail in doc 22)

| Area | Auto | Manual | Finding |
|------|------|--------|---------|
| Opportunity → letter happy path | **I** (mocked AI) | Pending staging UI | — |
| Expel / access denial | I | Pending | — |
| Reports scoping | I | Pending | — |
| Unused enum statuses | Confirmed never written | N/A | **QA-FT-001** (ISS-003) |
| FE/BE FT admin role drift | Confirmed | — | **QA-ROLE-001** |

## Certificates / QA / risk / integrity / recognition

| Feature | SPA | BE | Auto | Manual | Finding |
|---------|-----|----|------|--------|---------|
| Certificate issue/verify | admin + public verify | `/certificates` + public | Partial | Pending | — |
| QA reviews / corrective | admin routes | `/qa-reviews`, `/corrective-actions` | Low | Pending | **QA-NAV-001** lazy CRUD gaps |
| Risk / integrity cases | list pages | APIs exist | Low | Pending | **QA-NAV-001** |
| Recognition | admin + reviewer | APIs | Partial | Pending | — |

## Courses / lessons

| Feature | Gate | Auto | Manual | Finding |
|---------|------|------|--------|---------|
| Admin courses | super_admin only SPA | Partial | Pending | — |
| Student courses | student | Partial | Pending | — |

## Notifications / reports / analytics / settings

| Feature | Notes | Auto | Manual | Finding |
|---------|-------|------|--------|---------|
| Notifications | list + mark read | Partial | Pending | — |
| Analytics | SA only SPA; heavy PDF/Excel sync | trends U | Pending | **QA-PERF-001** |
| Settings | admin | Low | Pending | — |
| Reports | type exports | Low | Pending | **QA-PERF-001** |

## Files / AI / public

| Feature | Expected | Auto | Manual | Finding |
|---------|----------|------|--------|---------|
| Files upload/presign | fail closed if storage unset | Partial | Pending | — |
| AI generate | 503 if not configured | Partial | Pending | — |
| Landing stats | public | I | — | — |
| `GET /ai/test`, storage health | ops | none SPA | — | **CLN** see doc 28 |

## Empty / error / mobile columns (global)

| Concern | Status |
|---------|--------|
| Empty states | Partial — present on student/admin patterns; not audited page-by-page |
| Error toast / i18n AR+EN | Partial — academic conflict messages covered |
| Mobile 360–768 | **Pending staging** (doc 25) |
| RTL Arabic wrap | **Pending staging** |

---

## Coverage rollup

| Domain | Automated confidence | Staging still required |
|--------|----------------------|------------------------|
| Authz / identity / PA | High | Spot-check login portals |
| Academic submit/grade | High (unit/FE) | One synthetic E2E in UI |
| Field training | High (integration) | Admin/instructor UI click-through |
| Enrollment dual path | Medium | Approve/reject UI |
| Certificates / recognition | Medium | End-to-end issue+verify |
| QA/Risk/Integrity CRUD | Low | Product: incomplete routes |
| UI a11y / responsive | Low | Manual viewport pass |
| Security IDOR sweep | Medium (char tests) | Targeted staging probes |

Finding catalog: `29_PRODUCTION_READINESS_REPORT.md`.
