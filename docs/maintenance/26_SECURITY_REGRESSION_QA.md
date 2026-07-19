# 26 — Security Regression QA (QA-001)

**Method:** Characterization/unit tests + code review of auth middleware, scope helpers, identity guards.  
**Not performed:** destructive penetration, load abuse, real credential stuffing.

---

## Verified controls

| Control | Evidence | Status |
|---------|----------|--------|
| Non-global cannot assign/control `super_admin` | `superAdminPrivilegeBoundary` + tests | **Pass** |
| Current DB auth context on protected routes | `currentAuthContext` + middleware tests | **Pass** |
| Inactive user denial | currentAuth / auth middleware | **Pass** |
| Stale JWT role/uni/`isGlobal` | revalidation tests | **Pass** |
| `program_admin` no runtime access | Phase 3/4 tests | **Pass** |
| University scope helpers | `universityScope` tests | **Pass** |
| Academic submission ownership + uniqueness | lifecycle + U | **Pass** |
| Finalized grade immutability (no role bypass) | ACADEMIC-GRADE-001 | **Pass** |
| FT instructor assignment limits | access tests + I | **Pass** |
| Test DB write guard | fail-closed | **Pass** |
| Empty-DB init refuses Neon | `db-init-empty` | **Pass** |

---

## Open / residual security findings

| ID | Severity | Issue | Expected | Product decision? |
|----|----------|-------|----------|-------------------|
| **QA-AUTH-001** | **P1** | Logout does not revoke JWT server-side | Token invalid after logout **or** short TTL + documented residual risk | Yes (session store / denylist) |
| **QA-AUTH-003** | **P1** | Password reset does not invalidate existing access JWTs | Old sessions die after reset | Yes |
| **QA-SEC-001** | P2 | Dual AuthZ sources (env roles vs UI matrix vs unused DB permissions) | Single source of truth | Yes (ISS-001) |
| **QA-SEC-002** | P2 | Account enumeration via login/register error distinction | Uniform messages | Yes / UX tradeoff |
| **QA-SEC-003** | P2 | Rate limits present for auth; confirm production values | Tuned limits | Ops |
| **QA-SEC-004** | P3 | Public certificate verify — ensure no PII leakage | Code review staging | Spot-check |
| **QA-SEC-005** | P2 | File download authorization must remain ownership-scoped | Covered partially in FT I | Staging probe |
| **QA-ROLE-001** | P2 | FE/BE FT admin role allowlist drift | Align product intent | Yes |

---

## Explicit non-goals this phase

- Implementing token revocation
- Broad AuthZ redesign
- Schema changes
- Destructive exploit attempts against Neon
