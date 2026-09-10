# FIELD TRAINING P2 — TASK SEMANTICS AND UX CLEANUP

**Product:** BATTECHNO LMS  
**Date:** 2026-09-10  
**Scope:** P2 only. No scoring change. No eligibility change. No Tafila approved-outcome change. No historical recalculation.

Suggested commit message:

`refactor: unify field training task semantics and polish reporting UX`

---

## 1. Previous task-state inconsistencies

Before P2, Field Training mixed four different concepts into overlapping labels:

| Surface | What it showed | Problem |
|---|---|---|
| Student / admin task tables | `review_status` (`pending`, `approved`, `graded`) as the only badge | A pending review looked like a missing submission; `approved` looked like a training result |
| Task progress | `مكتمل` when every required task had an LMS row | File upload was treated as completion even before evaluation |
| Eligibility cards | Overlay Excel `SUBMITTED` / approved task marks | Could imply a submission that did not exist as an LMS row |
| Student Final Report UI | Only submitted rows; raw `review_status`; mojibake `â€"` placeholders | Unsubmitted required tasks disappeared; English enums leaked |
| Student PDF | Mixed English statuses and slash counts | `4 / 2` and `مكتمل` vs `مسلّم` mismatch |
| Excel | Source enums and slash counts | University sheet could expose `AUTHORIZED_*` and `eligibilityStatus` codes |
| Reports | `rawScore` / `approvedScore` / UUIDs / ISO timestamps / em dash | Read like an engineering dump |

Runtime fields were **not** invented. Authoritative LMS fields remain:

- Task definition: `field_training_tasks` (`is_required`, title, due date)
- Submission existence: a real `field_training_task_submissions` row
- Review: `review_status` (`pending`, `submitted`, `under_review`, `needs_revision`, `approved`, `rejected`, `graded`)
- Grade: `manual_score` / `max_score`
- Timing: `is_late`, `submitted_at`
- Official score: P1 `officialResult` only

---

## 2. Final task semantic model

Presentation-only. Scoring, eligibility, and LMS rows are unchanged.

Four separate concepts:

| Concept | Authoritative source | User-facing states |
|---|---|---|
| A. Submission | Real LMS submission row | غير مسلّم / مسلّم |
| B. Evaluation | `review_status` | لم يتم التقييم / قيد التقييم / تم التقييم / تحتاج إعادة تسليم |
| C. Score | Approved reviewed grade, else P1 canonical task grade | العلامة, or لا توجد |
| D. Timing | `is_late` | في الوقت / متأخر |

**مكتمل** (overall task) means:

real LMS submission **and** final evaluation (`graded` or `approved`).

Upload alone is **مسلّم**, not مكتمل.

Unsubmitted required task display:

- حالة التسليم: غير مسلّم
- حالة التقييم: لم يتم التقييم
- العلامة: لا توجد
- تاريخ التسليم: لا يوجد

`0` is not shown as the visible task grade unless the scoring policy already treats the missing task as zero in the **score breakdown**. Submission evidence and scoring penalty stay distinct.

Overlay scores are used only when a real evaluated submission exists and `manual_score` is missing. Overlay-only objects never create fake submission rows.

Late remains timing. A late task may still be مسلّم and تم التقييم.

Counts always use LMS submissions: `2 من 4`, never reversed `4 / 2`.

Central module:

`backend/src/modules/fieldTraining/fieldTraining.taskSemantics.js`

Frontend mirror:

`frontend/src/features/fieldTraining/fieldTrainingTaskSemantics.js`

---

## 3. Central label mappings

Backend presentation:

- `fieldTraining.taskSemantics.js` — submission, evaluation, timing, counts, scores
- `fieldTraining.reportPresentation.js` — training status, eligibility, result source, dates, RTL score/count HTML, forbidden-token scan
- `fieldTrainingReport.labels.js` — application, training, attendance, task review, eligibility, certificates

Frontend:

