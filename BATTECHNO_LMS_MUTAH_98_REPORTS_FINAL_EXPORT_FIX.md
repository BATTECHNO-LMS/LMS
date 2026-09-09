# BATTECHNO LMS — Mutah 98 Evaluation Reports Final Export Fix

**Date:** 2026-09-02  
**Opportunity:** `6c8783ec-49fd-428e-83e2-8b65e52c3b4f`  
**Excel fixture:** `backend/tests/fixtures/mutah-field-training-supervisor-assignments.xlsx`  
**ZIP artifact:** `backend/tmp/mutah-excel98-export/جامعة_مؤتة_تقارير_تقييم_التدريب_الميداني.zip`

## Objectives

1. Fix evaluation score-table horizontal orientation to match the official Mutah DOCX.
2. Generate an official evaluation PDF for every Excel student (exactly 98), without blocking on missing business data.

## Excel population

| Metric | Value |
|--------|------:|
| Excel row count | 98 |
| Matched to LMS | 98 |
| Unmatched | 0 |
| Platform students excluded from official population | 1 |
| Extra non-Excel students included in ZIP | 0 |

Match keys: university number (primary), university email (fallback). Names were never used alone.

## Table-direction fix

### Root cause

The official score grid was a **floating** table (`w:tblpPr`). LibreOffice could paint an orphan bullet beside the table and present a mirrored visual compared with Word.

XML cell order after fill (LibreOffice paints first cell on the LEFT):

`ضعيف 1 | متوسط 2 | جيد 3 | جيد جداً 4 | ممتاز 5 | مجال التقييم | الرقم`

Which yields the required RIGHT→LEFT reading:

`الرقم → مجال التقييم → ممتاز 5 → … → ضعيف 1`

### Fix applied

In `fieldTrainingEvaluation.formFill.js`:

- Strip `w:tblpPr` / `w:tblOverlap` on score grids (via `ensureScoreGridRtl` / document normalize).
- Keep removing `w:bidiVisual` (LibreOffice reverses columns when present).
- Flip cells only when `الرقم` is already the first XML cell.
- Place checkmarks by header pattern (not by hard-coded left index).

### Checkmark mapping verification

Regression test `fieldTrainingEvaluation.mutahExcel98.unit.test.js`:

| Criterion | Score | Expected header |
|-----------|------:|-----------------|
| C1 | 1 | ضعيف 1 |
| C2 | 2 | متوسط 2 |
| C3 | 3 | جيد 3 |
| C4 | 4 | جيد جداً 4 |
| C5 | 5 | ممتاز 5 |

Result: **PASS**

Filled QA sample (`tmp/mutah-excel98-export/qa/rtl-check.*`):

- `assertDesiredScoreGridHeaderOrder` = true
- `tblpPr` = false
- `bidiVisual` = false
- 2-page PDF retained

## Missing-data soft delivery

New module: `fieldTrainingEvaluation.mutahExcelDelivery.js`

Priority: LMS → Excel → opportunity defaults → `غير متوفر`

Policy highlights:

- Missing business fields no longer block PDF generation for Mutah Excel export (`mutahSoftDelivery`).
- Excel `المشرف الأكاديمي` maps to `academic_supervisor_name` / `responsible_person_name` (اسم المسؤول).
- Excel university number / specialty / host organization fill LMS gaps.
- ELIGIBLE missing authorized criteria C3/C4/C6/C7/C8/C10 → score `5` (`MANUAL_AUTHORIZED_BULK_RATING`), without overwriting existing scores.
- NOT_ELIGIBLE missing criteria remain empty (no fabricated 5/5).
- Incomplete professional grid total renders `غير مكتمل` (not a fake /50).
- Unknown attendance/hours use `غير متوفر` (unknown ≠ 0).

Fidelity updated to accept incomplete checkmark counts and `غير مكتمل` totals when `_mutahSoftDelivery` is set.

## Generation batch result

| Classification | Count |
|----------------|------:|
| GENERATED_COMPLETE | 98 |
| GENERATED_WITH_MISSING_DATA | 0 |
| FAILED_TECHNICAL | 0 |
| **Total PDFs** | **98** |

Eligible reports: **87**  
Not Eligible reports: **11**

Script: `backend/scripts/_mutah-export-excel98-final.js`  
Service entry: `exportMutahExcelPopulationReports(...)`

## ZIP reconciliation

Path layout:

`جامعة مؤتة / {exact academic supervisor from Excel} / {مؤهل|غير مؤهل|غير محدد} / {Name}_{Number}_تقييم_التدريب_الميداني.pdf`

| Check | Result |
|-------|--------|
| ZIP student PDFs | 98 |
| missingFromZip | 0 |
| duplicatesInZip | 0 |
| unexpectedInZip | 0 |
| Supervisor surname merge | none (exact normalized names only) |

## Visual QA samples

Saved under `backend/tmp/mutah-excel98-export/qa/`:

- `eligible.pdf` (120232221002)
- `not_eligible.pdf` (120222212023)
- `rtl-check.pdf` / `.docx` (forced C1=1 … C5=5 mapping sample)

## Remaining issues

1. Production UI action label `إصدار جميع تقارير مؤتة` is not wired in this change set; backend/script path is ready (`exportMutahExcelPopulationReports` + `_mutah-export-excel98-final.js`).
2. One platform/test account was excluded from the official Excel population (expected).
3. Official template asset still contains the typographic `فضعيف` split for “ضعيف”; scoring patterns already accept it. Do not redesign the uploaded template.

## Suggested commit message

```
fix: export all 98 Mutah evaluations with correct RTL score table
```

**Git note:** No commit/push was performed per request.
