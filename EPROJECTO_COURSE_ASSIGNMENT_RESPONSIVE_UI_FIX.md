# EPROJECTO — Course Assignment Submission Responsive UI Fix

**Status:** Complete (frontend only, not deployed)
**Suggested commit message:** `fix: make course assignment submission fully responsive`

## 1. Root layout problems

1. **The task card lived inside a generic list row.** Trainee tasks were rendered as `.simple-list li`: a single-line flex row with `align-items: center`. The title, status, deadline, instructions button, previous-submission block and the whole multi-file upload form were all flex siblings on one line. On narrow screens they squeezed each other, wrapped unpredictably and overflowed sideways.
2. **The overflow was hidden, not fixed.** `.layout-dashboard__content` uses `overflow-x: clip`, so content spilling out of the card was cut off silently. The page looked broken, with truncated buttons and missing file names, but never showed a scrollbar.
3. **Too much nested padding on mobile.** The list item, the form card, the dropzone and the file rows each added their own padding. At 375 px the filename column was left with about 90 px.
4. **Filenames rendered incorrectly in RTL.** Names like `report-2026.pdf` displayed as `pdf.2026-report` because a digit sat next to the extension dot inside RTL text.
5. **The deadline was marked late on graded tasks.** "Overdue" styling applied even when the task was already submitted and graded.
6. **No layout above mobile sizes.** There was no summary column on desktop and no tablet layout.

## 2. Affected components

| File | Change |
|---|---|
| `frontend/src/features/training/components/taskSubmission/TraineeTaskCard.jsx` | **New.** Dedicated trainee assignment card: header, summary aside, instructions, previous submission, instructor feedback, submission form |
| `frontend/src/pages/trainee/TraineeCourseDetailPage.jsx` | Tasks tab renders `ul.assign-list > li > TraineeTaskCard`; submit/refresh logic unchanged |
| `frontend/src/features/training/components/taskSubmission/AssignmentSubmissionForm.jsx` | `title` prop, limits chips, restructured dropzone text, file-row sub-line (size + extension + status); upload logic unchanged |
| `frontend/src/features/training/components/taskSubmission/SubmissionFileList.jsx` | `hideSummary` prop, bidi-safe names, extension chip |
| `frontend/src/features/training/components/taskSubmission/FileSize.jsx` | `FileSize` wrapped in `<bdi dir="ltr">`, new `FileExtLabel`, re-exports `displayFileName` |
| `frontend/src/features/training/taskSubmissionLimits.js` | New pure helper `displayFileName()` |
| `frontend/src/assets/styles/components/_task-submission.scss` | Responsive card/grid/container-query styles |
| `frontend/tests/training.taskSubmissionUpload.ui.test.js` | Responsive and bidi assertions |

No backend, API, Prisma, upload-endpoint or validation changes.

## 3. Fixed-width issues removed

- No fixed pixel widths ≥ 100px remain in `_task-submission.scss` (enforced by a test: `/^\s*(min-)?width:\s*\d{3,}px/m` must not match).
- All grid tracks use `minmax(0, 1fr)`; all flex text children have `min-width: 0`.
- `box-sizing: border-box` on `.task-submit`, `.task-dropzone`, `.task-file-row`.
- No `overflow-x: hidden` anywhere in the stylesheet (enforced by a test).

## 4. Grid / flex fixes

- `.assign-card__layout`: `display: grid; grid-template-columns: minmax(0, 1fr)` (single column) →
  `@media (min-width: 1280px)`: `minmax(0, 1fr) minmax(15rem, 18rem)` with the summary in column 2.
- `.assign-summary__grid`: 1 column → 2 columns at 480 px → 3 columns at 768 px → 1 column (row dividers) in the 1280 px+ sidebar.
- `.assign-card__header`: wrapping flex, title `flex: 1 1 16rem; min-width: 0`, badges wrap below on narrow screens.
- Component-level adaptation uses **container queries** (`container-type: inline-size` on `.task-submit` and `.task-file-list`) so the form reacts to its *own* width (main column vs full page), not the viewport:
  - `@container (min-width: 36rem)` → horizontal dropzone (icon | text | button).
  - `@container (max-width: 30rem)` → narrow file rows (wrapping layout, 2-line name clamp, full-width action).
  - `@container (max-width: 26rem)` → submit/cancel actions stacked full width.

## 5. Layouts

**Desktop (1280 / 1440 / 1920):** two columns. The main column holds instructions, previous submission, feedback and the upload form. The 18rem sidebar summary shows status, deadline, grade, attempts, submission date and file count. The dropzone is a row at 1440/1920 and a column at 1280, where the main column is about 550 px wide.

**Tablet (768 / 1024):** single column. The summary sits above the content as a 3-column grid, and the dropzone is a row. The sidebar navigation appears at ≥1025 px, so the 1024 px content width is the full viewport.

**Mobile (320–430):** single column in this order: header and badges, summary (1 column below 480, 2 columns from 480), instructions with a full-width download button, previous submission, feedback, then the upload form. The form's frame is flattened (no border, background or shadow; a top divider only) to recover horizontal space. The dropzone is a column with a full-width button.

