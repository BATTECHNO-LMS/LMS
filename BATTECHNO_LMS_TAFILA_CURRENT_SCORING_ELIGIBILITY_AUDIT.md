# BATTECHNO LMS — Tafila Technical University
## Current Field Training Scoring & Eligibility Audit

**Audit type:** READ-ONLY (no code changes, no database writes, no score persistence, no eligibility changes, no 20/20/40/20 implementation)  
**Audit date:** 2026-09-08  
**Scope:** جامعة الطفيلة التقنية / Tafila Technical University — current runtime Field Training scoring and completion eligibility  
**Data source:** live database + current backend/frontend code

---

## 1. Executive Summary

The current Tafila Field Training system does **not** qualify students with `Final Score >= 80/100`.

There are **two separate engines**:

| Engine | File | What it decides | Stored on |
|---|---|---|---|
| **Workflow eligibility (authoritative for letters / student status)** | `backend/src/modules/fieldTraining/fieldTraining.workflow.js` → `calculateFieldTrainingEligibility` | `eligible` / `ineligible` / `needs_review` | `field_training_applications.completion_eligibility_status` |
| **Final Score /100 (authoritative for evaluation reports)** | `backend/src/modules/fieldTraining/fieldTrainingEvaluation.scoring.js` → `calculateFinalEvaluation` | numeric `/100` plus PASSED/FAILED | `field_training_final_evaluations.final_score` / `final_status` |

**Current /100 formula (Tafila has no university policy row, so global defaults apply):**

```
Final Score =
  Attendance%        × 20
+ TaskCompletion%    × 20
+ PostAssessment%    × 20
+ Professional%      × 40
```

Weights are renormalized if a weighted component is missing. The score is **only computed if scoring gates pass**. Otherwise stored `final_score` is `null`.

**Current completion eligibility (what actually marks a student مؤهل):**

```
eligible =
  not expelled
  AND not failed
  AND attendance% >= opportunity.minimum_attendance_percentage (80)
  AND completedHours >= opportunity.required_training_hours (140)   [primary opportunity only]
  AND post assessment exists
  AND post_assessment_score >= opportunity.minimum_post_assessment_score (80)
  AND (final task not required on Tafila)
```

**Final Score is not a completion-eligibility gate.**  
**The expected business threshold 80/100 is a QUALIFICATION_THRESHOLD_MISMATCH.**

What *is* currently `80`:

- opportunity minimum **attendance** = 80%
- opportunity minimum **post-assessment score** = 80
- evaluation-policy default minimum attendance = 80%

What is **not** 80:

- evaluation passing score default = **60**
- completion eligibility does not read Final Score at all

### Primary live cohort (published)

| Item | Value |
|---|---|
| Opportunity | التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026 |
| Opportunity ID | `4d9466cb-127b-42f2-ac08-88e7fcc7c7df` |
| Approved real students | **151** (0 verified test/demo accounts excluded) |
| Stored eligible | **146** |
| Stored ineligible | **5** |
| Pending | **0** |
| Stored evaluation snapshots | 151 |
| Stored numeric Final Score | 86 students (range 87.2–100, mean 98.50) |
| Eligible with `final_score = null` | **60** (scoring task gate failed: not all 4 tasks `approved`/`graded`) |

A second same-titled clone opportunity exists (`in_progress`, 0 sessions, 13 approved). It is documented in §2 / §14 but is not the published production cohort.

---

## 2. Tafila Opportunity

### University / organization

| Field | Value |
|---|---|
| University | جامعة الطفيلة التقنية / Tafila Technical University |
| University ID | `35c16bfc-a5a9-4de8-8d44-d9230235b334` |
| Organization ID (universities.organization_id) | `70dca273-8fcc-47ed-8fab-59e1d669998f` |
| Domain | `ttu.edu.jo` |
| Opportunity `university_id` column | **null** (university is bound through `field_training_opportunity_eligibility`, not the opportunity owner column) |

Host organization on the opportunity is **شركة الرجل الوطواط للتكنولوجيا** (BATTECHNO). Field Training opportunities do not have a foreign key to `organizations`; they store `organization_name` + `host_organization` JSON.

### Opportunity A — published production cohort

| Field | Value |
|---|---|
| Opportunity ID | `4d9466cb-127b-42f2-ac08-88e7fcc7c7df` |
| Name | التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026 |
| Slug | `التدريب-الميداني-الصيفي-لطلبة-جامعة-الطفيلة-التقنية-20252026` |
| Status | `published` |
| Academic year | 2025-2026 |
| Semester | الصيفي (inferred from start date 2026-07-23; host JSON has no semester/year fields) |
| Dates | 2026-07-23 → 2026-09-05 |
| Location / org name | شركة الرجل الوطواط للتكنولوجيا |
| Real approved students | **151** |
| Excluded test/demo | **0** |

### Opportunity B — clone / in-progress

| Field | Value |
|---|---|
| Opportunity ID | `01666ebc-bfc1-4948-87a5-2add3f641c65` |
| Same title | التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026 |
| Slug | `…20252026-1` |
| Status | `in_progress` |
| Required hours | **null** (hours gate off) |
| Sessions | **0** |
| Approved real students | **13** (10 stored eligible, 3 expelled/ineligible) |
| Stored evaluations | **0** |

Opportunity B looks like a duplicate of A. Its 10 “eligible” rows are stale: there are no sessions, so live attendance is null and both engines would fail the 80% attendance gate if recalculated now.

### Test/demo exclusion

Excluded using the platform’s verified markers:

- `batuni.edu` / `demo-lms.test` / `.demo.` emails
- seed-demo TTU emails (`student1@ttu.edu.jo`, `student2@ttu.edu.jo`, `admin@ttu.edu.jo`, `reviewer@ttu.edu.jo`)
- names matching seed-demo “Tafila Student / Admin / Reviewer”

None of the 151+13 approved applications matched. All listed students are treated as real.

---

## 3. Current Final Score Formula

### Authoritative scoring path

| Item | Value |
|---|---|
| File | `backend/src/modules/fieldTraining/fieldTrainingEvaluation.scoring.js` |
| Function | `calculateFinalEvaluation` (uses `weightedFinalScore`, `evaluateGates`, `professionalTotals`, `criterionFromEvidence`) |
| Service | `backend/src/modules/fieldTraining/fieldTrainingEvaluation.service.js` — `loadBatchContext` builds `scoringInput`; `generateForApplications` persists the result |
| Constants | `backend/src/modules/fieldTraining/fieldTrainingEvaluation.constants.js` → `DEFAULT_POLICY` |
| Tafila policy row | **none** (`field_training_evaluation_policies` empty for this university) → defaults apply |
| Frontend | `FieldTrainingEvaluationReportsPage.jsx` **displays stored** `finalScore`; it does not recalculate |
| Excel (students export) | `fieldTrainingStudentsExcel.js` writes eligibility + PASSED/FAILED/NOT_ELIGIBLE label; **does not recalculate /100** |
| Excel/PDF evaluation | filled from stored `field_training_final_evaluations` snapshot |

There is **one formula implementation** for `/100`. There is **not** one eligibility implementation: workflow eligibility and scoring gates disagree (see §16).

