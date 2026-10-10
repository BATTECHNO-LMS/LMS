# EPROJECTO Field Training Bulk Student Reports Export

## Eligibility page location

Admin / Instructor Field Training manage hub:

```text
/admin/field-training/:id/manage?tab=eligibility
/instructor/field-training/:id/manage?tab=eligibility
```

Component: `frontend/src/pages/admin/fieldTraining/components/manage/ManageEligibilityTab.jsx`

## Button added

Label:

```text
تصدير جميع تقارير الطلاب
```

Icon: `FileArchive` (lucide-react). Placed in the eligibility panel header actions.

## Roles allowed

Same staff gate as the existing comprehensive student report:

- Admin FT portal: `FIELD_TRAINING_ADMIN_ROLE_CODES` / `FIELD_TRAINING_MANAGE_ROLE_CODES` + `UNIVERSITY` organization (`adminFieldTraining.routes.js`)
- Instructor portal: assigned instructor routes (`instructorFieldTraining.routes.js`)
- Backend also calls `assertManageOpportunityAccess` for opportunity/university isolation

Students cannot call these routes. Institution portals remain blocked by `requireOrganizationType('UNIVERSITY')`. Reviewer bulk privilege was not expanded.

## Filters honored

Backend authoritative filters (request body, not client student IDs):

- `eligibility_status`
- `training_status`
- `search` (name / university number / email / university)

Pagination is not a filter. The eligibility UI adds search + eligibility filters for display and passes the same values to preview/start. Matching count comes from the backend preview.

## Report type reused

Comprehensive student report — the same report linked from each eligibility card (`comprehensiveReport` / `.../comprehensive-report/pdf`).

## Canonical report generator

`fieldTraining.comprehensiveReport.service.exportComprehensiveStudentReportPdf`

Bulk export calls this generator per matching student. No second layout was created.

## Canonical result source

Unchanged inside the comprehensive report pipeline:

`resolveFieldTrainingApprovedResult` / `toPublicQualificationFromOfficial`

Historical approved results are not recalculated by the bulk export layer.

## API endpoints

Admin and instructor:

```text
POST /:id/reports/students/bulk-export/preview
POST /:id/reports/students/bulk-export
GET  /:id/reports/students/bulk-export/jobs/:jobId
GET  /:id/reports/students/bulk-export/jobs/:jobId/download
```

Request body:

```json
{
  "eligibility_status": "ineligible",
  "training_status": "",
  "search": "",
  "sync": false
}
```

## Sync vs async architecture

Async by default (completion-letter style):

1. Preview for confirmation count
2. Start job (`queued` → `processing` → `ready` / `failed`)
3. Poll job status
4. Download ZIP when ready

`sync: true` is available for tests.

Job state is in-memory + meta under:

```text
{UPLOAD_DIR}/ft-student-report-exports/{jobId}/
  meta.json
  result.zip
```

Jobs expire after `FT_STUDENT_REPORT_BULK_TTL_MS` (default 6h). One active job per user+opportunity.

## ZIP library / streaming strategy

Existing `jszip`. PDFs are generated with bounded concurrency, appended to the archive, then the archive is written through `generateNodeStream` + `pipeline` to disk.

## Concurrency

`FT_STUDENT_REPORT_BULK_CONCURRENCY` (default **3**, clamped 1–5).

## Memory strategy

- Shared opportunity sessions/tasks/logo loaded once per job
- Opportunity access asserted once
- PDF concurrency capped
- ZIP streamed to disk rather than returned as one huge controller buffer source of truth

JSZip still buffers archive entries until generate (documented limitation). Safe for normal FT cohorts; hard max `FT_STUDENT_REPORT_BULK_MAX` (default 500).

## File naming

ZIP:

```text
eprojecto-field-training-student-reports-<opportunity>-<date>.zip
```

PDF entries:

```text
001-<student-name>-<university-number>.pdf
```

Unsafe filesystem characters stripped. Duplicate names get `-2`, `-3`, … Path traversal segments are removed.

## Security

- Auth + university/instructor opportunity access
- Backend resolves matching population (no student ID list from client)
- Download requires job ownership (or system-wide admin)
- `Cache-Control: private, no-store`
- `Content-Disposition: attachment`
- ZIP artifacts are not world-readable URLs

## Temporary file lifecycle

Artifacts live under the uploads export directory and expire by job TTL. Failed/empty jobs do not expose a download.

## Audit event

One event per completed export attempt:

```text
FIELD_TRAINING_STUDENT_REPORTS_BULK_EXPORTED
```

Metadata: opportunity, matching/included/failed counts, filters, filename. No PDF bodies.

## Failure policy

Partial success is allowed (consistent with other FT ZIP exports):

- Successful PDFs are included
- Failures are listed in `EXPORT_ERRORS.txt`
- Job still reaches `ready` if at least one PDF succeeded
- Job `failed` if zero PDFs succeeded

## Large cohort test

Unit coverage validates:

- filter semantics for full matching sets (not page rows)
- bounded concurrency ZIP packing
- university isolation / empty export / job ownership

Full puppeteer timing for 150+ live PDFs was not run in this session (requires production-like DB + Chromium load). Architecture mirrors the completion-letter batch size approach.

## PDF count / authorization tests

`backend/tests/fieldTraining.studentReportsBulk.unit.test.js`

Frontend wiring:

`frontend/tests/fieldTraining.eligibilityBulkStudentReports.ui.test.js`

## Frontend build

Validated via `npm run build` in the frontend package after implementation.

## Known limitations

1. Jobs are process-local (restart clears in-memory map; ZIP files may remain until TTL cleanup).
2. JSZip keeps entry buffers until archive generation completes.
3. Eligibility page previously had no filters; search + eligibility were added for export intent and list consistency.
4. No production deployment in this task.

## Production deployment performed

NO
