# BATTECHNO LMS — Field Training Reporting + Export (Final)

**University:** جامعة الطفيلة التقنية  
**Online opportunity:** `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`  
**Expected:** 151 students · 146 ELIGIBLE · 5 NOT_ELIGIBLE

## Principle

Reports and Excel **do not recalculate scores**.  
They consume the stored canonical approved result (`approvedEvaluationResult`) via the cohort report dataset.

Task counts such as `2/4` come from **LMS submissions only** (batched query).

## Routes

Admin / Instructor (same shapes):

| Method | Path | Purpose |
|---|---|---|
| GET | `/:id/reports/validation` | Pre-export validation |
| GET | `/:id/reports/final` | Final report JSON (preview) |
| GET | `/:id/reports/final/pdf` | Official final PDF |
| GET | `/:id/reports/comprehensive` | Comprehensive JSON |
| GET | `/:id/reports/comprehensive/pdf` | Comprehensive PDF |
| GET | `/:id/reports/export/excel` | Official Excel (151 rows) |

Student comprehensive (existing):

| GET | `/:id/applications/:applicationId/comprehensive-report` |
| GET | `/:id/applications/:applicationId/comprehensive-report/pdf` |

## Backend services

- `fieldTraining.cohortReports.service.js`
  - `loadApprovedStudentRows` (+ LMS task counts)
  - `validateOpportunityReport` / `validateOpportunityReportDataset`
  - `buildOpportunityFinalReport`
  - `buildOpportunityComprehensiveReport`
  - `exportOpportunityFinalReportPdf`
  - `exportOpportunityComprehensiveReportPdf`
  - `exportOpportunityOfficialExcel`
- Canonical overlay remains in `fieldTraining.tafilaApprovedResult.service.js`
- PDF engine: `analytics/pdfRenderer.js` (`renderHtmlToPdf`)

## Validation gates

Official PDF/Excel refuse export unless:

- students = 151 (primary online only)
- eligible = 146 / notEligible = 5
- eligible &lt; 80 = 0
- eligible null = 0
- score sum mismatch = 0
- stale eligible failure reasons = 0
- duplicate university numbers = 0
- opportunity mismatch = 0

UI shows **جاهز للإصدار** or lists issues.

## UI

Manage → Reports tab (`ManageReportsTab`):

- Opportunity summary cards
- Validation status
- Actions: معاينة · إصدار النهائي · تنزيل Excel · التقرير الشامل

## Excel

Primary sheet columns (Arabic, RTL, freeze, filter):

`# … مصدر_النتيجة` as specified in the product brief.

Audit sheet: `بيانات_التدقيق` (application/opportunity/source/timestamps).

## Opportunity separation

Second Tafila opportunity `01666ebc-…` is **never** mixed into the online export unless selected alone.

## Tests

`backend/tests/fieldTraining.cohortReports.unit.test.js`

## Suggested commit

```
feat: add unified field training final comprehensive reports and Excel export
```
