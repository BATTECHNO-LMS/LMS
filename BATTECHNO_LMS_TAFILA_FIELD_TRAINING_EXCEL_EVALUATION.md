# BATTECHNO LMS — Tafila Field Training Excel Evaluation

**Date:** 2026-09-02  
**Opportunity:** `01666ebc-bfc1-4948-87a5-2add3f641c65`  
**Title:** التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026  
**Template:** `backend/assets/field-training/tafila-field-training-excel-evaluation.xlsx`  
**Output:** `backend/tmp/tafila-excel-evaluation/تقييم_التدريب_الميداني_جامعة_الطفيلة_التقنية.xlsx`

## Template columns

Source workbook sheet: `Form Responses 1` (18 columns, header row only).

| # | Header (abbreviated) |
|---|----------------------|
| 1 | اسم الشخص المسؤول عن التدريب في الشركة |
| 2 | رقم الموبايل للمشرف المسؤول عن التدريب في الشركة |
| 3 | البريد الإلكتروني للمشرف المسؤول عن التدريب في الشركة |
| 4 | اسم الطالب الرباعي |
| 5 | الرقم الجامعي |
| 6 | عدد الساعات الإجمالية التي تدربها الطالب |
| 7 | التزام الطالب بالتعليمات وساعات التدريب (1–10) |
| 8 | إنجاز المهام في وقتها المحدد (1–10) |
| 9 | إنجاز المهام بشكل صحيح (1–10) |
| 10 | التعلم وبناء مهارات تقنية عملية (1–10) |
| 11 | التعاون والاحترام (1–10) |
| 12 | تحمل المسؤولية والعمل بروح الفريق (1–10) |
| 13 | التواصل والتعبير (1–10) |
| 14 | ابتكار حلول للمشكلات (1–10) |
| 15 | ابتكار حلول للمشكلات (1–10) — **duplicate wording, kept** |
| 16 | التقييم العام للتدريب (من 100) |
| 17 | المهام التي قام الطالب بأدائها |
| 18 | رابط/ملف المهام الاختياري |

Existing Arabic headers, column order, frozen header, and cell styles are cloned. The exporter sets `rightToLeft = true` and clears Google Forms data validations so zeros and `غير متوفر` are not dropped.

## Added columns

Inserted into the same sheet (result: **21 columns**):

- `الجامعة` immediately after `الرقم الجامعي`
- `الحالة` immediately before `التقييم العام`
- `سبب عدم التأهيل` immediately after `الحالة`

New headers copy the existing header font/fill/alignment. `سبب عدم التأهيل` and the tasks column wrap text.

## Duplicate problem-solving columns

Columns 14 and 15 have the **same Arabic wording**. They were not deleted. Both are filled with the same problem-solving score (`PERFORMANCE_DERIVED`, `REAL_SUPERVISOR_RATING`, `ADMINISTRATIVE_FALLBACK_7_9`, or `NOT_ELIGIBLE_ZERO`). They count as two of the nine 1–10 criteria in the /100 formula.

## Student population

| LMS status | Count | Exported |
|------------|------:|----------|
| approved | 13 | 13 |
| cancelled | 6 | 0 |
| rejected | 6 | 0 |

Population rule: **approved applications** on this opportunity, excluding test/demo accounts (`classifyOfficialReportExclusion`). One row per student. Cancelled and rejected applications are not treated as active Field Training students for this evaluation export.

Live export:

- Opportunity students (approved, non-test) = **13**
- Excel data rows = **13**
- Missing rows = **0**
- Duplicate university numbers = **0**

## Student mapping

| Excel field | Source |
|-------------|--------|
| اسم الطالب الرباعي | Canonical LMS display name (`resolveStudentDisplayName`) |
| الرقم الجامعي | Field Training university-number resolver (`resolveOfficialUniversityNumber`) — not internal IDs |
| الجامعة | `opportunity.universities` or active eligibility university — **not hardcoded**. Live value: `جامعة الطفيلة التقنية` |

Unknown non-critical fields use `غير متوفر`. Rows are never omitted.

## Company / supervisor defaults

Configured once on the opportunity (evaluation template tab → بيانات الشركة / بيانات مشرف الشركة), stored on `host_organization`, then copied to **every** student row.

| Default | Excel column |
|---------|--------------|
| Company supervisor name | اسم الشخص المسؤول عن التدريب في الشركة |
| Company supervisor phone | رقم الموبايل للمشرف |
| Company supervisor email | البريد الإلكتروني للمشرف |
| Company name / department / phone / email / address | Stored as opportunity defaults (also used by Word reports). The uploaded 18-column form has **no separate company-name columns**, so those values are not added as extra Excel columns. |

The company supervisor is **not** taken from the academic supervisor.

**Live Tafila:** `organization_name` and `host_organization` are currently empty. Export writes `غير متوفر` for the three supervisor columns. Admin/Super Admin can save defaults once; the next download will fill all 13 rows.

## Eligibility logic

Source of truth: stored `completion_eligibility_status` via `isEligibleStatus` (same Field Training completion eligibility as official reports).

| LMS status | Excel `الحالة` | `سبب عدم التأهيل` |
|------------|----------------|-------------------|
| eligible | مؤهل | blank |
| anything else (including pending / ineligible) | غير مؤهل | mapped reasons |

Arabic reasons (joined with `؛ ` when multiple):

- لم يستكمل الساعات التدريبية المطلوبة.
- نسبة الحضور أقل من الحد الأدنى المطلوب.
- لم يستكمل التسليمات المطلوبة.
- لم يستكمل التقييم البعدي.
- لم يستوفِ متطلبات التدريب الميداني.