- `fieldTraining.json` `trainingStatus`, `eligibility`, `tasks.reviewStatuses`, `attendanceStatus`, `outcomeSemantics`
- `fieldTrainingUi.js` `FT_EMPTY` empty-state vocabulary

Result source (administrative reports only, never raw enums):

| Internal source | Human Arabic |
|---|---|
| AUTHORIZED_MANUAL_REVIEW | مراجعة واعتماد نهائي |
| AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT | نتيجة معتمدة بعد المراجعة |
| AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE | قرار إداري معتمد |
| EXCEL_BASELINE | النتيجة النهائية المعتمدة |

Status examples:

| Enum | Arabic |
|---|---|
| approved (application) | معتمد |
| completed (training) | مكتمل |
| in_progress | قيد التنفيذ |
| pending (eligibility) | قيد الاستكمال |
| submitted | مسلّم |
| graded / approved (task review) | تم التقييم |
| not_submitted | غير مسلّم |
| eligible | مؤهل |
| ineligible / not_eligible | غير مؤهل |
| failed | لم يجتز |
| expelled | مستبعد من التدريب |

حالة التدريب and نتيجة التدريب stay separate. `completed` is never translated as ناجح or مؤهل.

Attendance: حاضر / متأخر / بعذر / غائب.

Behavior: تقييم السلوك والالتزام.

---

## 4. UI changes

No page-layout redesign.

- Student eligibility, admin eligibility cards, student detail drawer, and task panels now show submission vs evaluation separately.
- Score breakdown shows العلامة, not `rawScore` / `manualScore` / `approvedScore`.
- Unsubmitted visible grade is لا توجد.
- Task counts use `2 من 4`.
- Empty values use غير متوفر / غير محدد / لا يوجد / غير مطلوب.
- Student and university report screens map statuses through i18n instead of English enums.
- Reviewer remains read-only: recalc and hours edit stay hidden when `readOnly` or `apiScope === 'reviewer'`. Reviewer report pages still have no write actions.
- Completion-letter errors stay Arabic: `لا يمكن إصدار كتاب إنهاء لأن الطالب غير مؤهل حاليًا.`

---

## 5. Report language changes

Student Final Report focuses on identity, training, attendance, hours, score breakdown, final score, final result, and concise not-eligible reasons.

Student Comprehensive Report keeps the approved navy/gold/white cover and sections:

1. البيانات الأساسية  
2. بيانات التدريب  
3. النتيجة النهائية  
4. توزيع العلامة  
5. استيفاء متطلبات التدريب  
6. الحضور والساعات التدريبية  
7. التقييم القبلي والبعدي  
8. التاسكات  
9. تقييم السلوك والالتزام  
10. أسباب عدم التأهيل  
11. نشاط الطالب على المنصة  
12. بيانات التقرير  

Cover titles **تقرير الطالب الشامل** / **للتدريب الميداني** are white on navy.

Removed from normal user-facing HTML/PDF:

- `AUTHORIZED_*`, `EXCEL_BASELINE`, `VERIFIED_*`
- `applicationId` / `opportunityId` / UUID labels
- `rawScore` / `approvedScore` / `manualScore`
- ISO timestamps
- long dash `—`

Eligible reason: استوفى الطالب متطلبات التدريب المعتمدة.

Not-eligible reasons are factual, generated from the P1 official result (for example تسليم 2 من أصل 4, incomplete behavior, final score below threshold).

Technical task names (React, Node.js, PostgreSQL, REST API) remain.

---

## 6. Excel changes

University-facing students sheet headers are Arabic, including:

حالة التدريب، نتيجة التدريب، العلامة النهائية، نسبة الحضور، علامة الحضور من 20، التقييم البعدي، علامة التقييم البعدي من 20، التاسكات المطلوبة، التاسكات المسلمة، التاسكات التي تم تقييمها، تقدم التاسكات، علامة التاسكات من 40، علامة السلوك والالتزام من 20، الساعات المنجزة، سبب عدم التأهيل.

