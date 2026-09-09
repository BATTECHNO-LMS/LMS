# BATTECHNO LMS — Mutah Field Training Final Evaluations

Implementation of official evaluation generation from the **admin-uploaded Mutah DOCX template**, with readiness preflight, partial batch success, and ZIP download grouped by University → Academic Supervisor → Eligibility.

This report does **not** mark visual PDF fidelity as complete. LibreOffice is not installed in this environment, so PDF page-count / pixel comparison is **BLOCKED**.

---

## Mutah opportunity detected

| Field | Value |
| --- | --- |
| University | جامعة مؤتة (`910ba424-10ec-44d2-8f7f-c68e7ea5e8cb`) |
| Opportunity | التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026 |
| Opportunity id | `6c8783ec-49fd-428e-83e2-8b65e52c3b4f` |
| Status | published |
| Period | 23 / 7 / 2026 → 5 / 9 / 2026 |
| `university_id` on opportunity | **null** (linked via opportunity eligibility) |
| Assigned template | `نموذج تقييم التدريب الميداني.docx` version **5** (`7f723b9e-8ad1-497d-b230-439a99913001`) |
| University default template | same filename, version **6**, `is_default: true` |
| Approved applications | **104** (not hardcoded; live count) |
| Eligible | **88** |
| Not eligible | **16** |
| Existing generated PDFs | **58** (previous pipeline) |
| Organization name | **null** |
| Host organization defaults | **null** |

Semester / academic year resolve from the opportunity start date: **الصيفي** / **2025-2026**.

---

## Template flow

1. Admin uploads DOCX on **Manage Opportunity → Evaluation Template** (or assigns the university default).
2. Template preflight checks: DOCX readable, evaluation grid, comments box, `اسم المسؤول`, `اسم المشرف الميداني`, embedded media (logo/stamp/signature), fonts.
3. **فحص جاهزية التقارير** builds one canonical payload per approved student.
4. **إصدار التقييمات الجاهزة** generates PDFs only for `READY` students. `MISSING_REQUIRED_DATA` is skipped with a named Arabic list. `NOT_ELIGIBLE` students with complete report fields **are generated**.
5. Preview and download use the **same stored PDF** (Reviewer: معاينة التقرير opens the download blob). Student preview can also render a PDF from the filled official template when LibreOffice is available.
6. **تنزيل جميع التقييمات** streams one ZIP of already-generated PDFs. It does not regenerate.

Template version is stored on each generated evaluation (`template_id`, `template_version`). Existing reports are not rewritten when a newer template is uploaded.

---

## Field mapping (canonical payload)

`buildFieldTrainingEvaluationTemplatePayload()` is the only mapper used by preview, readiness, generate, and regenerate.

| Template field | Source |
| --- | --- |
| اسم الطالب | Canonical student `full_name` |
| الرقم | Real `university_student_number` (never user/application id) |
| التخصص | Student university specialty (`name_ar`) |
| الفصل الدراسي / السنة الدراسية | Opportunity start-date academic period, overridable via host_organization |
| فترة التدريب من / إلى | Opportunity `start_date` / `end_date`, official `D / M / YYYY` |
| عدد الأيام التي تدربها الطالب | Attended session days |
| عدد الساعات اليومية (الفعلية)… | **Mutah: total `completed_training_hours`** (`trainingHoursDisplayMode = TOTAL_COMPLETED_HOURS`) |
| عدد أيام الغياب | Attendance rows with status `absent` |
| اسم الشركة / الفرع / البريد / الهاتف / الفاكس / العنوان | Application/opportunity org, then opportunity defaults. Optional org blanks stay blank |
| 10 criteria + ✓ | Evidence scores 1–5 in existing grid cells only |
| المجموع | Sum of 10 criteria, max 50, written into existing `المجموع:` cell |
| ملاحظات | Deterministic Arabic from eligibility + scores (not free-form AI) |
| اسم المشرف الميداني | Host org `field_supervisor_name` or `contact_person` — **not** academic supervisor |
| اسم المسؤول | `academic_supervisor_name` (Excel text, no LMS account) |
| التاريخ (field / academic) | `field_supervisor_date` / `academic_supervisor_date` (currently both = evaluation date) |

---

## Required vs optional

**Required before PDF:** student name, university number, specialty, semester, academic year, training dates, training days, hours display, absence days, organization name, field supervisor, academic supervisor / اسم المسؤول, evaluation date, all 10 criterion scores, professional total, general comments.

**Optional (blank allowed):** organization department, email, phone, fax, address.

**Not missing data:** attendance below minimum, hours incomplete, tasks incomplete, post-assessment missing. Those are `NOT_ELIGIBLE` reasons and still produce a report when identity/ratings/org fields are present.