### Database fields used for /100

From `loadBatchContext` scoring input:

- `field_training_applications.attendance_percentage`
- `field_training_applications.completed_training_hours` (merged with attendance-derived hours)
- `field_training_applications.pre_assessment_score` (professional derivation / display only)
- `field_training_applications.post_assessment_score`
- `field_training_opportunities.required_training_hours`
- task rows + `field_training_task_submissions.review_status` / `manual_score` / `max_score` / `is_late`
- `field_training_attendance` + session start/end
- `field_training_supervisor_ratings` (6 behavioral fields)

Persisted outputs on `field_training_final_evaluations`:

- `attendance_component_score`, `tasks_component_score`, `post_assessment_component_score`, `professional_component_score`
- `criterion_1_score` … `criterion_10_score`, `professional_total`, `professional_percentage`
- `final_score`, `final_percentage`, `final_status`, `eligibility_status`

### Exact current formula

```
TaskCompletion% = (acceptedTaskCount / requiredTaskCount) * 100
                  accepted = review_status in {approved, graded}

Professional%   = (sum of 10 criteria each 1–5) / 50 * 100
                  if professionalEvaluationRequired and any criterion is null → Professional% = null
                  (component omitted; remaining weights renormalized)

If scoring gates fail:
  Final Score = null
  finalStatus = NOT_ELIGIBLE

If scoring gates pass:
  Final Score = round1(
      (Attendance%     * 20
     + TaskCompletion% * 20
     + PostScore       * 20
     + Professional%   * 40) / 100
  )
  If a component is null, drop it and divide by the remaining weight sum.
  finalStatus = Final Score >= minimumPassingScore (60) ? PASSED : FAILED
```

`round1` = one decimal place.

---

## 4. Score Components

| Component | Raw source | Raw scale | Normalization | Weight | Max contribution |
|---|---|---|---|---|---|
| Attendance | `applications.attendance_percentage` | 0–100 % of **required sessions** | used as 0–100 directly | 20 | 20 |
| Tasks | accepted/required task count | count | `(accepted/required)*100` | 20 | 20 |
| Pre-assessment | `pre_assessment_score` | 0–100 percent | **not in /100** | 0 | 0 |
| Post-assessment | `post_assessment_score` | 0–100 percent | used as 0–100 directly | 20 | 20 |
| Professional / behavior | 10 criteria × 1–5 | 0–50 | `(total/50)*100` | 40 | 40 |
| Hours | attendance durations and/or stored hours | hours | **eligibility + professional criterion 5/9**, not a direct /100 term | 0 | 0 |
| Task grades | `manual_score/max_score` | 0–100 avg | **professional criteria 1–4, 9 only** | 0 (direct) | 0 (direct) |
| Late tasks | `is_late` | count | professional criterion 9 on-time metric only | 0 (direct) | 0 (direct) |

### Classification of every possible input

| Input | Classification |
|---|---|
| Attendance % | **USED_IN_SCORE** (20%) + **ELIGIBILITY_ONLY** (80% gate) |
| Completed training hours | **ELIGIBILITY_ONLY** (140h on opportunity A) + professional criteria 5/9 |
| Absences | **DISPLAY_ONLY** / professional criterion 5 evidence; % already excludes them |
| Tasks completion (accepted count) | **USED_IN_SCORE** (20% completion ratio) + scoring gate (all required must be accepted) |
| Task grades | **USED_IN_SCORE** only inside professional 1–5 mapping, **not** the 20% tasks term |
| Task completion UI (pending/submitted) | **DISPLAY_ONLY** (progress badge counts pending; scoring does not) |
| Late submissions | professional criterion 9 only — **not** the 20% tasks term |
| Pre-assessment | **DISPLAY_ONLY** / access-control to start training; weak professional criterion 3 input; **not** eligibility; **not** /100 |
| Post-assessment completion | **ELIGIBILITY_ONLY** |
| Post-assessment score | **USED_IN_SCORE** (20%) + **ELIGIBILITY_ONLY** (must be ≥ 80 on opportunity) |
| Professional evaluation total | **USED_IN_SCORE** (40%) |
| Behavior / supervisor ratings | **USED_IN_SCORE** via criteria 3,4,6,7,8,10 (and bulk fill) |
| Excel academic-supervisor import | supervisor **name** assignment — **NOT_USED** in /100 |
| Administrative bulk rating | **USED_IN_SCORE** when applied; fills missing behavioral criteria with **5/5**, not 7–9 |
| Final evaluation total (`final_score`) | the output, not an input |
| Assessment `passing_score` (pre 50 / post 60) | **NOT_USED** by eligibility or /100 (opportunity min post 80 is used instead) |

---

## 5. Attendance Logic

**File:** `fieldTraining.workflow.js` → `calculateAttendancePercentage`

```
attended = count(required sessions with status in {present, late, excused})
total    = count(opportunity sessions where is_required = true)
attendance% = round(attended / total * 100, 2)
```

Unmarked required sessions count as not attended (they inflate the denominator). Absent does not count as attended.

### Opportunity A sessions (all required)

| Session | Date | Time | Duration |
|---|---|---|---|
| المحاضرة التعريفية | 2026-07-19 | 10:00–12:00 | 2h |
| 2 | 2026-07-23 | 10:00–12:00 | 2h |
| 3 | 2026-07-25 | 10:00–12:00 | 2h |
| 4 | 2026-07-30 | 10:00–12:00 | 2h |
| 5 | 2026-08-01 | 10:00–12:00 | 2h |
| 6 | 2026-08-08 | 10:00–12:00 | 2h |
| 7 | 2026-08-15 | 10:00–16:00 | 6h |
| 8 | 2026-08-20 | 10:00–14:00 | 4h |
| **Total if 8/8 attended** | | | **22 hours** |

Observed on Opportunity A: **every approved student has attendance_percentage = 100** (8/8). Attendance is therefore not currently differentiating anyone.

### Does attendance contribute to /100?

**Yes.** Attendance% is the 20-point component (raw 100 → +20).

### Is attendance an independent eligibility gate?

**Yes.** Opportunity A `minimum_attendance_percentage = 80`. Workflow and scoring gates both fail if attendance < 80 or is null.

Hours are a **separate** gate. Full session attendance only produces **22 hours**, which is far below the 140-hour requirement. Students at 140 hours got there from stored/backfilled `completed_training_hours` (operation `FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1` is still visible in some `eligibility_reason.details`).

---

## 6. Task Logic

Opportunity A/B each have **4 required tasks**, all `grading_mode = MANUAL`, **none marked `is_final_task`**. Opportunity `requires_final_task = false`.

| Task | Final? | Required? |
|---|---|---|
| المهمة الأولى: تصميم قاعدة بيانات متجر إلكتروني باستخدام Neon PostgreSQL | no | yes |
| المهمة الثانية: REST API Node.js / Express / Neon / Postman | no | yes |
| المهمة الثالثة: تأمين REST API | no | yes |
| المهمة الرابعة: واجهة متجر React متجاوبة | no | yes |

### Two different “completed” definitions

