# Mutah V11 final evaluation reports and eligible completion letters

**Date:** 2026-09-02  
**Opportunity:** التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026 (`6c8783ec-49fd-428e-83e2-8b65e52c3b4f`)  
**Official template:** Field Training Evaluation Template Version 11 (`bd3797b2-6131-466a-a41a-25d460105f46`)  
**Suggested commit message:** `fix: finalize Mutah V11 evaluations and eligible completion letters`

No `git add` / `git commit` / `git push` / PR was performed.

---

## Acceptance

| Check | Result |
|---|---|
| Mutah Template | **V11** |
| Signed | **PASS** |
| Stamped | **PASS** |
| Source RTL preserved | **PASS** |
| Manual reverse | **NO** |
| Generated pages (Word COM) | **2** |
| Extra third page | **NO** (after comment-box fit) |
| Eligible evaluation | **PASS** |
| Not Eligible evaluation | **PASS** |
| Not Eligible grid | **BLANK** |
| Not Eligible displayed total | **0** |
| Fake attendance | **NO** |
| Fake hours | **NO** |
| Actual attendance preserved | **PASS** |
| Actual hours preserved | **PASS** |
| Actual ineligibility reasons | **PASS** |
| Completion letters for Eligible | **PASS** (88 already current) |
| Completion letters for Not Eligible | **0 new** |
| Non-eligible completion letters | **NOT ISSUED** by `إصدار الكل` |

---

## 1. V11 resolution

The opportunity previously pointed at a missing/non-Mutah `evaluation_template_id`, so resolution returned `assigned_template_unavailable` instead of V11.

Fixes:

- Mutah V11 is the active university default (`is_default`, `is_active`, `version: 11`, `fillMode: label_form`).
- The Mutah opportunity is assigned to V11.
- Older Mutah template versions 1–10 remain in the database (historical).
- If a Mutah opportunity’s assigned template is missing, `resolveTemplate()` now falls through to the university default **only when that default is V11**.
- Generation clones the V11 source buffer, fills a student-specific copy, and stores DOCX only. The source file is never edited in place.

Source asset: `backend/assets/field-training/mutah-official-evaluation.docx` (file id `0e3534bb-5f30-40bf-a975-f37b42046537`).

---

## 2. RTL root cause

V11 already stores the evaluation grid in visual-LTR XML:

`ضعيف 1 | متوسط 2 | جيد 3 | جيد جدا 4 | ممتاز 5 | مجال التقييم | الرقم`

Word paints that as visual-from-the-right:

`الرقم → مجال التقييم → ممتاز 5 → … → ضعيف 1`

The previous fill path **added** `w:bidiVisual`, stripped floating-table `w:tblpPr`, and injected `w:bidi` / `jc=right` on Arabic score-grid paragraphs. That double-mirrored a table that was already correct.

Current fill:

- does **not** add `w:bidiVisual` to the score grid
- does **not** call `reverse()` / `reverseCells()` / `reverseColumns()`
- does **not** physically reorder source cells
- maps ✓ by header text (`ممتاز→5` … `ضعيف→1`) via `ratingColumnIndexForScore`
- preserves `tblPr`, `tblGrid`, `tblpPr`, cell order, and column widths

Word COM `TableDirection = 1` (RTL) on generated files. Score-grid XML `bidiVisual` count remains **0**, matching source.

---

## 3. Three-page root cause

Source V11 = 2 pages (`w:lastRenderedPageBreak` count = 1, Word COM = 2).

The extra page was **not** a missing `sectPr`. It came from fill growth in the original comments box:

1. RTL rewrite (bidiVisual + paragraph bidi) increased grid height — now removed.
2. Eligible auto-comment was a long wrapping paragraph **plus** three reserved empty comment paragraphs (`w:spacing w:before="120"`).
3. Not-eligible reasons were stacked as extra bullets/`w:br` lines on top of those reserved empty paragraphs.

Fix, still inside the original comments table:

- Eligible comment is `حالة الطالب: مؤهل` only (fits the stamp page).
- Not-eligible reasons stay factual and are packed as:
  `حالة الطالب: غير مؤهل` + `أسباب عدم التأهيل: - …؛ - …`
- Unused empty comment paragraphs are dropped.
- Comment paragraph `before` spacing is 0 after fill.

Word COM after the fix:

- Eligible (Omar Madadha `120222231170`): **2 pages**
- Not eligible (Noor `120252222154`): **2 pages**
- Not eligible / expelled (ابرار `120252222116`): **2 pages**
- Local C1–C5 semantic sample: **2 pages**

---

## 4. Counts (Mutah summer opportunity)

Approved applications: **104**

