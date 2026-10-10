# EPROJECTO — Course Assignment Submission Upgrade

Universal file uploads, archives, multi-file submissions, premium RTL UI, and the production rollout.

Status: **Deployed to production** (`/root/BATTECHNO_LMS`, https://eprojecto.com) on 2026-10-06 10:47 UTC.

---

## 1. Root causes (before this change)

| # | Problem | Where |
|---|---------|-------|
| 1 | The student task form used `accept="application/pdf,.doc,.docx,.ppt,.pptx,image/*,.zip"`. However, `validateFileForUpload` compared the browser MIME **literally** against that list. As a result, DOCX (`application/vnd…wordprocessingml.document`), PNG (`image/png` ≠ `image/*`), XLSX, MP4, etc. were rejected **before any request was sent**. In practice only PDF worked. | `frontend/src/features/uploads/uploadRules.js`, `TraineeCourseDetailPage.jsx` |
| 2 | Only **one file per submission** was possible: a single `content_url` column and no attachment table. | `training_task_submissions` |
| 3 | The generic `/files/upload` used a MIME allowlist. Unknown extensions with unusual MIME types (e.g. `.kml`, many design formats) were rejected. Some archive MIMEs from Windows (`application/x-compressed`) only passed by fallback. | `files.upload.js`, `fileRules.js` |
| 4 | **Instructors could not open student files.** `/files/:id` only allowed the creator. There was no submission-file download endpoint, and `getSubmissionFileUrl` was never routed. | `files.service.js` `canAccessFile`, `trainingTaskWorkflow.service.js` |
| 5 | **There was no review UI for course task submissions.** `CourseTasksManager` received `canGrade` but ignored it. It also called `getApiErrorMessage` without importing it (latent `ReferenceError` on any save error). | `CourseTasksManager.jsx` |
| 6 | Multer 1.x / busboy decodes multipart filenames as latin1, so **Arabic filenames were stored garbled**. | `multer@1.4.5-lts.2` |
| 7 | 100 MB uploads were buffered fully in memory (`memoryStorage`). | `files.upload.js` |

## 2. Design

### Upload flow (atomic, no orphans)
1. The student selects or drops files. Each file is uploaded as a **draft** via `POST /api/v1/training/tasks/:taskId/submission-files` (one file per request, real XHR progress).
   - The server checks enrollment (ACTIVE/APPROVED, same org/program/cohort), that the task is published, the deadline, remaining attempts, and the per-task draft count.
   - Multer writes to a temporary file on disk. The file is streamed to storage (R2 `PutObject` with a stream, or a local copy), and then the temporary file is always deleted.
   - A `files` row is created with `related_entity_type = 'training_task_submission_draft'`, `related_entity_id = taskId`, `visibility = private`. If the DB insert fails, the stored object is deleted.
2. The student removes a file with `DELETE …/submission-files/:fileId`, which deletes the object and soft-deletes the row. Drafts survive a page reload: `GET …/submission-files` restores them in the UI.
3. Confirmation step → `POST /api/v1/training/tasks/:taskId/submissions` `{ content_text, file_ids[] }`:
   - The server verifies that every id is the requester's live draft for this task, that count and total limits hold, and that **every object exists in storage** (`headObject`). It then, in **one Prisma transaction**:
     - creates the submission;
     - claims the drafts with a conditional `updateMany` (count must match, or the transaction rolls back);
     - inserts the `training_task_submission_files` rows.
   - The submission is never marked submitted unless all files are persisted.
   - An audit record `TRAINING_TASK_SUBMITTED` is written (file count and total bytes; no content).
   - Stale drafts (>24h) for the user are cleaned up opportunistically, on a best-effort basis.
4. Status, deadline, attempts and resubmission policy are unchanged: `canSubmitTask`, `grading_mode NONE → ACCEPTED`, `TASK_SUBMITTED` event, progress recompute.
   - New rule: a submission must contain text **or** at least one file (previously empty submissions were possible).

### Downloads
- `GET /api/v1/training/task-submissions/:submissionId/files/:fileId/download`
- `GET /api/v1/training/task-submissions/:submissionId/legacy-file/download` (old `content_url` submissions; external URLs are returned as JSON for the client to open)
- Access is limited to the **owner**, or staff passing `requireStaffTaskAccess(..., 'can_grade_tasks')`. Staff means: org admin, instructor or trainer in the same organization, trainers only when assigned with the grade permission, and system admins. Reviewers are read-only and excluded, as with grading.
- Files are streamed through the API (same-origin, so R2 CORS is not involved) with these headers:
  - `Content-Disposition: attachment; filename="ascii"; filename*=UTF-8''…`
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy: default-src 'none'; sandbox`
  - `Cache-Control: private, no-store`
- HTML, SVG, XML, JS and all `text/*` types are served as `application/octet-stream`. Nothing is rendered inline, nothing is executed, and archives are **never extracted**.
- The frontend downloads via `apiClient` blob requests (Bearer token). There are no raw URLs and no token in query strings.

### File-type policy
- **Accepted:** any type, including documents, spreadsheets, presentations, PDF, images, audio, video, code, text, design files (`.psd`, `.ai`, `.fig`, `.sketch`, `.dwg`, …), archives (`.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.tgz`) and unknown extensions (stored as `application/octet-stream`).
- **Blocked (existing security policy preserved):** executables and installers: `.exe .bat .cmd .com .msi .scr .pif .dll .sys .vbs .vbe .wsf .wsh .ps1 .psm1 .psd1 .reg .inf .lnk .jar .apk .app .dmg .iso`. This includes double extensions (`report.pdf.exe`) and trailing-dot tricks (`x.exe.`).
- Empty files are rejected.

### Filenames
- The original name is kept as metadata (`original_name`). It is decoded from latin1 to UTF-8, path components and control characters are stripped, Windows-reserved characters are replaced, and it is truncated to 255 characters while preserving the extension.
- Storage keys are collision-safe: `uploads/training/YYYY/MM/<uuid>-<sanitized>`. They are never returned to clients.

## 3. Limits (central, consistent)

| Limit | Value | Enforced in |
|-------|-------|-------------|
| Files per submission | 10 | backend `taskSubmissionFileRules.js` (draft count + submit), frontend `taskSubmissionLimits.js` |
| Per-file size | 100 MB | multer `limits.fileSize` (→ 413 Arabic), service validation, frontend precheck |
| Total per submission | 250 MB | submit-time validation, frontend queue |
| Request body (Nginx) | 120 MB | host `/etc/nginx/sites-enabled/eprojecto.com` + `frontend/nginx.conf`. **Unchanged**: one file per request, so 120m > 100 MB per file. No `nginx -t`/reload needed. |
| Upload rate | 120 requests / 15 min / user | dedicated limiter on the draft upload route |

The server sends `submissionLimits` with each trainee task. The frontend uses those values and falls back to its mirrored defaults.

## 4. Error handling (Arabic, no internal leaks)
All upload, submit and download errors map to fixed Arabic messages with stable codes:
`FILE_TYPE_BLOCKED`, `FILE_EMPTY`, `FILE_TOO_LARGE` (413), `TOO_MANY_FILES`, `TOTAL_SIZE_EXCEEDED`, `FILE_NOT_AVAILABLE`, `STORAGE_ERROR` (503), `UPLOAD_FAILED`, `SUBMISSION_EMPTY`, `TASK_NOT_AVAILABLE`, `NOT_ENROLLED`.

Multer, Prisma and S3 error messages are logged server-side only (`log('warn', …)`, without secrets). They are never returned to the client.

## 5. UI (premium RTL, ivory / navy / gold)
- **`AssignmentSubmissionForm`** (trainee):
  - Drag-and-drop zone with a gold dashed border; navy "choose files" button; keyboard accessible.
  - Multi-select with **no `accept` restriction**.
  - Per-file row with a type icon (PDF, doc, sheet, slides, image, video, audio, archive, code, design, other), LTR-isolated size, real progress bar (`role="progressbar"`), status, remove, and retry. Blocked or oversized files cannot be retried.
  - Duplicate detection; up to two parallel uploads; summary of count and total versus limits.
  - Optional comment.
  - **Confirmation step**: files, total size, deadline, remaining attempts, comment preview. Submitting is disabled while uploads are running or any file has failed.
- **`SubmissionFileList`**: the submitted files with sizes and secure download buttons. Archives are labelled "ملف مضغوط (لا يُفك تلقائياً)" (compressed file, not extracted automatically). Legacy single-file submissions get a download row.
- **`TaskSubmissionsReviewPanel`** (trainer/admin, inside `CourseTasksManager` → "عرض التسليمات" (show submissions)):
  - Per submission: trainee name and email, attempt, status chip, date, file count and total size, text, file downloads.
  - Score and feedback, "حفظ التقييم" (save grade) and "طلب تعديل" (request revision).
- **Responsive:** verified at 375, 430, 768 and 1440 px.
  - No horizontal overflow.
  - Long Arabic and Latin names are truncated with an ellipsis, with the full name in `title`.
  - Buttons go full-width on phones.
  - Reduced-motion is respected.
- The shared accept-matching bug was fixed for **all** uploaders (`matchesAcceptList`: exact MIME, `type/*`, `.ext`). The instructor task-attachment uploader no longer restricts types.

## 6. Database (additive only)
Migration `20261006120000_training_task_submission_files`:
- `CREATE TABLE training_task_submission_files`:
  - columns: `id`, `submission_id` FK → `training_task_submissions` ON DELETE CASCADE, `file_id`, `storage_key`, `original_name`, `mime_type`, `size`, `sort_order`, `is_archive`, `created_at`;
  - two indexes.
- No ALTER, DROP or TRUNCATE on existing tables. Legacy `content_url` submissions keep working (download via the legacy endpoint).
- Applied by `prisma migrate deploy` at container start (`scripts/start-production.js`). Production status: 61 migrations, up to date.

## 7. Files

**Backend (new)**
- `backend/prisma/migrations/20261006120000_training_task_submission_files/migration.sql`
- `backend/src/modules/trainingPrograms/taskSubmissionFileRules.js`: central limits, validation, name decoding and normalization, safe headers
- `backend/src/modules/trainingPrograms/taskSubmissionFiles.service.js`: draft upload, list, delete, atomic attach, stale cleanup, authorized download
- `backend/src/modules/trainingPrograms/taskSubmissionFiles.controller.js`
- `backend/src/modules/trainingPrograms/taskSubmissionFiles.upload.js`: multer to a temporary file on disk, with Arabic error mapping
- `backend/tests/trainingTaskSubmissionFiles.unit.test.js`

**Backend (modified)**
- `backend/prisma/schema.prisma`: new model and relation
- `backend/src/modules/trainingPrograms/trainingTaskWorkflow.service.js`:
  - `submitTask` with `file_ids` in a transaction, plus audit;
  - attachments in all submission payloads;
  - trainee names in the staff list;
  - `submissionLimits`; helper exports.
- `backend/src/modules/trainingPrograms/trainingPrograms.routes.js`: five routes plus the upload limiter
- `backend/src/modules/trainingPrograms/trainingPrograms.validation.js`: param schemas
- `backend/src/shared/storage/providers/local.provider.js`, `r2.provider.js`: `getObjectStream`, `putObjectFile`
- `backend/tests/baselineManifest.test.js`: pending-after-cutoff list (also adds the previously missing `…watch_progress`)
- `backend/package.json`: test registration only (not deployed)

**Frontend (new)**
- `frontend/src/features/training/taskSubmissionLimits.js`
- `frontend/src/features/training/taskSubmissions.service.js`
- `frontend/src/features/training/components/taskSubmission/AssignmentSubmissionForm.jsx`
- `frontend/src/features/training/components/taskSubmission/SubmissionFileList.jsx`
- `frontend/src/features/training/components/taskSubmission/SubmissionFileIcon.jsx`
- `frontend/src/features/training/components/taskSubmission/FileSize.jsx`
- `frontend/src/features/training/components/taskSubmission/TaskSubmissionsReviewPanel.jsx`
- `frontend/src/assets/styles/components/_task-submission.scss`
- `frontend/tests/training.taskSubmissionUpload.ui.test.js`

**Frontend (modified)**
- `frontend/src/pages/trainee/TraineeCourseDetailPage.jsx`: new form and file list; the single uploader was removed
- `frontend/src/features/training/components/CourseTasksManager.jsx`: review panel, missing import fixed, attachment `accept` removed
- `frontend/src/features/uploads/uploadRules.js`: `matchesAcceptList`
- `frontend/src/assets/styles/app.scss`: `@use './components/task-submission';`
- `frontend/package.json`: test registration only (not deployed)

## 8. Tests & builds
- `npx prisma validate` passes. `npx prisma generate` succeeded.
- Backend new suite: **33/33 pass**. It covers:
  - type policy, blocked executables, double extensions, empty and oversized files;
  - count and total limits; Arabic latin1 recovery; name normalization;
  - safe Content-Type and Disposition;
  - draft upload: blocked or oversized rejected before storage, temporary file removed, enrollment, deadline, draft limit;
  - storage error with no leak, DB failure with object deleted, collision-safe key;
  - submit: empty rejected, a missing or foreign file means no transaction, concurrent claim rolls back, create→claim→attach in one transaction;
  - access: another student gets 403, owner OK, legacy key normalization including traversal;
  - streamed download headers;
  - all five routes return 401 without auth.
- Backend full `npm run test:unit`: **1182 pass, 1 fail.** The failure is pre-existing and unrelated: `fieldTraining.completionLetters.supervisorExcel` PDF Arabic glyph extraction, in code not touched here.
- Frontend new suite: **14/14 pass** (limits, kinds, accept matching including the DOCX/PNG regression, UI wiring, blob downloads, no raw URLs).
- Frontend full `npm run test:unit`: **157/158**. The 1 failure is pre-existing in `fieldTrainingEvaluation.ui.test.js` (native file chooser assertion on an untouched page).
- `npm run build` (frontend) passes. The production Docker build of both images passes.
- Visual check: an isolated preview harness at 375, 430, 768 and 1440 px was used, then removed.

## 9. Production deployment
- **Pre-check:**
  - host `srv1829646`; repo `main @ eda9923`; disk 8% used; both containers healthy;
  - `STORAGE_BACKEND=r2`; DB Neon; `migrate status` up to date (60);
  - Nginx `client_max_body_size 120m` (both layers).
- **Server working tree:** the server carries uncommitted files from earlier SFTP deploys, which is expected. Before uploading, every touched file was hash-compared: the server copy equals local `HEAD`, so only this feature's diff was applied.
  - `app.scss` was **not** overwritten, because the local copy carries the undeployed premium-redesign changes. Only the single `@use` line was inserted on the server.
  - No `git pull`, `reset`, commit or push on the server.
- **Backup:** `/root/deployment-backups/course-task-submissions-20261006-104402/`. It contains:
  - `files/` (previous versions of all overwritten files plus `app.scss`), `new-files.txt`;
  - `git-status-before.txt`, `git-head.txt`, `docker-compose.yml`, `nginx-eprojecto.com.conf`;
  - `migrate-status-before.txt`, `build.log`.
- **Image tags:** `battechno_lms-backend:pre-task-submissions-20261006-104402` and `battechno_lms-frontend:pre-task-submissions-20261006-104402`.
- **Build and start:** `docker compose build backend frontend` passed, then `docker compose up -d backend frontend`. The backend was healthy within ~15 s and the frontend was healthy.
- **Migration:** `20261006120000_training_task_submission_files` was applied. Status: 61 migrations, up to date. The new table is queryable (0 rows).
- **Smoke:**
  - `/health` 200; `https://eprojecto.com` 200;
  - all five new endpoints return 401 unauthenticated; the existing `GET /training/tasks/:id` returns 401;
  - the new JS and CSS are in the bundle.
- **Logs:** no backend errors since restart, and no 413 or "client intended to send too large" entries.
- **Nginx:** no change needed (no `nginx -t` or reload performed).
- **Not done on production (by design):** no authenticated end-to-end submission was performed, to avoid using or creating real student work. Manual checklist for a test trainee account:
  1. Upload a PDF, DOCX, XLSX, PNG, MP4, ZIP and RAR, plus a file with an Arabic name. Each should show progress and reach "تم الرفع" (uploaded).
  2. `setup.exe` should give the Arabic security error. An 11th file should give the limit notice.
  3. Remove one file, reload the page; the remaining drafts should be restored.
  4. Review the confirmation step and submit. The success message should show the file count.
  5. As the trainer/admin, open the course → tasks → "عرض التسليمات". All files should be listed with sizes, downloads should save with the original names, and grading should work.

## 10. Rollback
```bash
cd /root/BATTECHNO_LMS
B=/root/deployment-backups/course-task-submissions-20261006-104402
# 1) Restore previous source files
for bf in "$B"/files/*; do rel=$(basename "$bf" | sed 's#__#/#g'); cp -p "$bf" "$rel"; done
grep -v '^backend/prisma/migrations/' "$B/new-files.txt" | while read -r nf; do rm -f "$nf"; done
# 2) Restore previous images and restart (no rebuild needed)
docker tag battechno_lms-backend:pre-task-submissions-20261006-104402 battechno_lms-backend:latest
docker tag battechno_lms-frontend:pre-task-submissions-20261006-104402 battechno_lms-frontend:latest
docker compose up -d --no-build backend frontend
```
The additive table can stay; old code ignores it. Do **not** drop it if any submission has attachments.

> The snippet keeps `backend/prisma/migrations/20261006120000_training_task_submission_files/` in place, because the migration is already applied in the database. Removing it would only make `prisma migrate status` warn about a migration missing locally.

## 11. Incident note (test isolation)
The local `backend/.env` points at the **same Neon database as production**. During development, one run of the new unit test reached the real notification engine. It inserted **one** `notifications` row (event `TASK_SUBMITTED`) addressed to a non-existent test user id (`55555555-…`), so it was visible to nobody. The row was deleted immediately by exact id. No audit, submission, file or user rows were created or changed. The test now stubs the notification dispatcher, audit, users and enrollment lookups and makes no DB calls.

**Recommendation:** point local development and tests at a separate database or Neon branch.

## 12. Notes / follow-ups
- Pre-existing: `/uploads/*` static serving requires authentication but does not authorize per file. New attachments live under `uploads/training/…` with unguessable UUID keys that are never sent to clients. Downloads go only through the authorized endpoints.
- Pre-existing: the generic `/files/upload` still uses memory buffering; only the new course-task path streams via a temporary file on disk.
- The two pre-existing failing unit tests listed above should be looked at separately.
- **Security:** the SSH root password was shared in chat; rotate it (and prefer key-based auth).

## Suggested commit (not executed)
```
feat: upgrade course assignment submissions and universal file uploads
```
