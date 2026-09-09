# Mutah Field Training Evaluation — Official Word Export

## Why PDF export was disabled for Mutah

LibreOffice DOCX → PDF conversion was reversing or flattening the official Mutah evaluation grid. The uploaded Word template already stores the score table in visual-LTR XML (`ضعيف 1` first, `الرقم` last). Word paints that as **الرقم on the visual right**. PDF conversion treated table direction differently, which produced double-mirrored columns, wrong checkmark placement, and pagination drift (extra pages / split tables).

For this Mutah delivery the official artifact is the populated `.docx` itself. No LibreOffice, Puppeteer, HTML renderer, or PDF conversion is used on the generate / download / ZIP path.

## DOCX pipeline

```
Admin-uploaded official Mutah DOCX
  → clone the exact OPC ZIP package (JSZip; media/rels/styles/settings kept)
  → replace labeled cells / placeholders with student + evaluation data
  → Excel fallback for static fields, then غير متوفر
  → authorized eligible missing criteria C3/C4/C6/C7/C8/C10 → 5/5 (do not overwrite existing scores)
  → set w:bidiVisual on the evaluation table only
  → set w:bidi + right alignment on Arabic paragraphs in that table
  → store generated DOCX (versioned current row; historical files are not deleted)
  → individual download = Word MIME + UTF-8 filename
  → bulk ZIP = DOCX files under جامعة مؤتة / المشرف / مؤهل|غير مؤهل
```

`fillDocxTemplate` rewrites XML parts in the cloned package. It does not rebuild the document from scratch and does not drop `word/media/*`.

Official output MIME:

`application/vnd.openxmlformats-officedocument.wordprocessingml.document`

ZIP MIME: `application/zip`

Filename:

`{StudentName}_{UniversityNumber}_تقييم_التدريب_الميداني.docx`

## RTL XML fix

The evaluation table is **not** cell-reversed. `Array.reverse()` is not used on table cells, columns, or the score array.

Logical XML order (same as the uploaded template):

`ضعيف 1 | متوسط 2 | جيد 3 | جيد جداً 4 | ممتاز 5 | مجال التقييم | الرقم`

`<w:bidiVisual/>` is written **once** inside that table’s `<w:tblPr>`. Arabic paragraphs in the grid get `<w:bidi/>` and right alignment. English header paragraphs outside the grid are left unchanged.

Checkmarks are placed by **semantic header label** (`ratingColumnIndexForScore`), not by visual index.

Required meaning:

| Score | Column |
| --- | --- |
| 5 | ممتاز |
| 4 | جيد جداً |
| 3 | جيد |
| 2 | متوسط |
| 1 | ضعيف |

## bidiVisual verification

Automated tests open `word/document.xml`, locate the evaluation table, and assert:

- `<w:bidiVisual/>` appears **exactly once** in that table’s properties
- header cell order is still the original logical order (no manual reverse)
- C1=1 … C5=5 mark the correct semantic columns
- `ensureScoreGridRtl` is idempotent

The original Mutah template already has `w:bidiVisual` on some **other** (non-score) tables. Those are preserved. Document-wide `bidiVisual` count is therefore greater than 1; the acceptance check is scoped to the evaluation table.

Microsoft Word COM on generated samples:

- 2 pages
- 4 shapes (logo / stamp / signature)
- `TableDirection = 1` (LTR), **same as the original uploaded template**
- first visible column = ضعيف 1 (left)
- last visible column = الرقم (right)

Word did not flip the visual columns when `w:bidiVisual` was added **without** reversing cells. That is the intended anti-double-mirror behavior.

## Score mapping

Regression: Criterion 1=1, 2=2, 3=3, 4=4, 5=5.

XML result: C1 under ضعيف 1, C2 under متوسط 2, C3 under جيد 3, C4 under جيد جداً 4, C5 under ممتاز 5.

Eligible students with missing authorized professional criteria receive 5/5 (`MANUAL_AUTHORIZED_BULK_RATING`) only for empty C3/C4/C6/C7/C8/C10. Existing scores are not overwritten.

NOT_ELIGIBLE students are still exported. Unscored professional cells stay blank. Comments include `حالة الطالب: غير مؤهل` plus LMS eligibility reasons. Incomplete professional totals render as `غير مكتمل`, not a fake `/50`.

## 98-student reconciliation

Source: official Mutah supervisor Excel (98 rows). Matching: university number first, university email fallback. Name-only matching is not used.

Live apply + ZIP (`scripts/_mutah-export-excel98-final.js --apply --zip`):

| Check | Result |
| --- | --- |
| Excel students | 98 |
| LMS matched | 98 |
| Unmatched Excel rows | 0 |
| DOCX generated | 98 |
| ZIP DOCX files | 98 |
| Missing | 0 |
| Duplicates | 0 |
| Unexpected | 0 |
| PDF files in ZIP | 0 |
| Technical failures | 0 |

One extra LMS platform/test account was excluded from the official population (`platformExcludedCount: 1`). It is not in the Excel and was not added to the ZIP.

Missing business data does not drop a student. Soft delivery uses LMS → Excel → opportunity defaults → `غير متوفر`. Academic supervisor comes from Excel `المشرف الأكاديمي` / `اسم المسؤول`.

## Word visual QA

Three generated samples (no PDF conversion):

1. Arabic eligible — أحمد كمال حمد الشواوره / 212022221209
2. English name — Sara Ahmad / 120232222099
3. NOT_ELIGIBLE — عمر محمد ثلجي المواجده / 120232222080

Word COM: 2 pages, 4 shapes, evaluation table 7×12, الرقم on the right, stamp/signature present, media files preserved (`image1.png` … `image4.jpeg`). Omar comments contain `حالة الطالب: غير مؤهل` and the training-hours reason.

## ZIP structure

```
جامعة مؤتة/
  ├── {اسم المشرف الأكاديمي}/
  │   ├── مؤهل/
  │   │   └── {اسم}_{الرقم}_تقييم_التدريب_الميداني.docx
  │   └── غير مؤهل/
  │       └── ...
```

All 98 students appear exactly once. Example folders: زكريا الطراونه, أ.د. مصطفى حماد, د. خالد الطراونة, أ.د. احمد الحسنات.

## Frontend / readiness

- إصدار جميع التقييمات → generate DOCX
- تنزيل جميع التقييمات → ZIP of DOCX
- Individual action: تنزيل Word
- Preview is metadata + تنزيل Word (no fake HTML/PDF preview of the official report)
- `docxGenerationReady` is independent of LibreOffice
- UI: توليد Word: جاهز / PDF: غير مستخدم لهذه الدفعة
- Missing LibreOffice does **not** raise `RENDERER_NOT_AVAILABLE` for this workflow

Old stored PDFs are not deleted. They remain historical. Current official files are DOCX (`filled_docx_file_id`).

## Remaining issues

- Word COM still reports `TableDirection = 1` even with `w:bidiVisual` on the score table. Visual layout matches the original Mutah template (الرقم on the right). Do not “fix” this by reversing XML cells.
- In-browser Word rendering is not provided. Reviewers download/open the real DOCX.
- An Excel row with no LMS application still cannot produce a report (0 such rows in this batch).
- Host has LibreOffice installed, but the Mutah Word export path does not call it. Do not re-enable conversion for this delivery.

## Suggested commit

```
fix: export Mutah evaluations as exact RTL DOCX reports
```