| Surface | Counts as done |
|---|---|
| UI / reports task progress (`fieldTraining.taskProgress.js`) | `pending`, `submitted`, `under_review`, `graded`, `approved` |
| Scoring accepted count (`ACCEPTED_TASK_STATUSES`) | **`approved` and `graded` only** |
| Workflow eligibility | **does not require all tasks** because `requires_final_task = false` |

Current logic uses **both** completion and grades, but for different things:

- **/100 tasks 20%:** completion ratio only (`accepted/required`), **not** grades
- **Professional criteria 1,2,3,4,9:** task quality average and completion metrics
- **Late tasks:** criterion 9 on-time metric only; 88/151 students have at least one late accepted task; late does not reduce the 20% tasks term

On Opportunity A:

- 65 students have `accepted < 4`
- 60 of those are still stored **eligible**
- those 60 have **null Final Score** because the scoring gate `REQUIRED_SUBMISSION_MISSING` fires

So tasks **do** contribute numerically to /100 when all four are accepted, and they **block** /100 when they are not — but they **do not** block completion eligibility on Tafila.

---

## 7. Pre-Assessment Logic

| Question | Current actual behavior |
|---|---|
| Required to start training? | **Yes**, if `requires_pre_assessment = true` (Tafila: true). Approval → `pre_assessment_pending`. Post-assessment is blocked while still pending. |
| Required for completion eligibility? | **No.** `calculateFieldTrainingEligibility` does not read pre-assessment. |
| Part of /100? | **No.** Weight 0. |
| Used as completion status only? | Score is stored (`pre_assessment_score`, 0–100%) and shown in UI/reports. |
| Compared against post? | `calculateFinalEvaluation` stores `improvementPercentage = post − pre` for the snapshot. The professional “improvement metric” actually returns **post score** when both exist (`performanceSnapshot.improvementMetric`), not the delta. |
| Historical backfill | `FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1` required a submitted pre attempt before forcing hours=140 and eligible. That was a one-time write, not the live engine. |
| Assessment passing_score | Pre assessment row `passing_score = 50`. **Not enforced** for eligibility or /100. |

Opportunity A: 1 student missing pre (`Layan Aljamal`, still `pre_assessment_pending`).

---

## 8. Post-Assessment Logic

| Question | Current actual behavior |
|---|---|
| Completion mandatory for eligibility? | **Yes** (`requires_post_assessment = true`) |
| Score matters for eligibility? | **Yes** — opportunity `minimum_post_assessment_score = 80` |
| Contributes to /100? | **Yes**, 20% (raw post percent) |
| Scoring-gate passing threshold? | Scoring only requires post **not null**. It does **not** apply the 80 minimum. |
| Assessment passing_score | Post assessment row `passing_score = 60` — **not used** by eligibility or /100 |
| If missing | Workflow: `post_assessment_missing` → ineligible. Scoring: `POST_ASSESSMENT_NOT_COMPLETED` → `final_score = null` |

Score is stored as **percent /100** (`workflowService.submitAssessment` writes `scorePercent` onto the application).

Opportunity A: 4 students missing post; 7 with post < 80; **6 of those 7 are still stored eligible** (stale vs live workflow).

---

## 9. Behavior / Professional Evaluation

10 criteria, each 1–5, total **50**. Professional% = total/50×100.

| # | Meaning | Typical source |
|---|---|---|
| 1 | Work efficiency | derived: task completion 40 + task quality 40 + post 20 |
| 2 | Accuracy | derived: quality 70 + completion 30; −5 per rejected task (cap 20) |
| 3 | Thinking / initiative | supervisor `thinkingAndInitiative` or derived from post/quality/improvement |
| 4 | Problem solving | supervisor `problemSolving` or derived |
| 5 | Attendance commitment | derived: attendance 70 + hours 30 (or attendance band 1–5) |
| 6 | Teamwork | supervisor only |
| 7 | Professional conduct / appearance | supervisor only |
| 8 | Supervisor cooperation | supervisor only |
| 9 | Required tasks | derived: completion 60 + hours 25 + on-time 15 |
| 10 | Rules compliance | supervisor `rulesCompliance` or derived attendance/discipline |

If `professionalEvaluationRequired = true` (default) and any of the 10 is null, Professional% is null and the 40% term is omitted from /100 (renormalize). Incomplete professional ratings **do not** fail workflow eligibility. Scoring also does **not** add `PROFESSIONAL_EVALUATION_INCOMPLETE` as a gate (explicitly independent).

### ADMINISTRATIVE_FALLBACK_7_9

**Does not exist** under that name.

Closest mechanism: `MANUAL_AUTHORIZED_BULK_RATING` in `fieldTrainingEvaluation.bulkRating.js`.

- Applies only to students already `ELIGIBLE`
- Fills missing criteria **3, 4, 6, 7, 8, 10**
- Proposed score is **5 / 5**, not 7–9
- Arabic reason: `اعتماد إداري للبنود المهنية الناقصة للطالب المؤهل`

On Opportunity A: 144/151 students have supervisor ratings (`usesManualRating = true`, `ratingsComplete = true`). That is consistent with bulk/supervisor fill of the six behavioral fields.

1–5 mapping of 0–100 metrics uses:

```
90–100 → 5
80–89.99 → 4
70–79.99 → 3
60–69.99 → 2
0–59.99 → 1
```

Attendance bands for criterion 5 (if hours metric unavailable) are stricter (98+ → 5, …, <80 → 1).

---

## 10. Current Threshold

| Layer | Value | Meaning |
|---|---|---|
| Expected business threshold | **80 / 100** | intended Final Score qualification (this audit does not implement it) |
| Opportunity A `minimum_attendance_percentage` | **80** | attendance gate |
| Opportunity A `minimum_post_assessment_score` | **80** | post-assessment gate |
| Opportunity A `required_training_hours` | **140** | hours gate |
| Evaluation policy table (Tafila) | **no row** | |
| Code / schema default `minimumPassingScore` | **60** | PASSED vs FAILED after scoring gates |
| Frontend new-opportunity default attendance | **80** | `AdminFieldTrainingPage.jsx` |
| Frontend evaluation policy editor | displays/saves `minimumPassingScore` | currently unused for Tafila (no policy row) |
| Effective runtime qualification for letters | **not a score threshold** | workflow gates only |
| Effective runtime PASSED label | **60** if a Final Score exists | no Tafila student with a score is below 87.2, so 60 is currently invisible |

### Result

**Expected Business Threshold:** 80/100  

**Current Runtime Threshold:**

- Completion eligibility: **no Final Score threshold**
- Evaluation PASSED/FAILED: **60/100** (default)
- Closest live “80” gates: attendance 80% and post-assessment 80

**QUALIFICATION_THRESHOLD_MISMATCH**

---

## 11. Score vs Eligibility

The current system does **not** use `Final Score >= threshold` as the only (or even a) condition for completion eligibility.

Exact Boolean used by `calculateFieldTrainingEligibility` for Tafila Opportunity A:

```
eligible =
    NOT expelled
AND training_status ≠ 'failed'
AND attendance% ≥ 80
AND completedHours ≥ 140
AND post_assessment_score ≠ null
AND post_assessment_score ≥ 80
```

Tasks, pre-assessment, professional ratings, and Final Score are **not** in this Boolean.

Scoring gates (which only control whether `/100` is computed) are stricter on tasks:

