# BATTECHNO LMS — Tafila Approved Excel Final Reconciliation

**Opportunity:** `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`  
**University:** جامعة الطفيلة التقنية / Tafila Technical University  
**Applied:** 2026-09-08 (DB persist via domain service, not raw SQL)

## 1. Baseline mapping count

- Embedded approved Excel baseline rows: **151**
- Canonical file: `backend/src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline.js`
- Match key: `university_student_number` only (never name)

## 2. LMS population count

- Approved applications on primary opportunity: **151**

## 3. Matched records

- Matched by university number: **151**

## 4. Missing / extra

- Missing LMS students (no baseline): **0**
- Extra mapped numbers (not in LMS population): **0**

## 5. Eligible ≥ 80 preserved

- Excel `ELIGIBLE` with score ≥ 80 left on Excel mark/status: **134**
- Source: `EXCEL_BASELINE`

## 6. Eligible < 80 detected

Excel baseline listed **12** students as `ELIGIBLE` with score &lt; 80:

| University number | Excel | LMS recalc | Final decision |
|---|---:|---:|---|
| 320220603068 | 73 | 51.1 | NOT_ELIGIBLE |
| 21220019 | 69 | 57.9 | NOT_ELIGIBLE |
| 320220605260 | 77 | 70.7 | NOT_ELIGIBLE |
| 320220603012 | 78 | 61 | NOT_ELIGIBLE |
| 320220605090 | 70 | 52.8 | NOT_ELIGIBLE |
| 320210601146 | 76 | 54 | NOT_ELIGIBLE |
| 320220603017 | 68 | 50.8 | NOT_ELIGIBLE |
| 320210601043 | 74 | 66.7 | NOT_ELIGIBLE |
| 320230601009 | 68 | 50 | NOT_ELIGIBLE |
| 320230601004 | 73 | 54 | NOT_ELIGIBLE |
| 320220603026 | 76 | 54 | NOT_ELIGIBLE |
| 320220603142 | 79 | **83.2** | **ELIGIBLE** (verified recalc) |

No score was forced to 80. No fabricated grades.

## 7. Recalculation results

- Recalculated to ≥ 80 (keep ELIGIBLE, replace approved score): **1** — عمر جهاد محمود جبريل (`320220603142`) → **83.2**
- Source: `VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE`
- Recalculated still &lt; 80 → NOT_ELIGIBLE: **11**

Scoring model used: Attendance 20 + Post 20 + Tasks 40 + Behavior 20. Missing required tasks count as 0 in the denominator.

## 8. Students remaining / changing to Not Eligible

**Final NOT_ELIGIBLE: 16**

- 4 approved zero / fixed not-eligible (Excel 0):  
  `320250602134`, `320220603075`, `320250603244`, `320220603007`
- 1 Laith admin override: `320230601066`
- 11 formerly Excel-eligible &lt; 80 who failed LMS evidence recalc

## 9. Laith task-grade correction

University number: **320230601066** (ليث محمد احمد بريوش)

| Task | Authorized / contribution |
|---|---|
| Task 1 | **84 / 100** (`AUTHORIZED_GRADE_OVERRIDE`, idempotent if already 84) |
| Task 2 | **78 / 100** |
| Task 3 | unsubmitted → **0** contribution (no fake submission) |
| Task 4 | unsubmitted → **0** contribution |

Task component: \((84+78+0+0)/4 = 40.5\%\) → **16.2 / 40**

## 10. Laith final result

- Status: **NOT_ELIGIBLE** (`AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE`)
- Numeric final score: **blocked** — missing professional/behavior evaluation  
  Code (internal only): `LAITH_FINAL_SCORE_BLOCKED_BY_MISSING_COMPONENT` → missing `behavior`
- User-facing Arabic reasons include administrative non-eligibility + completed 2 of 4 required tasks
- No completion letter

## 11. Official final counts

| Metric | Count |
|---|---:|
| LMS students | 151 |
| Baseline mappings | 151 |
| Final Eligible | **135** |
| Final Not Eligible | **16** |
| Eligible with score &lt; 80 | **0** |
| Eligible with null score | **0** |

## 12. UI / report / export consistency

Canonical helpers:

- `resolveApprovedTafilaEvaluationResult(applicationId)`
- `applyApprovedDisplayToQualification(...)`

Wired into:

- Admin eligibility student cards (stored approved score as primary «العلامة المعتمدة»)
- Comprehensive Student Report (approved + optional previous Excel / calculated)
- Excel student exports (overlay approved score/status for this opportunity)
- Completion-letter gate continues to use `completion_eligibility_status` after reconciliation

Primary UI labels:

- العلامة المعتمدة: XX / 100  
- حد التأهيل: 80 / 100  
- الحالة المعتمدة: مؤهل / غير مؤهل  

## 13. Completion-letter eligibility

- Final approved ELIGIBLE → may issue completion letter  
- Final approved NOT_ELIGIBLE → must not issue successful completion letter  
- Laith → no completion letter  

Live `persistApplicationEligibility` now **locks** approved Tafila status/score so later recalculation cannot silently diverge.

## 14. Audit / history preservation

Preserved (not overwritten as source of truth):

- Attendance history  
- Task submissions / original grades (Laith corrections audited; previous score recorded)  
- Pre/post assessments  
- Professional ratings  
- Prior evaluation snapshots  

Approved cohort result stored under  
`eligibility_reason.details.approvedEvaluationResult`  
as a reporting layer. Raw LMS calculated score kept as `calculatedFinalScore`.

## 15. Tests

- `backend/tests/fieldTraining.tafilaApprovedExcel.unit.test.js` — baseline count, preserve ≥80, recalc pass/fail, no force-to-80, Laith override, opportunity-scoped overlay
- Script: `backend/scripts/reconcile-tafila-approved-excel.js` (dry-run default; `--apply` after validation)
- Dry-run artifact: `BATTECHNO_LMS_TAFILA_APPROVED_EXCEL_RECONCILIATION_DRY_RUN.json`

## Scope guard

Applies **only** to opportunity `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`.  
Does not auto-apply to the duplicate Tafila opportunity, Mutah, Zarqa, or future cohorts.

## Suggested commit message

```
fix: reconcile Tafila approved evaluation results with verified 80-point eligibility
```
