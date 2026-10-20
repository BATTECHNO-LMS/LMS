# EPROJECTO Field Training Journey, Readiness & Risk Report

**Execution:** LOCAL ONLY  
**Production modified:** NO  
**Database migration:** NONE (derived from existing domain models)  
**Suggested commit (not applied):** `feat: add field training journey readiness and intervention command center`

---

## 1. Existing architecture (reused)

| Concern | Canonical module |
|---|---|
| Score / components (20/20/40/20) | `fieldTraining.qualification` + `fieldTraining.qualification.service` + `fieldTraining.officialResult.service` |
| Policy / threshold | `fieldTraining.policy.service` → `resolveFieldTrainingPolicy` |
| Eligibility / qualification | Official result resolver + `completion_eligibility_status` |
| Hours (not scored) | `fieldTraining.hours` |
| Task progress | `fieldTraining.taskProgress` |
| Participant progress steps | `fieldTraining.progress.buildParticipantProgress` |
| Recorded lecture progress | `fieldTraining.recordedLectures.watch.service` + progress roster |
| RBAC / university / supervisor | `fieldTraining.access` + `fieldTraining.supervisorScope` |

**Non-negotiable scoring preserved:** Attendance 20 · POST 20 · Tasks 40 · Behavior 20 · Total 100. PRE and Hours are never scored.

---

## 2. Progress snapshot architecture

```
Domain data
  → buildParticipantProgress / official qualification / hours / tasks / lectures
  → resolveFieldTrainingReadiness
  → buildFieldTrainingJourney
  → resolveStudentNextAction
  → evaluateFieldTrainingRisk
  → Command Center aggregation API
  → React UI
```

**Files:**

- `backend/src/modules/fieldTraining/fieldTraining.readiness.js`
- `backend/src/modules/fieldTraining/fieldTraining.journey.js`
- `backend/src/modules/fieldTraining/fieldTraining.risk.js`
- `backend/src/modules/fieldTraining/fieldTraining.progressSnapshot.service.js`
- `backend/src/modules/fieldTraining/fieldTraining.commandCenter.service.js`

**Student API enrichment:** `GET .../student/field-training/:id/progress` returns `readiness`, `journey`, `next_action` via `enrichStudentProgressPayload`.

**Staff snapshot:** `GET .../field-training/applications/:applicationId/progress-snapshot`

**Command Center:** `GET .../field-training/:id/command-center` (admin + instructor routes)

---

## 3. Student Journey

- Dynamic milestones from opportunity configuration (PRE/POST/sessions/tasks/lectures/hours/behavior/letter only when applicable).
- States: `COMPLETED | CURRENT | UPCOMING | ACTION_REQUIRED | BLOCKED | OPTIONAL` with Arabic labels.
- Journey completion count is **not** the academic score.
- Actionable milestones navigate to student tabs (`assessments`, `tasks`, `recorded_lectures`, etc.).
- UI: `StudentTrainingJourney.jsx` + premium ivory/navy/champagne timeline SCSS.

---

## 4. Readiness Meter

- States: `NOT_READY | NEARLY_READY | READY | COMPLETED`
- Reason codes: `SCORE_BELOW_THRESHOLD`, `HOURS_INCOMPLETE`, `POST_NOT_COMPLETED`, `PRE_NOT_COMPLETED`, `TASKS_PENDING`, `BEHAVIOR_PENDING`, `ATTENDANCE_INCOMPLETE`, `APPLICATION_NOT_ACTIVE`, `TRAINING_NOT_STARTED`, `LETTER_PENDING`, …
- Visually separates **scored requirements** from **completion requirements** (hours as ساعات, PRE as مكتمل/غير مكتمل).
- Uses canonical eligibility / scorePassed — UI cannot show READY when eligibility says otherwise.
- Hours requirement and passing threshold are **dynamic** from opportunity/policy (default 80 only when policy says so).

---

## 5. Next action

Deterministic resolver `resolveStudentNextAction` prioritizes: expelled/failed → letter → PRE → POST → overdue tasks → tasks → hours → behavior → recorded lectures → legacy progress next_action.

---

## 6. Risk engine

`evaluateFieldTrainingRisk(application context)` returns:

- `riskLevel`: NONE | LOW | MEDIUM | HIGH | CRITICAL
- `signals[]` with Arabic explanations
- `primaryReason`, `recommendedAction`, `evaluatedAt`

