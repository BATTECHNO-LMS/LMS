# BATTECHNO LMS — Field Training Automated Evaluation Reports

Official Field Training evaluation reports are generated **inside the existing Field Training workflow**. They are not a separate product module and are **not** certificates.

## Architecture

1. University (or assigned instructor) uploads a **private DOCX** template that already contains branding, logos, signature, and stamp.
2. Per-university **scoring policy** defines gates, weights, pass score, and attendance bands.
3. When training is ready to close, the LMS **batches** live Field Training records (applications, hours, attendance, tasks/submissions, pre/post assessments, supervisor ratings).
4. A persistent **`field_training_final_evaluations` snapshot** is stored (PASSED / FAILED / NOT_ELIGIBLE). Historical rows are never silently overwritten.
5. The DOCX is cloned and filled by XML placeholder replacement (images and stamps stay in the zip). A PDF is produced and stored privately.
6. Authorized users download individual PDFs or a **backend ZIP**.

Resolution order for templates:

`Opportunity override → University default → FIELD_TRAINING_EVALUATION_TEMPLATE_MISSING`

Missing templates never produce a fake official report.

## Models / migration

Additive migration: `backend/prisma/migrations/20260826160000_field_training_evaluation_reports/migration.sql`

- `users.university_student_number` (optional; **never** substitute the user UUID in filenames)
- `field_training_opportunities.evaluation_template_id`, `host_organization`
- `field_training_evaluation_templates` (versioned; replace archives V1 and inserts V2)
- `field_training_evaluation_policies` (versioned per university)
- `field_training_supervisor_ratings` (periodic 1–5 behavioral ratings)
- `field_training_final_evaluations` (snapshot + `pdf_file_id` / `filled_docx_file_id` + `template_version` / `policy_version` + `supersedes_evaluation_id`)

No drops, truncates, or `migrate reset`.

Files use the existing `files` table + storage providers (`training/` folder). `putObjectBuffer` was added to local and R2 providers.

## Role permissions

| Role | Templates / policy | Generate / regenerate | View / download / ZIP |
| --- | --- | --- | --- |
| Super Admin (`isGlobal`) | Any university | Yes | Yes |
| University Admin | Own university only | Yes | Yes |
| Instructor | Assigned opportunities only (upload/override; not university-wide default/policy) | Assigned opportunities | Assigned opportunities |
| Reviewer | No | No (403 `REPORT_READ_ONLY`) | Own university, existing finalized files only |
| Institution Admin / Trainer / Trainee | Deny | Deny | Deny |
| Student | No | No | Own finalized PDF only |

Missing `universityId` never implies global access. Cross-university ZIP is rejected if **any** selected row is out of scope.

## Template versioning

Replacing a template archives the previous row (`is_active=false`, `archived_at`) and creates a new version. Generated reports store `template_id` + `template_version`. Changing the university default later does not rewrite historical PDFs.

## Placeholders

Student, training, organization, result, professional scores, comments, supervision, plus `{{c1_1}}`…`{{c10_5}}` checkmark grid (`✓` in the scored cell). Null/undefined render blank.

Word run-splitting is repaired before replacement so `{{student_name}}` still matches when split across `<w:t>` nodes.

## Scoring policy and gates

Default weights: attendance 20 / tasks 20 / post-assessment 20 / professional 40 (must total 100% when enabled).

Gates (failed gate → `NOT_ELIGIBLE`, not `FAILED`):

- `REQUIRED_HOURS_NOT_COMPLETED`
- `MINIMUM_ATTENDANCE_NOT_ACHIEVED`
- `REQUIRED_SUBMISSION_MISSING` (approved/graded only; a raw upload is not enough when review is required)
- `POST_ASSESSMENT_NOT_COMPLETED`
- `PROFESSIONAL_EVALUATION_INCOMPLETE`

Eligible + score ≥ pass mark → `PASSED`. Eligible + score below pass mark → `FAILED`.

## 10 professional criteria (max 50)

Evidence-based. Behavioral items 3, 4, 6, 7, 8, 10 use **Supervisor Quick Ratings** (averaged). Missing required ratings do **not** default to 5/5.

## Final snapshot and PDF

Downloads stream the **stored** PDF. Regeneration creates version N+1 and keeps version N.

Filename: `{StudentName}_{UniversityNumber}_FieldTrainingEvaluation.pdf`

PDF conversion prefers LibreOffice (`soffice`) when installed so layout/stamp fidelity is highest. Otherwise Mammoth HTML + existing Chromium renderer is used (images still embed; complex Word layout may degrade).

## Reviewer ZIP

Backend `POST .../evaluation-reports/zip`:

- batch-authorizes every selected id
- fetches file metadata in one query
- streams PDF buffers in chunks of 15 into JSZip
- mixed statuses → `Passed/` `Failed/` `Not_Eligible/`
- headers report selected / included / missing / failed

## Performance

Generation batches students, applications, tasks, submissions, attendance, ratings, policies, and current evaluations. Template files are cached per unique template in a run. ZIP does not issue per-student Prisma queries.

## Tests

- `fieldTrainingEvaluation.scoring.unit.test.js`
- `fieldTrainingEvaluation.template.unit.test.js`
- `fieldTrainingEvaluation.access.unit.test.js`
- `frontend/tests/fieldTrainingEvaluation.ui.test.js`

## Limitations

- `university_student_number` is optional until populated; filename falls back to `NA` (never the UUID).
- Production Docker image may not include LibreOffice; stamp-accurate PDF conversion is best with `soffice` on the host.
- Reports are separate from completion certificates and completion letters.
- Reviewers cannot generate missing reports.