| Status | Count |
|---|---|
| Authoritative eligible | **88** |
| Authoritative not eligible / ineligible | **16** (15 `not_eligible` + 1 expelled) |

Current official evaluations:

| Template | Eligibility | Count |
|---|---|---|
| V11 | ELIGIBLE | 88 |
| V11 | NOT_ELIGIBLE | 15 |
| V1 | NOT_ELIGIBLE | 1 (BATUNI demo student, no university number — cannot fill official V11) |

Completion letters:

| Metric | Count |
|---|---|
| Eligible | 88 |
| Issued (status=`issued`) | 89 |
| Already current on `إصدار الكل` | 88 |
| `letters_to_issue` | 0 |
| `notEligibleExcluded` | **15** |
| Expelled excluded | 1 (ابرار) |
| New letters issued to NOT_ELIGIBLE by this run | **0** |
| Historical demo letter | 1 (`FT-DEMO-99964822`, BATUNI Student, 2026-08-08) — not a Mutah-cohort letter and not issued by V11 `إصدار الكل` |

`إصدار الكل` now returns `eligible`, `issued` / `alreadyCurrent`, `failed`, and **`notEligibleExcluded`**.

---

## 5. Eligible vs not-eligible evaluation policy

Eligible:

- Full V11 form: identity, university number, specialty, semester/year, dates, actual attendance/hours/absence, organization, 10 professional criteria, total, comments, supervisors, dates.
- Missing authorized professional ratings still use the existing completion workflow (`3,4,6,7,8,10 → 5` when those scores are absent).
- Grid checkmarks are semantic, not visual-index based.

Not eligible:

- Professional grid **blank**
- Displayed total **0**
- `professionalEvaluationStatus = SKIPPED_DUE_TO_INELIGIBILITY`
- Criterion scores persisted as `null` (not fake 0/1 on a 1–5 scale)
- Attendance/hours taken from actual records; unknown remains **غير متوفر**
- Missing professional ratings do **not** block generation (`READY_FOR_NOT_ELIGIBLE_REPORT`)
- Reasons come from Field Training eligibility evidence only

No separate `إفادة عدم استكمال التدريب` PDF was added. The V11 evaluation for NOT_ELIGIBLE is the status document. It is **not** named or worded as `كتاب إنهاء تدريب`.

---

## 6. Completion letters

Existing gates were not weakened (eligible status, 140 hours, attendance, submissions, post-assessment, expelled).

- Completion letters are issued only for authoritative **eligible** students.
- Filenames unchanged: `{StudentName}_{UniversityNumber}_كتاب_إنهاء_التدريب.pdf`
- Evaluation filenames: `{StudentName}_{UniversityNumber}_تقييم_التدريب_الميداني.docx`

---

## 7. Remaining technical items

1. **BATUNI demo student** still has a historical V1 NOT_ELIGIBLE evaluation and an old demo completion letter. No university number, so official V11 cannot be generated. Not part of the 98-student Mutah Excel cohort.
2. **`إصدار الكل` during this session** did not create a new job: all 88 eligible letters were already current. One earlier `PDF_RENDER_FAILED` row (أحمد الرماضين) already has an issued PDF (`FT-MTH9S8Q4`).
3. Bulk regenerate after the two-page comment-box fix completed with **0 technical failures**: Excel population 98/98 matched (`87` complete, `11` with missing-data warnings) plus 5 extra official V11 reports outside the Excel file. See `backend/tmp/mutah-v11-finalize/v11-repage-bulk.json`.
4. Some not-eligible reports show `غير متوفر` for academic supervisor when no supervisor is assigned. That is unknown factual data, not a fabricated name.

---

## 8. Semantic score test

Generated C1=1 … C5=5:

| Criterion | Score | Header column |
|---|---|---|
| C1 | 1 | ضعيف |
| C2 | 2 | متوسط |
| C3 | 3 | جيد |
| C4 | 4 | جيد جداً |
| C5 | 5 | ممتاز |

XML header order unchanged. No double-mirroring.

---

## 9. Files touched (implementation)

- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.formFill.js`
- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.payload.js`
- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.comments.js`
- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.service.js`
- `backend/src/modules/fieldTraining/fieldTrainingEvaluation.docx.js`
- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.service.js`
- `frontend/src/pages/admin/fieldTraining/components/manage/ManageLinkTab.jsx`
- `frontend/src/i18n/locales/ar/fieldTraining.json`
- `frontend/src/i18n/locales/en/fieldTraining.json`
- unit tests under `backend/tests/fieldTrainingEvaluation.*` and `fieldTraining.completionLetters.supervisorExcel.unit.test.js`
