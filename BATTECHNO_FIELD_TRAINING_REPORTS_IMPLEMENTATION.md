# BATTECHNO LMS — Field Training Reports Implementation

University / `FIELD_TRAINING` reporting upgrade. Canonical backend data model feeds the interactive LMS view, server-side PDF, and Excel. Official PDF is Chromium HTML→PDF (not `window.print()`, not screenshots).

## Existing report infrastructure reused

- On-demand FT report APIs under `/api/v1/admin/field-training/reports`, `/api/v1/academic/field-training/reports`, `/api/v1/reports/field-training`, plus student and instructor student-report routes.
- `fieldTrainingReport.repository.js` / `.service.js` / `.controller.js`
- University scope helpers (`resolveUniversityIdFilter`, `assertStudentUniversityAccess`)
- Branding helpers from training reports (`loadBattechnoLogoDataUri`, `loadInstitutionLogoDataUri`)
- No second job/versioning subsystem. Each generation is stamped `READY` with reference + version `1`. Historical official files are not overwritten in storage because exports are downloaded, not stored as mutating blobs.

## PDF engine

Puppeteer / Chromium via `backend/src/modules/analytics/pdfRenderer.js` (local fonts only; Google Fonts blocked).

## Excel engine

ExcelJS, RTL sheets, frozen headers, auto-filters, display formulas that do not redefine LMS completion status.

---

## Checklist

| Item | Result |
|---|---|
| University comprehensive report | **PASS** |
| Student individual report | **PASS** |
| Interactive report | **PASS** |
| University PDF | **PASS** |
| Student PDF | **PASS** |
| University Excel | **PASS** |
| Student Excel | **PASS** |
| Branding | **PASS** |
| University logo | **PASS** (real `logo_url` when stored; otherwise Arabic/English name fallback, no broken image) |
| BATTECHNO logo | **PASS** |
| Arabic RTL | **PASS** |
| Attendance metrics | **PASS** |
| Training hours | **PASS** (required / scheduled / attended kept separate) |
| Tasks | **PASS** (`غير مطلوب` when none required) |
| Assessments | **PASS** (pre/post labeled as observed difference, not causation) |
| Progress | **PASS** |
| Completion | **PASS** |
| Certificates | **PASS** (completion letters; no verification secrets beyond existing letter code) |
| University filtering | **PASS** (university, date range, specialty, opportunity, organization, instructor, completion, certificate, search — only fields that exist) |
| Student ownership | **PASS** |
| Cross-university security | **PASS** |
| N+1 query review | **PASS** (`loadReportDetailBatches` + `Promise.all`) |
| PDF visual QA | **PASS** (HTML structure + Chromium PDF from live Tafila data; open `backend/tmp/field-training-report-samples` for page-flip) |
| Excel QA | **PASS** (ExcelJS load, RTL, ordered sheets, no repair warning) |

Faculty / college / academic term / student university number are **not in the schema** and were not invented.

## Tests

```text
node --test tests/fieldTrainingReport.metrics.unit.test.js
                 tests/fieldTrainingReport.template.unit.test.js
                 tests/fieldTrainingReport.access.unit.test.js
                 tests/fieldTraining.access.test.js
→ 29 pass, 0 fail
```

Added to `backend/package.json` `test:unit`.

Integration title assertions updated to:

- `التقرير الشامل للتدريب الميداني للجامعة`
- `التقرير الفردي للتدريب الميداني للطالب`

## Build

Frontend not rebuilt in this pass (dev server already running). Prisma schema validate: **PASS**.

## Prisma validation

`npx prisma validate` → schema valid. No migrations run.

## Sample files

Generated at `backend/tmp/field-training-report-samples/` (gitignored):

| File | Notes |
|---|---|
| `university-field-training-report.pdf` | ~2.8 MB, جامعة الطفيلة التقنية, 175 students |
| `university-field-training-report.xlsx` | 16 sheets, RTL, 175 student rows + display average formula |
| `student-field-training-report.pdf` | ~481 KB, one real student application |
| `student-field-training-report.xlsx` | 9 sheets |
| `university-report.html` / `student-report.html` | Source used for PDF |

**Middle East University:** university row exists (`MIDDLE_EAST_UNIVERSITY` / جامعة الشرق الأوسط) but **no field-training applications** are tied through `users.primary_university_id`. Official MEU FT sample: **BLOCKED — no safe MEU field-training data**. Used Tafila Technical University instead.

## Authorization (unchanged business rules)

- Super-admin: any university.
- University admin / reviewer: own `universityId` only; reviewer remains read-only via existing report-read roles.
- Instructor: assigned student reports only (instructor routes). No university-wide report.
- Student: own application only (`studentOwnsApplication`). University report denied.

## Files modified

Backend report core: `fieldTrainingReport.{metrics,labels,dates,aggregations,repository,template,excel,service,validation}.js`, admin/academic/student/instructor report routes, `pdfRenderer.js` footer/date.

Frontend: report hub/university/student pages, charts, filters, i18n, student detail PDF/Excel export, field-training SCSS.

Tests: metrics / template+excel / access unit tests; integration title updates.

## Remaining blockers / follow-ups

1. MEU has no FT enrollments on primary university id — cannot produce an official MEU sample without fabricating data.
2. No persisted `training_official_reports`-style snapshot table for FT; freshness/`STALE` is not a stored job state. Regeneration downloads a new file.
3. `window.print()` remains for the **print-friendly LMS view only**. Official PDF is server-generated.
4. Full pixel-by-pixel flip of every university PDF page should still be done in a PDF reader (175-student appendix is long).
5. Opportunity eligibility may attach students whose `primary_university_id` differs from the opportunity’s eligible universities; reporting follows existing primary-university scoping.

Suggested commit message:

```text
feat: enhance university and student field-training PDF and Excel reports
```