Task counts come from LMS submissions, not historical Excel text.

Primary worksheet does not expose source enum codes. Privileged audit metadata stays off the university-facing sheet.

Per-student Excel task sheet now lists required tasks with submission state, evaluation state, timing, and لا توجد / لا يوجد for missing grades and dates.

---

## 7. RTL fixes

- Score values wrapped `dir="ltr"`: `59.4 / 100`, `16.2 / 40`.
- Counts use `من` instead of slash pairs.
- Arabic dates: `8 أيلول 2026`; ranges `من 23 تموز 2026 إلى 5 أيلول 2026`.
- Cover title forced white (`#ffffff !important`).
- Session titles stripped of noisy university/date suffixes in comprehensive reports.

---

## 8. Visual report polish

Subtle only: spacing, typography hierarchy, LTR numeric wrappers, page metadata, empty-row hiding in activity summaries.

Preserved: dark navy, gold accents, white pages, current logos, card style, BATMAN TECHNOLOGY composition.

Did not add a new color system, gradients everywhere, glass, illustrations, or decorative clutter.

---

## 9. Tafila regression

Primary online opportunity, live official resolver (no data writes):

| Check | Result |
|---|---|
| Students | 151 |
| Eligible | 146 |
| Not eligible | 5 |
| Eligible below 80 | 0 |
| Eligibility changes | 0 |
| Score changes | 0 |
| Task submission count changes | 0 |
| Issued letters for ineligible | 0 |

---

## 10. Laith regression

University number `320230601066`:

| Field | Value |
|---|---|
| Eligibility | NOT_ELIGIBLE |
| Final | 59.4 |
| Attendance | 20 / 20 |
| Post | 14.4 / 20 |
| Tasks | 16.2 / 40 |
| Behavior | 8.8 / 20 |
| Submitted | 2 of 4 |
| Task 1 | 84 |
| Task 2 | 78 |
| Tasks 3 and 4 | Not submitted |
| Training status | completed (مكتمل), result غير مؤهل |
| Data changed | NO |

---

## 11. Tests

Added / extended:

- `backend/tests/fieldTraining.taskSemantics.unit.test.js` — no submission, pending review, graded/approved, late, overlay-only, returned/rejected, all-required-task presentation, source labels
- `frontend/tests/fieldTraining.taskSemantics.ui.test.js` — frontend mirror
- Existing report presentation HTML scan for forbidden tokens, white cover, `2 من 4`, LTR scores
- Excel / task progress / student report template tests updated for new labels and columns
- P0 completion-letter eligibility gates still pass
- P1 policy selector including cross-output Excel still passes

Live: `backend/scripts/p0-field-training-official-regression.js`

---

## 12. Remaining non-P0/P1/P2 observations

- `frontend/tests/fieldTrainingEvaluation.ui.test.js` still expects no native `<input type="file">` in `ManageEvaluationTemplateTab.jsx`. Pre-existing. P2 did not change that control.
- Completion-letter PDF identity extraction test can fail to match `/عاصم/` because pdf-parse returns reversed glyphs (`يقلا مصاع`). Letter HTML still contains `إلى من يهمه الأمر` and the officer name. Not a P2 data change.
- Professional evaluation DOCX payloads may still use راسب in evaluation-form mapping. That module is not the official student/university result.
- University cohort HTML is simpler than the student comprehensive cover. Identity was preserved, not redesigned.
- Non-Field-Training LMS pages (grades, certificates, instructor assessments) still use `—`. Out of P2 scope.
- Source comments may still contain `—`. Those are not user-visible.
- Browser visual pass of live generated PDFs was done via HTML unit fixtures and live official-result regression, not a full Playwright screenshot tour in this pass.

P0 and P1 consumers still read `resolveFieldTrainingApprovedResult`. Reports and Excel format that result; they do not recalculate it.
