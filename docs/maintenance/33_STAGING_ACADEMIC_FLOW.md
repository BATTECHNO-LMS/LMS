# 33 — Staging Academic Flow (QA-STAGING-SMOKE-001)

**Status:** **Not executed in browser** — no staging SPA/API.

## Intended browser sequence (blocked)

1. Student login → QA academic assessment  
2. Submit text and/or URL → POST success  
3. Duplicate create → SPA uses existing row / 409 `ACADEMIC_SUBMISSION_EXISTS`  
4. Edit same submission where allowed  
5. Instructor grade create → edit non-final → finalize with confirm  
6. Post-finalize mutate → 409 `GRADE_FINALIZED`  
7. Student views final grade/feedback  
8. Cross-university instructor denied  
9. Unauthorized role denied  

Out of scope (unchanged): binary uploads, revision workflow, quiz attempts, certificate grade gating.

## Automated evidence (not staging)

| Check | Suite | Result |
|-------|-------|--------|
| Submit / uniqueness | BE `authorization.academicSubmission001.uniqueness.test.js` | Pass (unit) |
| Finalize immutability | BE `authorization.academicGrade001.finalizedImmutability.test.js` | Pass (unit) |
| SPA wiring | FE `academicDelivery.iss002.test.js` | Pass (unit) |

## Staging run log

| Step | Browser | API | Console | Screenshot |
|------|---------|-----|---------|------------|
| All steps | Skipped | Skipped | N/A | None |

**Finding:** **QA-STG-001** blocks this flow until staging is provisioned.
