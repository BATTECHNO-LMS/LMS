# 34 — Staging Field-Training Flow (QA-STAGING-SMOKE-001)

**Status:** **Not executed in browser** — no staging SPA/API; no real AI/email/R2 allowed.

## Minimum happy path (blocked)

1. Opportunity visible to correct student  
2. Student applies  
3. Authorized actor approves/processes  
4. Pre-assessment if required  
5. Session visible  
6. Attendance (authorized)  
7. Task instructions visible  
8. Student submits supported content  
9. Self-evaluation  
10. AI evaluation mocked/disabled  
11. Instructor review  
12. Post-assessment if configured  
13. Completion eligibility/status displayed  
14. University reviewer view-only  
15. Cross-university denial  
16. Duplicate/repeated actions safe  

## Skipped steps (this run)

| Step | Reason |
|------|--------|
| All browser FT steps | No `$STAGING_FRONTEND_URL` / API / accounts |
| Real AI | Must remain mocked/disabled on staging |
| Real Resend | Must remain sandboxed/disabled |
| Production R2 | Must not use shared production storage |

## Automated evidence (not staging)

| Check | Suite | Result |
|-------|-------|--------|
| FT happy path + reports + expel | `npm run test:integration` (disposable PG) | **8 pass** |

Known product gap: unused FT statuses (`QA-FT-001`). FE/BE admin role drift (`QA-ROLE-001`) needs staging confirmation when available.
