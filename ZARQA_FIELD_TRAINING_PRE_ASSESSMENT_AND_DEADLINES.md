# Zarqa Field Training PRE-Assessment and PRE/POST Deadlines

**Product:** BATTECHNO LMS  
**Date:** 2026-09-12  
**Scope:** Zarqa Private University Field Training PRE assessment + authoritative closing deadlines for Field Training PRE and POST only.

No git commit, push, PR, merge, or tag was created.

---

## Target university

| Field | Value |
|--------|--------|
| Arabic name | جامعة الزرقاء الخاصة |
| English name | Zarqa Private University |
| Code / slug | `zarqa-private-university` |
| University ID | `4b85f423-c543-499e-9765-a5248dbfa583` |
| Organization type | `UNIVERSITY` |
| Status | `active` |

Eligibility rows for the selected opportunity all belong to this university only. Tafila and Mutah were not used.

---

## Opportunity

Exactly one active/published Zarqa Field Training opportunity was found. No guesswork was required.

| Field | Value |
|--------|--------|
| Title | التدريب الميداني الفصل الاول لطلبة جامعة الزرقاء 2026/2027 |
| Opportunity ID | `cbe032b3-e7ef-475f-851e-faa7e61264b2` |
| Status | `published` |
| Requires PRE | yes |
| Requires POST | yes |
| Existing PRE before this work | none |
| Existing POST | published standardized POST (`e7f57a99-ed67-484d-a28f-f00caeef0ae8`), 25 questions, `closes_at` left `null` |

The user-supplied closing time was used because the opportunity/schedule did not define a PRE-specific deadline:

`13/9/2026 11:59 PM` Asia/Amman → `2026-09-13T23:59:00+03:00` (`2026-09-13T20:59:00.000Z`).

---

## PRE assessment

| Field | Value |
|--------|--------|
| Assessment ID | `029e43b1-56dc-42c5-9d19-df9a281abbb5` |
| Type | PRE |
| Title | الامتحان القبلي – أساسيات Full Stack |
| Status | `published` |
| Questions | 20 |
| Options per question | 4 |
| Question type | single-answer multiple choice |
| Points per question | 5 |
| Total score | 100 |
| Passing score | 60 / 100 |
| Pass requirement | 12 of 20 correct |
| Correct answers configured | 20 / 20 |
| Closing deadline | 13 September 2026, 11:59 PM Asia/Amman |
| Published | YES |
| Attempts | existing Field Training PRE policy (one attempt per application) |
| Final `/100` score impact | none (PRE remains outside Attendance 20 / Post 20 / Tasks 40 / Behavior 20) |

Grading checks (points, not renormalized percent of a different scale):

| Correct | Points | Result |
|--------:|-------:|--------|
| 0 | 0 | fail |
| 11 | 55 | fail |
| 12 | 60 | pass |
| 20 | 100 | pass |

Student payloads omit `correct_answer`. Grading uses stored server-side keys.

Duplicate protection: no PRE existed for this opportunity, so one was created. Existing POST and its questions were not replaced.

---

## Schema / API changes

Additive nullable column on `field_training_assessments`:

```prisma
closes_at DateTime? @db.Timestamptz(6)
```

Migration: `backend/prisma/migrations/20260912120000_field_training_assessment_closes_at/migration.sql`

- `ADD COLUMN IF NOT EXISTS`
- no `UPDATE` backfill
- no destructive statements

Existing assessments with `closes_at = null` keep legacy open behavior. After apply, 7 historical Field Training assessments still have `closes_at` null; only the new Zarqa PRE has a deadline.

Authoritative helper: `backend/src/modules/fieldTraining/fieldTraining.assessmentDeadline.js`

Closed rule:

```text
published + now >= closesAt = closed
```

Server/database time is used. Browser timestamps are ignored.

API fields (snake_case and camelCase):

- `opensAt` / `opens_at` (when already present in settings)
- `closesAt` / `closes_at`
- `isOpen` / `is_open`
- `isClosed` / `is_closed`
- `display_status` (`draft` | `published` | `closed`)
- `timezone` (`Asia/Amman`)

Correct answers are not included in student start/list payloads.

Publishing a new PRE or POST without `closesAt` fails with:

