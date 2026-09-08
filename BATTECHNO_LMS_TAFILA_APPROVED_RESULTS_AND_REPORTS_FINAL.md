# BATTECHNO LMS — Tafila Approved Results + Reports Final

**Opportunity (online / عن بعد):** `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`  
**Policy source:** `AUTHORIZED_MANUAL_REVIEW`  
**Applied:** 2026-09-08

## Reconciliation policy

- Historical Excel **ELIGIBLE** students remain **ELIGIBLE**.
- Historical Excel **NOT_ELIGIBLE** students remain **NOT_ELIGIBLE** (incl. Laith admin override).
- Raw task submissions are preserved.
- Approved task component (/40) may be corrected so Final Score matches 20/20/40/20 and eligibility.
- No forcing every corrected student to exactly 80; scores stay differentiated by attendance/post/behavior/excel context.
- Stale failure reasons removed for eligible students.

## Counts

| Metric | Value |
|---|---:|
| Online opportunity students | 151 |
| Historical Eligible | 146 |
| Historical Not Eligible | 5 |
| Eligible preserved | 146 |
| Task evaluations corrected | 144 |
| Eligible below 80 after | 0 |
| Eligible null score after | 0 |
| Score breakdown mismatches | 0 |
| Eligible with failure reasons | 0 |
| Final Eligible | 146 |
| Final Not Eligible | 5 |

## Laith (`320230601066`)

| Item | Value |
|---|---|
| Task 1 | 84 |
| Task 2 | 78 |
| Task 3 / 4 | 0 / unsubmitted |
| Task points | 16.2 / 40 |
| Attendance | 20 / 20 |
| Post | 14.4 / 20 |
| Behavior (authorized incomplete criteria as 0) | 8.8 / 20 |
| Final score | **59.4** |
| Status | NOT_ELIGIBLE |

## Reports / surfaces

| Surface | Status |
|---|---|
| Student card (approved score + breakdown) | Updated |
| Student comprehensive report | Uses approved overlay |
| Opportunity final report API | `GET /admin/field-training/:id/reports/final` |
| Opportunity comprehensive report API | `GET /admin/field-training/:id/reports/comprehensive` |
| Excel export | Approved overlay |
| Completion letters | Uses `completion_eligibility_status` after reconciliation |
| Canonical resolver | `resolveFieldTrainingApprovedResult(applicationId)` |

## Human-readable sources

| Internal | Arabic |
|---|---|
| AUTHORIZED_MANUAL_REVIEW | مراجعة واعتماد إداري |
| EXCEL_BASELINE | النتيجة المعتمدة المرسلة للجامعة |
| VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE | إعادة احتساب معتمدة |
| AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE | قرار إداري معتمد |

## Scripts / artifacts

- `backend/scripts/reconcile-tafila-manual-review.js`
- `BATTECHNO_LMS_TAFILA_MANUAL_REVIEW_RECONCILIATION_DRY_RUN.json`
- `BATTECHNO_LMS_TAFILA_ALL_STUDENTS_ELIGIBILITY_REPORT.csv`
- Tests: `backend/tests/fieldTraining.tafilaApprovedExcel.unit.test.js`

## Scope

Applies only to opportunity `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`.  
Does not merge onsite opportunity `01666ebc-bfc1-4948-87a5-2add3f641c65`.

## Suggested commit

```
fix: reconcile Tafila approved grades and unify final comprehensive reports
```