---

## Readiness engine

`GET /:id/evaluation-reports/readiness`

Counts: total, ready, missing data, eligible, not eligible, generated, not generated, generation failed.

Missing fields are structured codes (`STUDENT_SPECIALTY_MISSING`, `PROFESSIONAL_RATING_TEAMWORK_MISSING`, …) with Arabic labels on the frontend.

Partial batch: generate ready students; skip missing-data students; return `total / ready / generated / alreadyGenerated / missingData / failed`.

Idempotent: same student + same snapshot hash + same template version → `ALREADY_GENERATED`.

---

## Eligibility

Consumed from the existing Field Training engine (`completion_eligibility_status` + `eligibility_reason`).

Missing professional ratings are **not** converted into `NOT_ELIGIBLE`.

`buildFieldTrainingEligibilityReasons()` produces Arabic lines such as:

- لم يحقق الطالب الحد الأدنى المطلوب للحضور (72% من أصل 80%).
- استكمل الطالب 118 ساعة من أصل 140 ساعة مطلوبة.
- لم يستكمل الطالب 2 من المهام المطلوبة.
- لم يستكمل الطالب التقييم البعدي.

---

## 10 criterion evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | الكفاءة في إنجاز العمل | Tasks + post-assessment mapping |
| 2 | مراعاة الدقة | Task scores, rejected submissions |
| 3 | التفكير وطرح الأسئلة | Supervisor rating `thinking_and_initiative` |
| 4 | حل المشكلات | Supervisor rating `problem_solving` |
| 5 | الالتزام بالدوام | Attendance band |
| 6 | العلاقات مع الزملاء | Supervisor rating `teamwork` |
| 7 | المظهر واللياقة | Supervisor rating `professional_conduct` |
| 8 | التعاون مع المشرف الميداني | Supervisor rating `supervisor_cooperation` |
| 9 | إتمام التدريبات | Task completion |
| 10 | الالتزام بالقواعد | Supervisor rating `rules_compliance` |

Behavioral ratings are **not fabricated**. Missing ratings block generation until an authorized user saves 1–5 via **استكمال بيانات التقييم الناقصة** (`source = MANUAL_AUTHORIZED_EVALUATION`, audited). Reviewer cannot edit.

---

## Eligible / not-eligible reports

- Eligible comments start with `حالة الطالب: مؤهل` plus a concise performance sentence derived from actual scores.
- Not-eligible comments start with `حالة الطالب: غير مؤهل` and `أسباب عدم التأهيل:` plus engine reasons. Never a bare `غير مؤهل`.

---

## PDF generation

- Fill the uploaded DOCX in place (tables, MERGEFIELD strip, checkmarks, dates). Logo, stamp, and signature images are left untouched.
- Convert with **LibreOffice only**. No mammoth/HTML fallback.
- Isolated temp dirs and cloned payload/template buffers per student.
- Filename: `{StudentName}_{UniversityNumber}_تقييم_التدريب_الميداني.pdf`

If a required template font is missing: `TEMPLATE_FONT_UNAVAILABLE` with the font name. No silent substitution.

---

## ZIP hierarchy

```
جامعة مؤتة/
  زكريا الطراونه/
    مؤهل/
    غير مؤهل/
  مشرف غير محدد/
    مؤهل/
    غير مؤهل/
```

Supervisor folders use exact `academic_supervisor_name` (no surname fuzzy match).

ZIP name: `جامعة_مؤتة_تقارير_تقييم_التدريب_الميداني_2025-2026.zip`

Download includes existing PDFs only. Zero reports → `لا توجد تقارير تقييم جاهزة للتنزيل.`

---

## Authorization

| Role | Generate / template / ratings / defaults | View / preview / ZIP |
| --- | --- | --- |
| Super Admin | yes | yes |
| University Admin (own university) | yes | yes |
| Assigned instructor | yes | yes |
| Reviewer | **read-only** | yes |
| Institution roles | deny | deny |
| Academic supervisor LMS account | **not required** | — |

---

## Tests

- Eligible mapping, 40/50 total, hours = 140 (not hours/day)
- Academic supervisor → اسم المسؤول; field supervisor separate
- Missing specialty / missing teamwork rating → `MISSING_REQUIRED_DATA`, no fabricated score
- Not-eligible reasons in comments; PDF still generated in mapping tests
- Official DOCX fill: 10 checkmarks, stamp/signature media, no MERGEFIELD leftovers
- ZIP: جامعة مؤتة / exact supervisor folders / مؤهل / غير مؤهل / UTF-8 Arabic names
- Cross-student isolation on filled DOCX
- Access: reviewer read-only, university isolation
- Official 2-page PDF conversion: **skipped** (LibreOffice absent)

