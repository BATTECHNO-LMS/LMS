# BATTECHNO LMS — Tafila Task Score Normalization (80–90)

**Opportunity:** `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`  
**Policy:** `AUTHORIZED_MANUAL_REVIEW` (+ legacy aggregate when 0 submitted)  
**Applied:** 2026-09-08

## Formula

For each **submitted** task of a historically ELIGIBLE student:

`approvedTaskScore = round1(80 + rawTaskScore/100 * 10)` → range **80–90**

Unsubmitted tasks: remain `غير مسلّم` (no fabricated submission).

Task component (historical cohort only): average of **submitted approved scores only** × 40.

Zero submitted: aggregate `approvedTaskPoints = clamp(80 - base, 0, 40)`  
source `AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT`.

Final score always recalculated:

`attendance + post + approvedTasks + behavior`

## Results

| Metric | Value |
|---|---:|
| Students | 151 |
| Historically Eligible preserved | 146 |
| Historically Not Eligible | 5 |
| Submitted tasks corrected | 478 |
| Eligible below 80 after | 0 |
| Breakdown mismatches | 0 |
| Stale failure reasons | 0 |
| Final scores recalculated | 151 |
| Avg / Max / Min (from apply) | see University Final Report (canonical resolver) |

Validation: **PASSED** (`breakdown_mismatch_zero`, `submitted_eligible_task_scores_80_90`, Laith checks).

## Laith (`320230601066`)

- Task 1: **84**, Task 2: **78**, Task 3/4: unsubmitted  
- Task points: **16.2 / 40** (full denominator)  
- Final: **59.4** — **NOT_ELIGIBLE**

## Artifacts

- Script: `backend/scripts/reconcile-tafila-task-normalization.js`
- Dry-run JSON: `BATTECHNO_LMS_TAFILA_TASK_NORMALIZATION_DRY_RUN.json`
- Module: `fieldTraining.tafilaTaskNormalization.js`
- Tests: `tests/fieldTraining.tafilaTaskNormalization.unit.test.js`

## Suggested commit

```
fix: normalize Tafila approved task grades and recalculate final reports
```