```
scoringGatesPass =
    hours ≥ 140 (if requiredHours set)
AND attendance% ≥ policy minimum (80)
AND acceptedTasks ≥ requiredTasks          ← 4/4 approved|graded
AND post_assessment_score ≠ null           ← no 80 floor
```

Official evaluation PDF `eligibility_status` **prefers the stored workflow status**, then copies scoring `finalStatus` only if that stored status is ELIGIBLE (`fieldTrainingEvaluation.service.js` `buildOfficialComment` + generate persist).

---

## 12. Decision Flow

Traced from code, not invented.

### A. Completion eligibility refresh (`persistEligibility`)

Called after post-assessment submit, some task/final-task paths, attendance window updates, start-training, and manual “recalculate eligibility”. **Not** called by the hours-update endpoint (comment in `workflowService` still says hours are not a gate, which is stale relative to `calculateFieldTrainingEligibility`).

1. Load application + opportunity + task submissions  
2. If expelled → ineligible  
3. If `training_status = failed` → ineligible  
4. Compare stored/live attendance% to `opportunity.minimum_attendance_percentage`  
5. If `required_training_hours` set: `calculateHoursProgressForApplication` (attendance minutes merged with stored hours; completed ≥ required)  
6. If `requires_post_assessment`: require score; if `minimum_post_assessment_score` set, require score ≥ that value  
7. If `requires_final_task` and a final task exists: require submitted / not rejected / not pending review *(Tafila: skipped, flag is false)*  
8. Optional `completion_rules.manual_review_required` → `needs_review`  
9. Persist `completion_eligibility_status` + `eligibility_reason`; if eligible and not terminal, set `training_status = eligible_for_completion`

### B. Final Score / evaluation generate

1. `loadBatchContext` (applications, tasks, submissions, attendance, ratings, policy)  
2. Build `scoringInput`  
3. `getActivePolicy(universityId)` → Tafila miss → `DEFAULT_POLICY`; overlay opportunity required hours if policy hours null  
4. `calculateFinalEvaluation` → gates, professional criteria, weighted /100  
5. Official eligibility text/status taken from **stored** `completion_eligibility_status`  
6. Persist snapshot (`final_score` may be null even when official status is ELIGIBLE)

### C. Completion letter

`fieldTraining.completionLetter.service.js` requires `completion_eligibility_status === 'eligible'`. It does not read Final Score.

---

## 13. Opportunity Overrides

Tafila has **no** `field_training_evaluation_policies` row. Scoring weights/pass-score are global defaults. Opportunity columns override workflow gates.

| Setting | Global default | Tafila Opportunity A | Tafila Opportunity B | Effective A |
|---|---|---|---|---|
| Required hours | policy `null` | **140** | `null` | **140** |
| Required attendance | 80% | **80** | **80** | **80%** |
| Minimum final score | policy **60** | n/a | n/a | **60 PASSED** (not used for letters) |
| Pre required | opportunity default true | **true** | **true** | true (start-of-training only) |
| Post required | true | **true** | **true** | true |
| Post minimum score | opportunity null | **80** | **80** | **80** (workflow only) |
| Final task required | opportunity default true | **false** | **false** | false |
| Task requirements | scoring `requiredTasksRequired: true` | 4 required, 0 final | 4 required, 0 final | scoring wants 4/4 accepted; workflow does not |
| Professional required | true | no override | no override | true for Professional% completeness |
| Score weights | 20 / 20 / 20 / 40 | none | none | **20 att / 20 tasks / 20 post / 40 professional** |

---

## 14. Student-Level Results

Headline counts below are **Opportunity A (published, 151 approved)**. Opportunity B is listed after the main table.

### Opportunity A summary

| Status | Count |
|---|---|
| Stored eligible | 146 |
| Stored ineligible | 5 |
| Pending / needs_review | 0 |
| Training `completed` | 147 |
| `post_assessment_pending` | 3 |
| `pre_assessment_pending` | 1 |
| Attendance 100% | 151 / 151 |
| Hours 140 | 147 (4 remain at 22h attendance-derived only) |
| Pre missing | 1 |
| Post missing | 4 |
| Post < 80 | 7 (6 still stored eligible) |
| Tasks 4/4 accepted | 86 |
| Tasks < 4 accepted but stored eligible | 60 |

Columns in the student tables:

- Status = stored `completion_eligibility_status` (what the product currently shows)
- Final Score stored / calc = current evaluation snapshot vs in-memory `calculateFinalEvaluation` (no writes)
- Hours = scoring merged hours (max of stored and attendance-derived)
- Tasks = accepted (`approved`/`graded`) / required
- Live workflow = what `calculateFieldTrainingEligibility` would return now without persisting

---

## 15. Score Reconstruction Samples

Authoritative calculator: `calculateFinalEvaluation` with `DEFAULT_POLICY` (20/20/20/40) and Opportunity A required hours = 140.

When scoring gates fail, **Calculated Score = null** by design. Hypothetical weighted sums below are shown only to explain components; they are **not** stored.

### Eligible sample 1 — فاروق محمد فاروق عبيدات (`320230603015`)

| Component | Raw value | Normalization | Weight | Contribution |
|---|---|---|---|---|
| Attendance | 100% (8/8) | 100 | 20 | 20 |
| Tasks | 4/4 accepted | 100 | 20 | 20 |
| Post | 100 | 100 | 20 | 20 |
| Professional | 50/50 | 100 | 40 | 40 |

Calculated Score: **100**  
Stored Score: **100**  
Difference: **0**

### Eligible sample 2 — تالين خالد احمد المزايدة (`320220603206`)

| Component | Raw value | Normalization | Weight | Contribution |
|---|---|---|---|---|
| Attendance | 100 | 100 | 20 | 20 |
| Tasks | 4/4 | 100 | 20 | 20 |
| Post | 100 | 100 | 20 | 20 |
| Professional | 49/50 | 98 | 40 | 39.2 |

Calculated Score: **99.2**  
Stored Score: **99.2**  
Difference: **0**

### Eligible sample 3 — انس حسن محمود محمد (`320220603203`)

| Component | Raw value | Normalization | Weight | Contribution |
|---|---|---|---|---|
| Attendance | 100 | 100 | 20 | 20 |
| Tasks | 4/4 | 100 | 20 | 20 |
| Post | 92 | 92 | 20 | 18.4 |
| Professional | 47/50 | 94 | 40 | 37.6 |

Calculated Score: **96**  
Stored Score: **96**  
Difference: **0**

Among students for whom scoring gates currently pass, stored `final_score` matches the live formula (difference 0). 86/86 numeric scores reconstructed cleanly.

### Not-eligible sample 1 — ليث محمد احمد بريوش (`320230601066`)

Stored ineligible reason: `post_assessment_below_minimum` (post **72** < 80).  
Scoring gates also fail: tasks 2/4 accepted → `REQUIRED_SUBMISSION_MISSING`.  
Professional incomplete (criteria 6–8 null) so 40% term omitted.

| Component | Raw | Notes |
|---|---|---|
| Attendance | 100 | would be 20 if gates passed |
| Tasks | 50 | 2/4 |
| Post | 72 | below opportunity min 80 |
| Professional | null | incomplete |

