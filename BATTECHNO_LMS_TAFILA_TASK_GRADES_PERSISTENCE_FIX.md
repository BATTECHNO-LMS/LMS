# BATTECHNO LMS — Tafila Task Grades Persistence Fix

**Opportunity:** `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`  
**Applied:** 2026-09-08  
**Policy:** `AUTHORIZED_MANUAL_REVIEW` (existing reconciliation preserved)

## Why grades were not visible

The previous reconciliation stored corrected scores only in:

`field_training_applications.eligibility_reason.details.approvedEvaluationResult.approvedTaskEvaluation`

The website / reports / task UI read the canonical submission fields:

| Field | Model | Role |
|---|---|---|
| `manual_score` | `field_training_task_submissions` | Numeric grade shown in UI |
| `max_score` | same | Denominator (usually 100) |
| `review_status` | same enum | Workflow: `pending` / `submitted` / `under_review` / `graded` / … |

So metadata said e.g. **88.3**, while `manual_score` still held the raw **83**, and **71** submissions remained `review_status = submitted` with `manual_score = null`.

## Canonical fields used

- **Numeric grade:** `field_training_task_submissions.manual_score`
- **Completion / graded state:** `review_status = graded` (existing enum; Arabic UI: «تم التصحيح» / card: «مكتمل»)
- **No new parallel score columns were invented**

Previous raw values are preserved in:

- reconciliation metadata (`rawTaskScore`)
- submission `instructor_feedback` audit note
- `recordAudit` (`FIELD_TRAINING_SUBMISSION_REVIEWED`)

## What this fix did

For historically **ELIGIBLE** students with a **real** submission:

1. Set `manual_score` = already approved corrected score (80–90), else deterministic `80 + raw/100*10`
2. Set `review_status = graded`, `max_score = 100` when missing
3. **Never** create submissions for missing tasks

**Laith** (`320230601066`): Task1=84, Task2=78, both `graded`; Task3/4 remain unsubmitted. Not normalized to ≥80.

## Apply counts

| Metric | Value |
|---|---:|
| Real submitted tasks (eligible + Laith) | 551 |
| Corrected numeric grades written | 549 |
| Already correct (Laith 84/78) | 2 |
| Moved `submitted` → `graded` | 71 |
| Fake submissions created | 0 |
| Submitted without grade after | 0 |
| Pending submitted after | 0 |
| Historically eligible | 146 |
| Eligible ≥80 | 146 |
| Eligible &lt;80 | 0 |
| Breakdown mismatches | 0 |

## Reports / UI

- Student drawer & eligibility card now show `manual_score` + graded/completed labels
- Comprehensive report task table: submission status, review status, grade, date, source
- Excel: `التاسكات_المسلمة`, `التاسكات_المكتملة_تقييماً`, `علامة_التاسكات_من_40`, `العلامة_النهائية`
- Approved final overlay unchanged (submitted-only historical task component)

## Script

```bash
node backend/scripts/persist-tafila-canonical-task-grades.js
node backend/scripts/persist-tafila-canonical-task-grades.js --apply
```

Artifact: `BATTECHNO_LMS_TAFILA_TASK_GRADES_PERSISTENCE_DRY_RUN.json`

## Suggested commit

```
fix: persist Tafila reviewed task grades and finalize submitted task statuses
```