---

## TEMPLATE FIDELITY VERIFICATION

Source template: `backend/assets/field-training/mutah-official-evaluation.docx` (opportunity currently assigned version **5** of the uploaded `نموذج تقييم التدريب الميداني.docx`; university default is version **6**)

Template version stored on generated rows: `template_id` + `template_version`

Original page count: **2**

Generated page count: **not measured in this environment** (LibreOffice missing)

| Check | Result |
| --- | --- |
| Uploaded template reused directly | PASS (DOCX fill, no HTML redesign) |
| No report redesign | PASS |
| Logo preserved | PASS (DOCX media kept; PDF visual unverified) |
| Fonts preserved | PASS at DOCX level; runtime PDF fonts **unverified** |
| Tables preserved | PASS (structure fill) |
| Evaluation grid preserved | PASS (checkmarks only in existing 1–5 cells) |
| Signature preserved | PASS (embedded media + labels) |
| Stamp preserved | PASS (embedded media + `الختم الرسمي`) |
| Academic supervisor → اسم المسؤول | PASS |
| Academic supervisor date | PASS (existing date cell) |
| Field supervisor separate | PASS |
| Reviewer uses same artifact | PASS (preview opens download PDF blob) |
| Visual comparison | **BLOCKED** |
| Extra page | **BLOCKED** (PDF page count not run) |

Any visual difference: cannot compare raster PDF against the blank template here. DOCX text inspection shows only dynamic values added (name, number, specialty, hours, scores, comments, dates).

---

## Visual QA

`VISUAL_QA_BLOCKED` — LibreOffice (`soffice`) is not installed on this machine. The official two-page PDF test was skipped. Do not treat PDF layout as accepted until one eligible and one not-eligible PDF are opened on a host with LibreOffice.

---

## Remaining blockers (must fix in LMS data today)

The generator is implemented. **Live Mutah reports cannot all be issued until the data below is completed.** No production rows were mutated in this task.

### Opportunity-level (blocks every student)

| Student Name | University Number | Missing Field | Current Value | Required Action |
| --- | --- | --- | --- | --- |
| All 104 approved students | — | اسم الشركة أو المؤسسة | null | Save opportunity report defaults on Evaluation Template |
| All 104 approved students | — | اسم المشرف الميداني | null | Set `field_supervisor_name` in opportunity defaults |
| All 104 approved students | — | Host org contact fields | null | Fill department / email / phone / fax / address as applicable (fax may stay blank) |

Until those defaults exist, readiness will treat organization name and field supervisor as missing for every student.

### Academic supervisor unassigned (Excel)

| Student Name | University Number | Missing Field | Current Value | Required Action |
| --- | --- | --- | --- | --- |
| Malak ksasbeh | 120252222134 | المشرف الأكاديمي / اسم المسؤول | empty | Assign supervisor in Excel import |
| BATUNI Student | *(empty)* | الرقم الجامعي + المشرف الأكاديمي | empty | Test account: set university number or remove from opportunity |
| ابرار عواد علي الحباشنه | 120252222116 | المشرف الأكاديمي / اسم المسؤول | empty | Assign supervisor in Excel import |
| Noor Talal Ziad ALNawaiseh | 120252222154 | المشرف الأكاديمي / اسم المسؤول | empty | Assign supervisor in Excel import |
| زيد احمد الشيب | 120212212023 | المشرف الأكاديمي / اسم المسؤول | empty | Assign supervisor in Excel import |
| ينال محمد ياسين مامكغ | 120232222041 | المشرف الأكاديمي / اسم المسؤول | empty | Assign supervisor in Excel import |

### Professional ratings

| Student Name | University Number | Missing Field | Current Value | Required Action |
| --- | --- | --- | --- | --- |
| **97 of 104** approved students | (see readiness modal) | تقييم التفكير / حل المشكلات / الزملاء / المظهر / التعاون مع المشرف / قواعد المؤسسة | no supervisor rating row | Authorized Admin/Instructor: **استكمال بيانات التقييم الناقصة** (1–5). Reviewer cannot enter scores. |

Only **7** students currently have supervisor rating rows. After org defaults are saved, those 7 can generate if academic supervisor and identity are complete.

### Already generated files

58 PDFs exist from the previous pipeline. After org defaults and ratings are saved, use generate (idempotent) / authorized regenerate so new files use the official mapping (academic supervisor → اسم المسؤول, hours = total 140, eligibility comments).

---

## Suggested commit message

```
feat: generate complete Mutah field training evaluations with readiness validation
```

(Also applicable: `fix: preserve exact university evaluation templates during report generation`)