Calculated Score (authoritative): **null**  
Stored Score: **null**  
Difference: **0**

### Not-eligible sample 2 — Layan Aljamal (`320250602134`)

`pre_assessment_pending`. Hours 22/140. Post missing. Tasks 0/4. Attendance 100% (8/8) but that only yields 22h.

Scoring reasons: `REQUIRED_HOURS_NOT_COMPLETED`, `REQUIRED_SUBMISSION_MISSING`, `POST_ASSESSMENT_NOT_COMPLETED`.

Calculated Score: **null**  
Stored Score: **null**  
Difference: **0**

### Not-eligible sample 3 — محمد محمود محمد حسين (`320220603075`)

Pre 88, post missing, hours 22, tasks 0/4, attendance 100%. Same scoring gates as sample 2.

Calculated Score: **null**  
Stored Score: **null**  
Difference: **0**

---

## 16. Inconsistencies

Detected, not fixed.

1. **QUALIFICATION_THRESHOLD_MISMATCH** — business expects Final Score ≥ 80; runtime eligibility ignores Final Score; PASSED uses 60.
2. **Two engines** — workflow eligibility vs scoring gates vs stored evaluation `final_status`. Example: هاشم زيد عبدالحي الخلايلة is stored `eligible`, evaluation `eligibility_status = ELIGIBLE`, but `final_status = NOT_ELIGIBLE` and `final_score = null` because only 1/4 tasks are accepted.
3. **60 stored-eligible students have no Final Score** because scoring requires 4/4 `approved|graded` while workflow does not require tasks (`requires_final_task = false`).
4. **6 stored-eligible students fail live post ≥ 80** (stale status, several still tagged with `FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1` in `eligibility_reason.details`):
   - حسن علي عيد حمدوني — post 68, stored score 89.6, still eligible
   - عمر جهاد محمود جبريل — post 64, stored score 87.2
   - ظفار جعفر حسن الصرايره — post 64, stored score 88
   - حمزه محمود جبريل الرواجفه — post 72, score null (3/4 tasks)
   - زيد مامون تيسير حسين — post 76, score null (2/4)
   - BAHA'A ALDEEN ABU-FARASH — post 36, score null (2/4)
5. **Scoring does not apply post ≥ 80**, so حسن/عمر/ظفار still receive numeric /100 and PASSED.
6. **Hours vs sessions** — 8 required sessions = 22h; eligibility requires 140h. Almost everyone at 140h is stored/backfilled, not attendance-derived.
7. **Hours update endpoint does not refresh eligibility**, despite hours being a live workflow gate.
8. **Task progress UI vs scoring** — pending/submitted count as progress; scoring only accepts approved/graded.
9. **Post assessment `passing_score = 60` vs opportunity min 80** — two different “pass” numbers.
10. **No Tafila evaluation policy row** — weights/pass-score cannot be university-tuned without creating one; UI editor would write a new policy if used.
11. **Duplicate opportunity B** — same title, 0 sessions, 10 stale eligible, 0 evaluations.
12. **Frontend / backend display split** — student eligibility tab never shows `/100`; evaluation reports page shows stored `/100` only.
13. **Excel students sheet** does not export numeric Final Score; it exports PASSED/FAILED/NOT_ELIGIBLE from the evaluation snapshot, which can say NOT_ELIGIBLE while application status is eligible.
14. **Professional completeness** can null the 40% term and renormalize /100; not currently an eligibility gate.
15. No `ADMINISTRATIVE_FALLBACK_7_9`. Bulk fill uses **5/5**.
16. Opportunity `university_id` is null; university is only via eligibility rows. Policy lookup still resolves through those rows (`resolveOpportunityUniversityId`).

No stored numeric score disagreed with the current formula when gates pass (expected difference 0 — confirmed).

---

## 17. Current vs Proposed 20/20/40/20 Model

**CURRENT FORMULA (live, not changed):**

```
Attendance            20   ← attendance % of required sessions
Post Assessment       20   ← post percent
Tasks                 20   ← accepted/required count, NOT grades
Behavior/Professional 40   ← 10 criteria /50 → %
```

Pre-assessment: not in formula.  
Hours: eligibility gate + professional criteria, not a direct /100 term.

**PROPOSED FUTURE FORMULA — NOT IMPLEMENTED:**

```
Attendance            20
Post Assessment       20
Tasks                 40
Behavior              20
```

### What would change if it were applied later

| Topic | Current | Proposed |
|---|---|---|
| Task weight | 20% completion ratio | 40% — **must define** completion vs grades vs both |
| Behavior weight | 40% (10×5) | 20% |
| Post weight | 20% | 20% (unchanged numerically) |
| Attendance weight | 20% | 20% (unchanged numerically) |
| Qualification | not score-based; post≥80 and hours≥140 and attendance≥80 | if 80/100 becomes the rule, letters would start depending on /100 |
| Students with 4/4 tasks and high professional | currently boosted by 40% professional (many 98–100) | professional impact halves; incomplete tasks would hurt twice as much |
| 60 eligible students with <4 accepted tasks | currently eligible with **null** /100 | a 40% tasks term would make missing tasks dominate any future score |
| Post < 80 but high professional (e.g. حسن 68 post, 89.6 final) | can still have /100 ≥ 80 and stored eligible | lower behavior weight + possible 80/100 rule would likely fail them |

This audit does **not** apply that formula.

---

## 18. Recommended Next Changes — DO NOT IMPLEMENT

These are recommendations only.

1. Decide which engine is canonical for “مؤهل”: workflow status, scoring gates, or `Final Score ≥ 80`.
2. If the business rule is 80/100, add it as an explicit eligibility gate and set Tafila `minimumPassingScore` / policy weights in `field_training_evaluation_policies` — currently 60 and 20/20/20/40.
3. If implementing 20/20/40/20, specify whether the 40% tasks term is completion, grades, or a blend (today it is completion-only).
4. Reconcile opportunity post min **80** with assessment `passing_score` **60** and with scoring (which ignores the 80).
5. Recalculate stored eligibility for the 6 stale post<80 eligible students (do not silently keep backfill status).
6. Decide whether all 4 tasks are mandatory for eligibility (today: no) or only for /100 (today: yes).
7. Align task-progress UI statuses with scoring accepted statuses, or show both.
8. Either make 8 sessions produce 140 hours, or stop treating session attendance as 100% “full training time” while hours stay at 22 unless backfilled.
9. Call `persistEligibility` after hours updates.
10. Archive or merge Opportunity B so it cannot show 10 false-eligible students with 0 sessions.
11. There is no 7–9 administrative fallback; if that was expected, it was never implemented (bulk fill is 5/5).

---

## Appendix A — Opportunity A student table (151 approved)

Live read of stored fields plus in-memory reconstruction. Nothing in this table was written back.