## 6. File-row behavior

- Row: icon + name/meta + actions. Name has `min-width: 0`, `overflow-wrap: anywhere`, and wraps to at most 2 lines with an ellipsis in narrow containers. The full name is in `title`.
- Sub-line shows the size (`<bdi dir="ltr">`), an extension chip (`ZIP`, `PDF`, …; at most 8 characters) and the status: "بانتظار الرفع" (waiting), `NN%` (LTR), or "تم الرفع" (uploaded).
- The progress bar stays inside the row card and never exceeds its width.
- Narrow containers: the remove/retry icon buttons grow to 44 px, and a text action (e.g. retry) wraps onto its own full-width line (min-height 44 px).
- The confirm-step list uses a compact variant: single-line ellipsis names, smaller icon.
- Archive files (`.zip`, `.rar`, `.7z`, …) keep their archive note and icon, and their upload behavior is unchanged.

## 7. Dialog behavior

The assignment flow has **no modal dialogs**. Confirmation is an inline step (`.task-confirm`) inside the card. It is responsive: compact file list, wrapping text, actions stacked full width under 26rem container width. Verified at 320 px with no overflow. No sticky action bar exists on this page and none was introduced; the submit button sits directly below the file list in normal flow.

## 8. RTL fixes

- `dir="auto"` on task titles and filenames, plus `text-align: right` under `[dir='rtl']`, so a Latin-only title still aligns with the Arabic layout.
- `displayFileName()` inserts an invisible LRM (`\u200E`) before the extension dot **only** when the preceding character is a digit, so `report-2026.pdf` no longer displays as `pdf.2026`. The original name is never changed in data or uploads; this is display only.
- Mixed names such as `مشروع-Final-React-v2.zip` were verified to render in the correct order.
- Sizes and percentages are isolated LTR (`<bdi dir="ltr">`, `<span dir="ltr">`).
- Only logical properties are used (`border-inline-start`, `padding-inline`, `inset-inline`).

## 9. Breakpoints tested

320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920. The dashboard sidebar was emulated at ≥1025 px (content width = viewport − 16.75rem).

States covered: no submission (empty), files selected (short, long, mixed RTL/LTR, digit-before-extension, archive), uploading with progress, uploaded, failed with retry, confirm step, previous submission with files, graded with instructor feedback, overdue.

## 10. Overflow / overlap results

An automated check compared every element's bounding rect against the content area's rect, and checked pairwise overlap between the direct children of every card section.

| Width | Overflow offenders | Overlaps | Layout |
|---|---|---|---|
| 320 | 0 | 0 | 1 column |
| 360 | 0 | 0 | 1 column |
| 375 | 0 | 0 | 1 column |
| 390 | 0 | 0 | 1 column |
| 430 | 0 | 0 | 1 column |
| 768 | 0 | 0 | 1 column, summary 3 columns |
| 1024 | 0 | 0 | 1 column, summary 3 columns |
| 1280 | 0 | 0 | 2 columns (≈550 + 288 px) |
| 1440 | 0 | 0 | 2 columns (≈704 + 288 px) |
| 1920 | 0 | 0 | 2 columns (≈981 + 288 px) |

Smallest tap target: 44 px on mobile and coarse pointers, 36 px for icon buttons on mouse-only desktop.

## 11. Screenshots

`C:\Users\Batma\AppData\Local\Temp\cursor\screenshots\assignment-qa\`

- `before-375.png`, `before-1440.png`: original broken layout
- `after-375-file-rows.png`, `after-375-upload-states.png`, `after-375-previous-submission.png`
- `after-768.png`
- `after-1280.png`, `after-1440.png`
- `after-1920-graded-feedback.png`
- `after-320-confirm-step.png`

## 12. Tests

- `node --test tests/training.taskSubmissionUpload.ui.test.js`: **18/18 pass.** The new assertions cover the card structure, responsive grid, container queries, no `overflow-x: hidden`, no fixed px widths, and `displayFileName` cases.
- `npm run test:unit` (frontend): **161/162 pass.** The single failure is the existing `tests/fieldTrainingEvaluation.ui.test.js` ("hides the native file chooser…"), which is unrelated to this change and was already failing before this task.
- `npx vite build`: **success.**
- No typecheck script exists in `frontend/package.json` (scripts: `dev`, `build`, `preview`, `test:unit`).

## 13. Known limitations

- Visual QA used a temporary local harness that rendered the real `TraineeCourseDetailPage` with mocked API data and a fake upload XHR, not a live authenticated session. The harness has since been deleted.
- At 1280 px the dropzone stacks vertically because the main column is about 550 px wide. This is intentional, driven by the container query.
- Icon buttons are 36 px on mouse-only desktop and 44 px on touch and coarse pointers.
- The React Router "future flag" console warnings seen during QA came from the harness's `MemoryRouter`, not the app.
- The instructor review panel shares the file-row component, so it also gets the bidi and wrapping improvements.

## 14. Deployment

**Not deployed.** No SSH, no server, Nginx or DB changes. No `git add`, `commit` or `push`. To deploy later, rebuild the frontend only; the backend is unchanged and no migration is needed.