Live: **0 مؤهل**, **13 غير مؤهل**. Every ineligible row has a non-empty reason.

## Rating formulas (ELIGIBLE only)

Priority for each 1–10 criterion:

1. Explicit professional/supervisor rating (`REAL_SUPERVISOR_RATING`, 1–5 × 2 or already 1–10)
2. Performance-derived percent → 1–10 (`PERFORMANCE_DERIVED`)
3. Seeded administrative fallback 7–9 (`ADMINISTRATIVE_FALLBACK_7_9`)

| Criterion | Evidence |
|-----------|----------|
| التزام (col 7) | attendance % + hours completion %; optional `rulesCompliance` |
| المهام في وقتها (col 8) | on-time submission % or task completion % |
| جودة المهام (col 9) | average task score % |
| التعلم (col 10) | post-assessment, then improvement/quality; optional `thinkingAndInitiative` |
| التعاون (col 11) | supervisor `supervisorCooperation`, else 7–9 |
| المسؤولية / الفريق (col 12) | supervisor `teamwork`, else 7–9 |
| التواصل (col 13) | supervisor `professionalConduct`, else 7–9 |
| حل المشكلات + duplicate (cols 14–15) | supervisor `problemSolving`, else quality + post-assessment %, else 7–9 |

Pre/post percentages are **normalized** into 1–10 (never copied raw into a rating column).

## 7–9 fallback criteria

Used only when the student is **مؤهل** and that criterion has no supervisor rating and no usable performance percent.

Allowed values: **7, 8, 9** only. Never 1–6 or 10 for fallback.

## Seeded randomness

```
sha256(`${applicationId}|${opportunityId}|${criterionCode}|v1`)
score = 7 + (firstByte % 3)
```

The same student/opportunity/criterion always gets the same fallback until `FALLBACK_VERSION` is intentionally changed.

## Not-eligible zero rule

If `الحالة` = غير مؤهل:

- every 1–10 evaluation column = **0** (`NOT_ELIGIBLE_ZERO`)
- التقييم العام = **0**
- completed hours are **not** forced to 0; real hours are kept; unknown hours stay `غير متوفر`

## General /100 formula

Nine scored 1–10 criteria (including the duplicate problem-solving column):

```
generalScore = round(SUM(criteria) / (9 × 10) × 100)
```

ELIGIBLE: calculated from those ratings. NOT_ELIGIBLE: **0**. No separate random /100 score.

## Tasks mapping

Submitted, non-rejected task titles, one per line.

If none: `لا توجد مهام مسجلة في المنصة`

Optional attachment column: left **blank** (no private filesystem paths).

## Hours

Authoritative display:

1. Attendance-derived completed hours when `hoursDataLoaded`
2. Stored `completed_training_hours` only when it is a real value (`> 0`, or `0` with `hours_updated_at` / `hours_updated_by_id`)
3. Otherwise `غير متوفر` — stored `0` with no update metadata is **unknown**, not zero

Live Tafila: all 13 approved rows have `completed_training_hours = 0` and `hours_updated_at = null` → Excel hours = `غير متوفر`.

## UI / API

Opportunity manage tab (تصدير تقييمات Excel):

- إنشاء ملف تقييم الطلاب / معاينة التصدير → summary then **تنزيل Excel**
- رفع قالب Excel (versioned on `host_organization.excel_evaluation_template`)
- بيانات الشركة + بيانات مشرف الشركة

Routes:

- `GET /:id/excel-evaluation/preview`
- `GET /:id/excel-evaluation/download`
- `POST /:id/excel-evaluation/template`

Security: Super Admin any university; University Admin own university; assigned instructor if current FT permissions allow; reviewer read/export on academic read routes; Institution denied (`requireOrganizationType('UNIVERSITY')` + evaluation access). Reviewer cannot upload templates (write route).

Export calculations **do not** write back to course/student grades. Audit: `FT_EXCEL_EVALUATION_EXPORTED`.

## Export tests

`backend/tests/fieldTrainingExcelEvaluation.unit.test.js` (7/7 pass):

| Case | Result |
|------|--------|
| NOT_ELIGIBLE → all 1–10 = 0, general = 0, real hours kept | PASS |
| ELIGIBLE high performer → evidence-based high scores, 7–9 only where no evidence | PASS |
| Same student/criterion fallback stable | PASS |
| Real supervisor rating not replaced by fallback | PASS |
| /100 = SUM / 90 × 100 | PASS |
| Unknown hours → `غير متوفر`, not 0 | PASS |
| Workbook: sheet name, 21 columns, RTL, duplicate problem-solving, stable fallback across two fills | PASS |

Live workbook: 13 rows, unique university numbers 13, status غير مؤهل, ratings 0, general 0, reasons present.

## Remaining missing data

- Company / supervisor defaults not saved on this opportunity (`host_organization` is null) → `غير متوفر` in columns 1–3; `missingData` preview count = 13
- Completed training hours not recorded (stored 0, never updated)
- `attendance_percentage` is null on all 13 approved applications
- Post-assessment missing for 3 of 13 students (surfaced in ineligibility reasons)
- No ELIGIBLE students on this opportunity today, so live 7–9 fallback is unused (covered by unit tests)
- Cancelled (6) and rejected (6) applications are not exported

## Suggested commit message

```
feat: auto-fill Tafila field training Excel evaluations from student performance
```