**Implemented signals:**  
`LOW_ATTENDANCE`, `LOW_SCORE`, `MISSING_POST`, `TASKS_OVERDUE`, `MULTIPLE_TASKS_PENDING`, `NO_RECENT_ACTIVITY`, `HOURS_BEHIND_EXPECTED` (only when start/end schedule supports expectation), `RECORDED_LECTURE_NOT_STARTED`, `RECORDED_LECTURE_INCOMPLETE`, `BEHAVIOR_REVIEW_REQUIRED`, `EVALUATION_PENDING`, `COMPLETION_BLOCKED`

**False-positive protections:**

- Non-approved / expelled / failed → NONE
- READY/COMPLETED with only soft LOW noise cleared
- No fabricated hours-behind without schedule data
- Lecture risk only after ≥3 days availability
- Inactivity uses meaningful training timestamps (submissions, attendance, assessments, lecture watch, hours) — not login/SSE

Risk is **derived**, not persisted.

---

## 7. Supervisor Command Center

- Manage hub tab: **متابعة التدريب** (`command_center`)
- Attention KPI cards from full scoped population (pagination does not change KPIs)
- Filters: quick filters, risk level, readiness, risk reason, student search, sort allowlist
- Queue prioritized CRITICAL→HIGH→MEDIUM→LOW then urgency/name
- Row shows: student, risk, primary issue, readiness, score, hours, last activity, next action
- Detail drawer + links to existing eligibility / student report screens
- Groups: needs attention, near completion, ready to complete, blocked

**RBAC:** `assertManageOpportunityAccess` + university filter via `resolveApplicationStudentUniversityId` (unauthorized university → forbidden) + supervisor assignment where applicable. Students only see own progress via student routes.

**Performance:** Batch hours, task progress, qualifications, official results (`liveById` reuse), lecture progress, overdue tasks, attendance aggregates, activity `groupBy` — no per-student N+1 for a page of 50.

---

## 8. Recorded lecture integration

Journey + risk + command center consume published lecture progress (`progress_percent`, `completed_at`). No duplicated watch math.

---

## 9. Freshness

| Surface | Stale / refresh |
|---|---|
| Student progress / journey / readiness | stale 20s, refetch 30s |
| Command Center | stale 45s, refetch 60s |

Dashboard polling does not write training activity timestamps.

---

## 10. Student report

Comprehensive report payload includes `trainingProgressSummary` (readiness state, score components, hours completion requirements, blockers). Risk labels are not printed without reasons.

---

## 11. Tests

**Backend (Jest):** 14 passed

- `fieldTraining.readiness.unit.test.js`
- `fieldTraining.risk.unit.test.js`
- `fieldTraining.journey.unit.test.js`
- `fieldTraining.commandCenter.summary.unit.test.js`

**Frontend (node:test):** 2 passed

- `fieldTraining.journeyReadiness.ui.test.js`

---

## 12. Responsive QA (CSS / layout review)

| Width | Status | Notes |
|---|---|---|
| 375 | PASS | Journey cards stack; command rows column; drawer full width |
| 430 | PASS | Same |
| 768 | PASS | Readiness panels 2-col from 768; command row wraps |
| 1024 | PASS | Student intel grid 2-col |
| 1440 | PASS | KPI auto-fit grid |
| 1920 | PASS | Same |

No intentional horizontal overflow introduced in new SCSS.

---

## 13. Migration / indexes

- **Migration:** NONE
- Existing indexes on applications, tasks, submissions, attendance, lecture progress remain sufficient for opportunity-scoped aggregation.

---

## 14. Remaining gaps / next phase

- Global (cross-opportunity) command center list endpoint not required for opportunity manage hub; can be added later.
- Dedicated browser pixel QA on live devices not executed in this local pass (CSS responsive rules verified).
- Smart notifications phase can consume structured `risk.signals` / readiness reasons without new schema.

**Recommended next Field Training phase:**  
TRAINING LOGBOOK + EVIDENCE PORTFOLIO + SMART NOTIFICATIONS

---

## 15. Acceptance mapping (summary)

Canonical score/eligibility reused · Journey dynamic · Readiness explainable · Risk deterministic · Command Center operational · Pagination + summary KPIs · RBAC · No production deploy · No git commit.
