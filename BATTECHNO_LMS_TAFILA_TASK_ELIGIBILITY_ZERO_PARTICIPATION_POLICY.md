# BATTECHNO LMS — Tafila Task Eligibility + Zero-Participation Policy

## Opportunity

`4d9466cb-127b-42f2-ac08-88e7fcc7c7df` — جامعة الطفيلة التقنية

Suggested commit (not created):

`fix: align Tafila task eligibility and zero participation scoring`

---

## Canonical scoring source

`fieldTraining.qualification.js` → `calculateFieldTrainingFinalQualification`

Persisted via `fieldTraining.qualification.service.js` into:

- `field_training_applications.completion_eligibility_status`
- `field_training_applications.eligibility_reason` (labels + details snapshot)
- `field_training_final_evaluations` snapshot

Frontend / Excel / comprehensive report consume this snapshot or the same service — **no independent React scoring**.

## Task grade calculation (40 points)

For each required task:

`taskPercentage = manualScore / maxScore * 100` (missing / not accepted = **0**)

`taskAverage = sum(percentages) / requiredCount`

`taskPoints = taskAverage * 0.40`

Missing tasks stay in the denominator.

## Gates

1. Required tasks completed (accepted/graded)
2. Final score ≥ **80**
3. Attendance / hours / pre / post / behavior as before

Eligible only when all mandatory gates pass **and** score ≥ 80.

## Zero-participation rule

Code: `TAFILA_ZERO_PARTICIPATION_POLICY_V1`

Applies **only** when:

- pre-assessment **not** completed
- **AND** submitted required tasks = **0**

Effective evaluation values become 0/100 (attendance points, post, tasks, behavior, final).

Raw attendance rows in `field_training_attendance` are **not** deleted or rewritten.

UI shows:

- الحضور المحتسب للتقييم = 0%
- optionally الحضور المسجل تاريخياً

## Laith override

University number: `320230601066`

Configured in `TAFILA_SCORING_RULES.eligibilityOverrides` (matched by university number only).

- Type: `FORCE_NOT_ELIGIBLE`
- Reason: `AUTHORIZED_ADMIN_ELIGIBILITY_DECISION`
- Preserve actual marks: **yes**
- Skip zero-participation: **yes**
- Do not fabricate professional scores

## Priority

1. expelled / failed  
2. authorized individual override  
3. zero-participation  
4. mandatory requirements  
5. final score ≥ 80  
6. eligible  

## Dry-run / apply results

Script: `backend/scripts/recalculate-tafila-zero-participation-policy.js`

Output: `BATTECHNO_LMS_TAFILA_ZERO_PARTICIPATION_DRY_RUN.json`

| Metric | Value |
|--------|-------|
| Students | 151 |
| Eligible | 86 |
| Not eligible | 65 |
| Zero-participation students | **1** — Layan Aljamal (`320250602134`) |
| Laith (`320230601066`) | NOT_ELIGIBLE, marks preserved, ZP not applied |
| Raw attendance preserved for ZP | Yes (recorded 100%, evaluation 0%) |
| Validations | Passed before apply |

## UI surfaces aligned

- Eligibility student card (ZP badge + evaluation attendance)
- Comprehensive student report (raw vs effective attendance)
- Excel / evaluation paths via same qualification service

## Tests

`backend/tests/fieldTraining.qualification.tafila.unit.test.js`

- missing task = 0 in average
- zero-participation AND condition
- no ZP when pre exists or any task submitted
- Laith override by university number