`يرجى تحديد موعد إغلاق الامتحان قبل النشر.`

Drafts may omit the deadline. Initial publish requires a future datetime. Admins may later edit an existing deadline.

Error code for late student writes: `ASSESSMENT_CLOSED`  
Arabic: `انتهى موعد تقديم الامتحان ولم يعد بالإمكان إرسال الإجابات.`

---

## Backend enforcement

Every Field Training student path that starts, resumes, saves, or submits PRE/POST now uses server time:

- `GET /:id/assessments/:type` — blocked after close unless a submitted attempt is being viewed
- `POST /:id/assessments/:type/save` — blocked after close
- `POST /:id/assessments/:type/submit` — blocked after close even if `skipWindowCheck` is set for duration auto-submit
- `POST /assessments/:assessmentId/submit` — same submit path

An attempt opened before the deadline cannot be submitted at or after `closesAt`. Previously saved draft answers are not deleted.

Course quizzes / Micro-Credentials / training-program tests were not moved onto this Field Training deadline module.

---

## UI changes

### Admin PRE/POST builder

- Date + time fields: `موعد إغلاق الامتحان`
- Timezone label: `Asia/Amman (الأردن)`
- Naive date/time is stored by the backend as Asia/Amman, not by a client UTC conversion
- Status badge uses derived `display_status`: مسودة / منشور / متاح / مغلق
- Publish is blocked until a closing datetime is set

### Student PRE/POST cards and take form

- `موعد الإغلاق:` with Arabic Asia/Amman datetime
- `متاح` while open
- `مغلق` + `انتهى موعد تقديم الامتحان.` after close
- Optional `متبقي ...` when less than 24 hours remain
- Start / continue / submit controls are hidden or disabled after close
- Backend remains authoritative if the UI is bypassed

### Mobile Field Training hub

- Reads `isClosed` / `closesAt`
- Closed assessments are not startable; submitted results remain viewable

Reviewer academic routes still have no assessment write endpoints. Students cannot PATCH assessment metadata. University admin access remains scoped; another university cannot modify Zarqa.

---

## Tests

Added/extended:

- `backend/tests/fieldTraining.assessmentDeadline.unit.test.js`
- `backend/tests/fieldTraining.zarqaPreAssessment.unit.test.js`
- `backend/tests/fieldTraining.assessmentDeadline.permissions.unit.test.js`
- `frontend/tests/fieldTraining.postAssessment.ui.test.js`

Covered:

- before deadline / one second before / exact deadline / after deadline
- direct submit after close
- open-before / submit-after
- client clock does not override injected server `now`
- admin/reviewer/student/cross-university isolation
- Zarqa 20×5=100, pass 60, grading 0/11/12/20
- additive migration does not backfill `closes_at`

Primary run for this change: **80 passed / 0 failed** (62 backend + 18 frontend).

Additional Tafila overlay suite: 27 passed. One pre-existing assertion (`AUTHORIZED_MANUAL_REVIEW` vs `AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT`) failed and is unrelated to this deadline/PRE work.

---

## Permission regression

| Actor | Result |
|--------|--------|
| super_admin | can manage within existing architecture |
| Zarqa university admin | can manage Zarqa assessment |
| other university admin | cannot access Zarqa records |
| reviewer | read-only academic portal; cannot edit deadline |
| student | cannot call admin assessment write routes |
| institution users | cannot manage university Field Training assessments |

---

## Existing cohort regression

Scoring policy unchanged: `FIXED_COMPONENTS_20_20_40_20_V1`.

| Check | Result |
|--------|--------|
| Historical `closes_at` backfill | none (7 assessments remain null) |
| Zarqa POST | still published, `closes_at` null |
| Tafila primary opportunity approved count | 151 |
| Tafila eligible | 146 |
| Tafila ineligible | 5 |
| Laith `320230601066` | still `ineligible`; scoring/qualification tests still apply the Laith override |
| PRE added to final `/100` | no |

Admin UI browser click-through was not executed in this pass (no authenticated browser session). Data and API-side verification of the Zarqa PRE row, questions, scores, and deadline were completed against the live database after publish.

---

## Suggested commit message

```text
feat: add zarqa pre-assessment and field training assessment deadlines
```