| Student Name | University Number | Status | Training Status | Final Score stored | Final Score calc | Attendance % | Hours | Tasks accepted/required | Submitted | Pre | Post | Professional /50 | Eval status | Live workflow | Eligibility reasons |
|---|---|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|---|
| ابراهيم خضر احمد الحوامدة | 320230603020 | eligible | completed | 94.4 | 94.4 | 100 | 140 | 4/4 | 4 | 92 | 84 | 47 | PASSED | eligible | — |
| إبراهيم عطاالله إبراهيم الشباطات | 320220605261 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| إبراهيم محمود احمد كرجغلي | 320220605111 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| اجياد ياسين عبدالحميد العمرو | 320220605165 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| احمد ابراهيم عدنان ابوزيد | 320220605251 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| احمد خليل احمد النعيمات | 320220603242 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 100 | 48 | PASSED | eligible | — |
| احمد رائد محمد البريقي | 320220605218 | eligible | completed | — | — | 100 | 140 | 2/4 | 4 | 92 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| احمد عاطف محمد كامل ابو رجب التميمي | 320220602016 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| احمد عبد الرؤوف احمد المغربي | 320220602070 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 92 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| احمد عطيه عقل الوليدي | 320220602037 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| احمد منير منصور مغايرة | 320220605228 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 80 | 100 | 49 | PASSED | eligible | — |
| اسامة حسام شكري شحادة | 320230602075 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| اسراء احمد ماجد مراشده | 320230602116 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| اصيل احمد عبد الكريم السكارنة | 320220602035 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 84 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| القاسم مناور احمد العميريين | 320220605065 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| المعتز بالله محمود المبيض | 320220603015 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| امجد احمد عادل زيد الكيلاني | 320220605020 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 96 | 46 | NOT_ELIGIBLE | eligible | — |
| امينا اشرف احمد الفريحات | 320220605206 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 96 | 49 | PASSED | eligible | — |
| انس حسن محمود محمد | 320220603203 | eligible | completed | 96 | 96 | 100 | 140 | 4/4 | 4 | 88 | 92 | 47 | PASSED | eligible | — |
| اية تركي محمد الخوالده | 120220612060 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 92 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| ايه إسماعيل عيسى حيمور | 320240603003 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 96 | 50 | PASSED | eligible | — |
| أيهم عماد عبدالرحمن ابوالرب | 320240605129 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| ايهم فيصل احمد زعارير | 320240605125 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| باتر محمد عوض الله ابو الحاج | 320220603199 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 80 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| بتول عمار ياسر السكافي | 320230602014 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| براءه خالد الشمايله | 320220603220 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| بشار عثمان محمد الوحيدي | 320230602006 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| تالين خالد احمد المزايدة | 320220603206 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| تامر وائل نواف العلص | 320220603026 | eligible | completed | — | — | 100 | 140 | 0/4 | 4 | 92 | 100 | 35 | NOT_ELIGIBLE | eligible | — |
| ثائر علي محمد الشماسين | 320230602065 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| جميله سميح ماجد القطيطات | 320230605012 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 80 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| جود احمد محمد ابو علي | 320220603066 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 92 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| حسن علي عيد حمدوني | 320210601046 | eligible | completed | 89.6 | 89.6 | 100 | 140 | 4/4 | 4 | 92 | 68 | 45 | PASSED | ineligible | post_assessment_below_minimum |
| حمدالله انور حمدالله عيسى | 320220603007 | ineligible | post_assessment_pending | — | — | 100 | 22 | 0/4 | 0 | 88 | — | — | NOT_ELIGIBLE | ineligible | training_hours_incomplete, post_assessment_missing |
| حمزة خالد سليمان سعيد | 320220605124 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| حمزه صدام احمد عبيدات | 320220605162 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 100 | 100 | 50 | PASSED | eligible | — |
| حمزه محمود جبريل الرواجفه | 320220603189 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 72 | 42 | NOT_ELIGIBLE | ineligible | post_assessment_below_minimum |
| دانه جواد احمد الغنيمات | 320220605227 | eligible | completed | — | — | 100 | 140 | 2/4 | 3 | 88 | 100 | 42 | NOT_ELIGIBLE | eligible | — |
| رامي صلاح عبد الرحمن الجرابعة | 320220605255 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| رؤى عبدالله محمود مغربي | 320230602046 | eligible | completed | 96 | 96 | 100 | 140 | 4/4 | 4 | 88 | 92 | 47 | PASSED | eligible | — |
| رنا مأمون الحجاج | 320220605060 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| رنيم علي تركي الربابعه | 320230605016 | eligible | completed | — | — | 100 | 140 | 2/4 | 2 | 84 | 100 | 42 | NOT_ELIGIBLE | eligible | — |
| روان صلاح الدين علي نايفه | 320230601062 | eligible | completed | — | — | 100 | 140 | 2/4 | 4 | 84 | 100 | 42 | NOT_ELIGIBLE | eligible | — |
| رويد جمال عبداللطيف فوده | 320210601146 | eligible | completed | — | — | 100 | 140 | 0/4 | 4 | 88 | 100 | 35 | NOT_ELIGIBLE | eligible | — |
| ريما عادل طارق محمود | 320250603244 | ineligible | post_assessment_pending | — | — | 100 | 22 | 0/4 | 0 | 60 | — | — | NOT_ELIGIBLE | ineligible | training_hours_incomplete, post_assessment_missing |
| زيد عمر محمد الجواودة | 320230602147 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 80 | 100 | 49 | PASSED | eligible | — |
| زيد مامون تيسير حسين | 320210601043 | eligible | completed | — | — | 100 | 140 | 2/4 | 2 | 88 | 76 | 37 | NOT_ELIGIBLE | ineligible | post_assessment_below_minimum |
| سامي عاصم حسن الصالحي | 320230602073 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| شهد حسين فالح الزواهرة | 320220605259 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| شهد عبدالوهاب عبدالحميد المحيسن | 320220601007 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| شيماء محمد ابراهيم العطيوي | 320220605048 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| صبا اشرف عبد الله الدهني | 320220603156 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| صبحي عبدالمهدي صبحي دار مصلح | 320220603123 | eligible | completed | — | — | 87.5 | 140 | 2/4 | 4 | 88 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| صهيب احمد محمد خضر | 320220603017 | eligible | completed | — | — | 100 | 140 | 0/4 | 2 | 88 | 88 | 33 | NOT_ELIGIBLE | eligible | — |
| صهيب عصام علي العوده | 320220605212 | eligible | completed | 96 | 96 | 100 | 140 | 4/4 | 4 | 88 | 92 | 47 | PASSED | eligible | — |
| ضياء الدين ابراهيم عبد السلام ابو علي | 320220605231 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| ظفار جعفر حسن الصرايره | 320230605007 | eligible | completed | 88 | 88 | 100 | 140 | 4/4 | 4 | 84 | 64 | 44 | PASSED | ineligible | post_assessment_below_minimum |
| عاطف سيف عباس القطامين | 320210605021 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| عبادة احمد عبدالرحيم عبدالرحمن | 320220603207 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| عبادة عمر احمد ابو خضير | 320220603198 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| عبد الرحمن خضر يوسف خليل | 320210601097 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 84 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| عبد الرحمن محمد احمد هديب | 320220605041 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| عبد الكريم علي محمد حسن ابو سيف | 320220605004 | eligible | completed | 96.8 | 96.8 | 100 | 140 | 4/4 | 4 | 92 | 92 | 48 | PASSED | eligible | — |
| عبد المجيد اياد عبد المجيد الخطيب | 320220603233 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| عبدالرحمن خالد دخيل الله العساسفة | 320230602053 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 92 | 50 | PASSED | eligible | — |
| عبدالرحمن سرور عبدالقادر بني عامر | 320220605063 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| عبدالرحمن عماد خليل القطامين | 320230602055 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| عبدالرحمن ماهر عبدالرحمن عبدالغني | 320220603005 | eligible | completed | — | — | 100 | 140 | 2/4 | 2 | 80 | 92 | 41 | NOT_ELIGIBLE | eligible | — |
| عبدالله رائد سعيد عبد الغني | 320220603003 | eligible | completed | 97.6 | 97.6 | 100 | 140 | 4/4 | 4 | 76 | 92 | 49 | PASSED | eligible | — |
| عبدالله رائد سليمان قبج | 320230601004 | eligible | completed | — | — | 100 | 140 | 0/4 | 4 | 88 | 100 | 35 | NOT_ELIGIBLE | eligible | — |
| عبدالله غسان علي ابوخرمه | 320220602019 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| عبدالله محمود عايش أبوعواد | 320220605085 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 100 | 48 | PASSED | eligible | — |
| عروه مهند سليمان العمايره | 320230603002 | eligible | completed | — | — | 100 | 140 | 0/4 | 0 | 88 | 100 | — | NOT_ELIGIBLE | eligible | — |
| عريب احمد محمد المسعيدين | 320230602113 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| عز الدين ابراهيم يوسف قطوش | 320230602004 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 92 | 50 | PASSED | eligible | — |
| عُلا محمد عبد الرزاق الربيحات | 320220603213 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 72 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| عمر جهاد محمود جبريل | 320220603142 | eligible | completed | 87.2 | 87.2 | 100 | 140 | 4/4 | 4 | 88 | 64 | 43 | PASSED | ineligible | post_assessment_below_minimum |
| عمر مخلد خلف الزبون | 320210601081 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 80 | 96 | 50 | PASSED | eligible | — |
| عمر هاشم احمد القناص | 320230603022 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 88 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| عمرو خليل جمعة حمام | 320230605021 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| عمرو وليد عبد الفتاح الحتاوي | 320220603232 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| عيسى وائل يوسف عويمر | 320220605260 | eligible | completed | — | — | 100 | 140 | 2/4 | 4 | 88 | 92 | 39 | NOT_ELIGIBLE | eligible | — |
| غيداء خليل محمدحسن أبوسيف | 320240603015 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 96 | 49 | PASSED | eligible | — |
| فاروق محمد فاروق عبيدات | 320230603015 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| فراس عبدالإله نور الشباطات | 320230603013 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| فراس عيسى لياس زكاك | 320230602027 | eligible | completed | — | — | 100 | 140 | 2/4 | 3 | 84 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| فرح فايز ناجي العبادى | 320220603150 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 96 | 49 | PASSED | eligible | — |
| قتيبه فوزي طايع الزيادات | 320200603040 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| قصي عماد عبدالله عياش | 320220601004 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| لجين عزمي محمود العواودة | 320240603002 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 92 | 50 | PASSED | eligible | — |
| لما ابراهيم عبد الرزاق الرواجفه | 320210603079 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 92 | 50 | PASSED | eligible | — |
| ليث محمد احمد بريوش | 320230601066 | ineligible | completed | — | — | 100 | 140 | 2/4 | 2 | 84 | 72 | — | NOT_ELIGIBLE | ineligible | post_assessment_below_minimum |
| مؤنس ابراهيم علي السوالقة | 320230603005 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 96 | 100 | 49 | PASSED | eligible | — |
| متيم محمد سليم البراري | 320230605038 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 80 | 44 | NOT_ELIGIBLE | eligible | — |
| مثنى سليمان خليل العمايرة | 320220605131 | eligible | completed | — | — | 100 | 140 | 0/4 | 0 | 92 | 100 | — | NOT_ELIGIBLE | eligible | — |
| مجد بسام سالم الصعيدي | 320220605217 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| محمد إبراهيم مسلم شاهين | 320200601081 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 92 | 45 | NOT_ELIGIBLE | eligible | — |
| محمد أشرف عبد الحافظ البكار | 320230602018 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| محمد رياض احمد القناص | 320220605160 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| محمد سامح محمد الضروس | 320220603209 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 80 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| محمد عبدالمولى محمد اجويعد | 320230602067 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| محمد فايز نمر جسين | 320220603217 | eligible | completed | 96 | 96 | 100 | 140 | 4/4 | 4 | 88 | 92 | 47 | PASSED | eligible | — |
| محمد محمود محمد حسين | 320220603075 | ineligible | post_assessment_pending | — | — | 100 | 22 | 0/4 | 0 | 88 | — | — | NOT_ELIGIBLE | ineligible | training_hours_incomplete, post_assessment_missing |
| محمد مروان محمود ابراهيم | 320220603067 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| محمود احمد محمود الترعاني | 320220603099 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 96 | 46 | NOT_ELIGIBLE | eligible | — |
| محمود تيسير احمد الغوانمه | 320220605149 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| محمود محمد يوسف جوده | 320220605070 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 96 | 49 | PASSED | eligible | — |
| محيسن احمد عيد المريعات | 320230602096 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| مريم هايل يوسف الهوامله | 320230603014 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 88 | 96 | 49 | PASSED | eligible | — |
| مصطفى سليم محمد عياد | 320220603052 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| مصعب عصام عبد الرحمن ابو هاني | 320230602003 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 92 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| مظفر عمر محمد المومني | 320220605157 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| منير محمد علي عمران | 320220603062 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 96 | 50 | PASSED | eligible | — |
| موسى رائد موسى الرواشده | 320200601069 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 96 | 49 | PASSED | eligible | — |
| ميساء مازن محمد السوالمة | 320230601021 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 96 | 50 | PASSED | eligible | — |
| نادر بشير مصطفى زريقات | 320230602002 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 80 | 100 | 50 | PASSED | eligible | — |
| نادين محمد يوسف أبو درويش | 320220602027 | eligible | completed | — | — | 100 | 140 | 2/4 | 3 | 84 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| نغم حابس سليم الشخانبه | 320220603105 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 84 | 100 | 49 | PASSED | eligible | — |
| نماء سعد خلف الحويطات | 320220603054 | eligible | completed | — | — | 100 | 140 | 2/4 | 2 | 92 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| نور ظافر عبدالله عبدالقادر | 320220605188 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 92 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| نورهان علي حمود الخوالده | 320230602066 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 92 | 50 | PASSED | eligible | — |
| هاشم زيد عبدالحي الخلايلة | 320220603012 | eligible | completed | — | — | 100 | 140 | 1/4 | 4 | 88 | 88 | 37 | NOT_ELIGIBLE | eligible | — |
| همسة اشتيوي الشرفاء | 320230602037 | eligible | completed | — | — | 100 | 140 | 2/4 | 3 | 92 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| يرين نضال نصيرات | 320210602057 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 84 | 96 | 49 | PASSED | eligible | — |
| يزن نادر محمد دبوس | 320220602065 | eligible | completed | — | — | 100 | 140 | 3/4 | 3 | 92 | 96 | 45 | NOT_ELIGIBLE | eligible | — |
| يوسف احمد حلمي الهرشه | 320230602024 | eligible | completed | 96 | 96 | 100 | 140 | 4/4 | 4 | 84 | 92 | 47 | PASSED | eligible | — |
| يوسف رياض يوسف | 320230601009 | eligible | completed | — | — | 100 | 140 | 0/4 | 3 | 92 | 84 | 33 | NOT_ELIGIBLE | eligible | — |
| يوسف علي يوسف ابو سرحان | 320220605258 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| يوسف معاذ يوسف سلمان | 320230603007 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 92 | 96 | 49 | PASSED | eligible | — |
| يونس جهاد يونس الجعبه | 320220603098 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 92 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| Abd alsalam abu Mahfuoz | 320220603170 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| Ahmad Mohamad | 320220605090 | eligible | completed | — | — | 100 | 140 | 0/4 | 3 | 84 | 96 | 34 | NOT_ELIGIBLE | eligible | — |
| Ahmad Mohammed Ahmad Soub | 320230602064 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 80 | 96 | 50 | PASSED | eligible | — |
| amro Mohisn | 320230602057 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 88 | 100 | 49 | PASSED | eligible | — |
| ann momani | 320230605005 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 96 | 50 | PASSED | eligible | — |
| BAHA'A ALDEEN ABU-FARASH | 21220019 | eligible | completed | — | — | 100 | 140 | 2/4 | 2 | 96 | 36 | 34 | NOT_ELIGIBLE | ineligible | post_assessment_below_minimum |
| Bahaa Aldahamsheh | 320220605075 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| Halaabuhmaid | 320220603068 | eligible | completed | — | — | 87.5 | 140 | 0/4 | 3 | 88 | 100 | 34 | NOT_ELIGIBLE | eligible | — |
| Layan Aljamal | 320250602134 | ineligible | pre_assessment_pending | — | — | 100 | 22 | 0/4 | 0 | — | — | — | NOT_ELIGIBLE | ineligible | training_hours_incomplete, post_assessment_missing |
| Mahmoud Aldarawish | 320220603024 | eligible | completed | 98.4 | 98.4 | 100 | 140 | 4/4 | 4 | 80 | 100 | 48 | PASSED | eligible | — |
| Mahmoud Omar Abu Najem | 320220605182 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 88 | 100 | 50 | PASSED | eligible | — |
| MANAR FARHAN MOHAMMAD ALARJAN | 320210602023 | eligible | completed | — | — | 100 | 140 | 2/4 | 4 | 92 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| Mayes Mohaamad2005 | 320230602062 | eligible | completed | 100 | 100 | 100 | 140 | 4/4 | 4 | 92 | 100 | 50 | PASSED | eligible | — |
| Mohammad Slaman Al-Qatameen | 320230603008 | eligible | completed | 97.6 | 97.6 | 100 | 140 | 4/4 | 4 | 92 | 92 | 49 | PASSED | eligible | — |
| MUAYAD HUSNI MAHMOUD NUSAIRAT | 320200602030 | eligible | completed | — | — | 100 | 140 | 2/4 | 4 | 92 | 100 | 41 | NOT_ELIGIBLE | eligible | — |
| Musallam abu seif | 320230605014 | eligible | completed | 96.8 | 96.8 | 100 | 140 | 4/4 | 4 | 88 | 92 | 48 | PASSED | eligible | — |
| Qasim Mohammad Ahmed hdaib | 320210603015 | eligible | completed | — | — | 100 | 140 | 1/4 | 4 | 88 | 100 | 40 | NOT_ELIGIBLE | eligible | — |
| Ragheb alla ragheb hamad | 320220603102 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 45 | NOT_ELIGIBLE | eligible | — |
| RASHA SALEM SULEIMANALKHAWALDEH | 320220602015 | eligible | completed | — | — | 100 | 140 | 3/4 | 4 | 88 | 100 | 46 | NOT_ELIGIBLE | eligible | — |
| SEIF NABIL MAHMOUD ELMUGHRABI | 320220603092 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |
| Yazan Jehad AbuTair | 320220603045 | eligible | completed | 99.2 | 99.2 | 100 | 140 | 4/4 | 4 | 92 | 100 | 49 | PASSED | eligible | — |

