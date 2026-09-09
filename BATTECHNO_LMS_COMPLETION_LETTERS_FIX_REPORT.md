# BATTECHNO LMS — Field Training Completion Letters Fix Report

Date: 2026-08-31  
Scope: Issue All, single-letter generation, Download All, ZIP grouping, Arabic filenames, retry/idempotency, live Mutah run.  
Production deployed: **NO**

## 1. Root cause of Issue All failure

Verified from live Mutah data and the running code path (not guessed):

1. **Stale issued rows without files.** Two `field_training_completion_letters` rows were `status=issued` with `pdf_url` null or pointing at a missing file, and `source_data_hash` null.
2. **Skip logic treated those rows as already issued.** `classifyStudent` / `issueOne` skipped when `status === 'issued'` and hash was missing, so Issue All would never regenerate the lost PDFs. Eligible students **without** a letter row were still generatable; the skip bug blocked re-issue of broken records.
3. **Earlier boot crash (fixed in this working tree).** Preview handlers were missing from `fieldTraining.workflow.controller.js`, so Express died with `Route.get() requires a callback function but got a [object Undefined]` and no letter API could run.
4. **PDF write path** now uses `repo.resolveSubmissionAbsolutePath` (same resolver as download) instead of a cwd-relative `path.join(UPLOAD_DIR, …)` that could diverge.

## 2. Root cause of Download All failure

1. **ZIP flattening regression.** `uniqueZipEntry` omitted the supervisor folder, producing a flat archive. Restored: `{sanitizeZipFolder(name)}/{Student}_{Number}_كتاب_إنهاء_التدريب.pdf`.
2. **Issued-but-missing files.** Download All selected `has_pdf` from `Boolean(pdf_url)` without checking disk. One Mutah row had a URL and no file → ZIP `missing_pdf`. `has_pdf` now requires `submissionFileExists`.
3. **Zero ready PDFs** return HTTP 409 `NO_READY_LETTERS`. Download does **not** auto-issue.

## 3. Files changed

Primary:

- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.service.js` (file-ready skip, shared upload path, batch job)
- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.template.js`
- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.filename.js`
- `backend/src/modules/fieldTraining/fieldTraining.completionLetter.zip.js`
- `backend/src/modules/fieldTraining/fieldTraining.workflow.controller.js`
- `backend/src/modules/fieldTraining/adminFieldTraining.routes.js`
- `frontend/src/pages/admin/fieldTraining/components/manage/ManageLinkTab.jsx`
- `frontend/src/features/fieldTraining/fieldTraining.service.js`
- `frontend/src/services/apiHelpers.js`
- Tests: `backend/tests/fieldTraining.completionLetters.supervisorExcel.unit.test.js`

## 4. Single-letter generation

Live (Mutah): **Nipras Majali / 120212231083**

- outcome `issued` then `skipped` on repeat
- PDF `D:\LMS\backend\uploads\field-training\completion-letters\…\FT-MTH9R89Z.pdf`
- size 572,956 bytes
- `source_data_hash` stored

Eligibility used stored `eligible` + hours ≥ 140. University number from official/email local-part.

## 5. Bulk issue flow

Live Opportunity `التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026`:

- Eligible: **88**
- Bulk job: **87 newly issued**, 0 failed, 0 skipped (Nipras already current)
- Job status: `completed` / `اكتمل`
- Second Issue All: HTTP 400 `NO_ELIGIBLE_STUDENTS` (88 `alreadyCurrent`)

Concurrent second job still returns 409 `BULK_ISSUE_IN_PROGRESS`.

## 6. Eligibility handling

Unchanged engine:

- `completion_eligibility_status === 'eligible'`
- `completed_training_hours >= 140`
- expelled skipped

No new eligibility calculator.

## 7. Student data mapping

Name = `users.full_name`. University number = official number or email local-part. Never user/application UUID.

## 8. Academic supervisor grouping

Plain text `academic_supervisor_name`. No LMS account required. Missing → `مشرف غير محدد`.

Live ZIP folders (14, **not** fuzzy-merged on `الطراونة`):

زكريا الطراونه · د.احمد الطراونة · د. خالد الطراونة · وفاء الطراونة · أ.د. مصطفى حماد · د. نديم العضايلة · أ.د بسام المحادين · د. رأفت المسيعدين · ربا الصعوب · د.المعتز المبيضين · د. اسماء النوايسة · أ.د. عوني حموري · عمر اللصاصمه · مشرف غير محدد

## 9. PDF generation

Puppeteer HTML → PDF. Logo/stamp from `__dirname/assets`. Missing Sakkal Majalla logs `MISSING_FONT` and continues. Render/write failures use `PDF_RENDER_FAILED` / `TEMPLATE_RENDER_FAILED` / `OUTPUT_WRITE_FAILED`.

## 10. Storage

Relative `field-training/completion-letters/{applicationId}/{letterNo}.pdf` under `UPLOAD_DIR`, resolved with `resolveSubmissionAbsolutePath`. Authenticated download only.

## 11. ZIP structure

Live Download All: **88 PDFs**, **0 flat root PDFs**, 14 supervisor folders. Filename:

`كتب_إنهاء_التدريب_التدريب_الميداني_الصيفي_لطلبة_جامعة_مؤتة_20252026_2026-08-31.zip`

## 12. UTF-8 filenames

`filename*=UTF-8''…` on PDF and ZIP. Frontend `parseFilename` + blob download; ZIP is not parsed as JSON.

## 13. Idempotency

Skip only when **issued + file on disk +** matching (or legacy empty) `source_data_hash`. Missing file → regenerate. Live: Nipras skipped; second bulk issued 0.

## 14. Retry behavior

`retryFailedIds` only. Successful PDFs stay. Live bulk had 0 failures.

## 15. Authorization

Unchanged: Super Admin `isGlobal`; university admin own university; instructor assigned opportunity; reviewer assigned students; institution `requireOrganizationType('UNIVERSITY')` DENY.

## 16. Performance / N+1

Batch-load applications, profiles, letters, instructor. Sequential PDF render (Chromium queue). ZIP: one letter query + disk reads.

## 17. Tests

| Check | Result |
| --- | --- |
| ZIP opened with JSZip; supervisor folders; الطراونة not merged; `مشرف غير محدد/` | PASS |
| Two Puppeteer PDFs; isolated university numbers | PASS |
| Idempotency + retry-failed-only + missing-file regenerate | PASS |
| Mutah Excel fixture 98 students / 16 groups | PASS |
| `npx prisma validate` | PASS |
| `cd backend && npm test` | PASS (877) |
| `cd frontend && npm run test:unit` | PASS (110) |
| `cd frontend && npm run build` | PASS |

## 18. Runtime / browser verification

- Backend live Issue All + Download All against Mutah: **PASS** (88 PDFs, supervisor folders, idempotent second issue).
- Frontend Vite + production build: PASS.
- **Click-through of إصدار الكل / تنزيل الكل in the browser UI: BLOCKED** (no browser automation in this session).

## 19. Remaining limitations

- Visual UI console check remains BLOCKED.
- Live Mutah has **14** supervisor ZIP folders (including `مشرف غير محدد`), not the Excel fixture’s 16 groups.
- 16 students remain ineligible (no post-assessment / expelled); they are correctly excluded from Issue All.
- `pdf-parse` reverses Arabic glyph order; identity is asserted via HTML + university numbers.
- Leftover unused `fieldTraining.completionLetter.js` is not on the live path.

## 20. Official template restored (2026-08-31)

The live HTML path `fieldTraining.completionLetter.template.js` was a simplified BATTECHNO LMS sheet. Restored the previous official letter:

- Company: شركة الرجل الوطواط للتكنولوجيا
- Title: كتاب إنهاء تدريب ميداني · recipient: إلى من يهمه الأمر
- Logo `batman-technology-logo.png` · stamp `official-company-stamp.png`
- Sakkal Majalla fonts · A4 cream page · عاصم القيسي / مسؤول التدريب
- PDF: `displayHeaderFooter: false`, zero margins (no LMS admin footer)
- `TEMPLATE_VERSION = official-batman-v1` is part of `source_data_hash`, so previously issued Mutah PDFs will regenerate on the next إصدار الكل

Sample render: HTML contains official copy; PNG logo/stamp; font-face embedded; student name/number isolated in PDF.