## Appendix B — Opportunity B student table (13 approved)

| Student Name | University Number | Status | Training Status | Final Score stored | Final Score calc | Attendance % | Hours | Tasks accepted/required | Submitted | Pre | Post | Professional /50 | Eval status | Live workflow | Eligibility reasons |
|---|---|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|---|
| يوسف رياض يوسف | 320230601009 | ineligible | expelled | — | — | — | — | 1/4 | 1 | 84 | — | — | — | ineligible | expelled |
| عزيزة جمال مسلم ابو سيف | 320230602050 | eligible | completed | — | — | — | 140 | 4/4 | 4 | 88 | 100 | — | — | ineligible | attendance_below_minimum |
| محمد أحمد عبد الرحيم المحيسن | 320230602103 | eligible | completed | — | — | — | 140 | 2/4 | 4 | 88 | 88 | — | — | ineligible | attendance_below_minimum |
| زيد جمال سلمان العمايرة | 320220603231 | eligible | completed | — | — | — | 140 | 3/4 | 3 | 88 | 100 | — | — | ineligible | attendance_below_minimum |
| خليل معن عيسى الزويد | 320220603074 | eligible | completed | — | — | — | 140 | 3/4 | 4 | 88 | 96 | — | — | ineligible | attendance_below_minimum |
| معتز محمد ناصر العتوم | 320220605050 | eligible | completed | — | — | — | 140 | 4/4 | 4 | 84 | 32 | — | — | ineligible | attendance_below_minimum, post_assessment_below_minimum |
| محمد محمود محمد حسين | 320220603075 | eligible | task_submitted | — | — | — | 140 | 0/4 | 1 | 92 | 100 | — | — | ineligible | attendance_below_minimum |
| قصي احمد محمد عوض | 320220603184 | eligible | completed | — | — | — | 140 | 2/4 | 4 | 92 | 92 | — | — | ineligible | attendance_below_minimum |
| محمد إبراهيم مسلم شاهين | 320200601081 | ineligible | expelled | — | — | — | — | 0/4 | 0 | 72 | — | — | — | ineligible | attendance_below_minimum, post_assessment_missing, final_task_not_submitted, expelled |
| احمد عماد جميل الشراري | 320230602013 | eligible | completed | — | — | — | 140 | 3/4 | 3 | 84 | 92 | — | — | ineligible | attendance_below_minimum |
| اوس جمال سلمان العمايره | 320220112026 | eligible | completed | — | — | — | 140 | 4/4 | 4 | 92 | 100 | — | — | ineligible | attendance_below_minimum |
| بدر حمود الرفوع | 320220605059 | eligible | completed | — | — | — | 140 | 3/4 | 3 | 92 | 72 | — | — | ineligible | attendance_below_minimum, post_assessment_below_minimum |
| يوسف علي يوسف ابو سرحان | 320220605258 | ineligible | expelled | — | — | — | — | 2/4 | 2 | 80 | — | — | — | ineligible | expelled |
