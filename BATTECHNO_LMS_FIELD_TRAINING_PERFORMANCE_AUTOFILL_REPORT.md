# BATTECHNO LMS — Field Training Performance Auto-Fill Report

**Date:** 2026-09-01  
**Opportunity:** جامعة مؤتة (`6c8783ec-49fd-428e-83e2-8b65e52c3b4f`)  
**Scope:** Derive evaluation scores from real LMS performance; preserve exact uploaded university DOCX template.

---

## 1. Performance Data Sources

| Metric | Source | Null when |
|--------|--------|-------------|
| `attendancePercentage` | `field_training_applications.attendance_percentage` | not recorded |
| `completedTrainingHours` | stored `completed_training_hours` OR derived attendance minutes | neither source resolves |
| `requiredTrainingHours` | opportunity policy / `required_training_hours` | not configured |
| `requiredTaskCount` | required tasks assigned to student (`is_required`, task progress module) | none |
| `acceptedTaskCount` | submissions with `approved` / `graded` on required tasks | — |
| `taskScoreAveragePercent` | graded accepted submissions `manual_score / max_score` | no graded submissions |
| `preAssessmentScore` / `postAssessmentScore` | application assessment fields | not completed |
| `supervisorRatings` | averaged `field_training_supervisor_ratings` rows | none saved |
| `onTimeSubmissionPercentage` | accepted submissions where `is_late = false` | not tracked |

**Single snapshot builder:** `buildFieldTrainingStudentPerformanceSnapshot()` in  
`backend/src/modules/fieldTraining/fieldTrainingEvaluation.performanceSnapshot.js`

---

## 2. Calculation Policy

### 0–100 → 1–5 thresholds (configurable via policy)

| Range | Score | Label |
|-------|-------|-------|
| 90–100 | 5 | ممتاز |
| 80–89.99 | 4 | جيد جداً |
| 70–79.99 | 3 | جيد |
| 60–69.99 | 2 | متوسط |
| <60 | 1 | ضعيف |

**Mapper:** `score100ToFivePoint()` — centralized in `fieldTrainingEvaluation.scoring.js`

### Criterion formulas (derived when no direct supervisor rating)

| # | Criterion | Formula |
|---|-----------|---------|
| 1 | Work efficiency | 40% task completion + 40% task quality + 20% post assessment (renormalized) |
| 2 | Accuracy | 70% task quality + 30% task completion; rejection penalty if rejected tasks exist |
| 3 | Thinking | Direct rating OR 50% post + 30% quality + 20% improvement |
| 4 | Problem solving | Direct rating OR 50% quality + 30% post + 20% completion |
| 5 | Attendance | 70% attendance + 30% hours completion (renormalized) |
| 6 | Teamwork | **Direct only** — never inferred from attendance/tasks |
| 7 | Appearance | **Direct only** |
| 8 | Supervisor cooperation | **Direct only** |
| 9 | Task completion | 60% tasks + 25% hours + 15% on-time (renormalized) |
| 10 | Rules compliance | Direct OR 60% attendance + 40% discipline (violations not tracked → attendance only) |

**Precedence:** `DIRECT_SUPERVISOR_RATING` overrides `DERIVED_FROM_PERFORMANCE`.

**Renormalization:** Missing optional components are excluded from weight — never treated as zero.

---

## 3. Readiness Categories

| Category | Meaning |
|----------|---------|
| `READY_AUTOMATIC` | All fields + 10 criteria complete from performance derivation |
| `READY_WITH_MANUAL_RATING` | Complete after authorized manual behavioral ratings |
| `MISSING_STATIC_DATA` | Identity/org/supervisor/hours gaps that cannot be derived |
| `MISSING_PROFESSIONAL_EVIDENCE` | Behavioral criteria 6/7/8 (and sometimes 3) need manual observation |
| `GENERATED` | Verified PDF exists for current template |

---

## 4. Mutah Live Results (104 approved students)

| Bucket | Count |
|--------|------:|
| Total analyzed | 104 |
| Ready with manual rating (existing ratings) | 5 |
| Missing professional evidence (need behavioral input) | 93 |
| Missing static/identity data | 6 |
| Fully automatic (zero manual) | 0* |

\*All Mutah students currently lack teamwork/appearance/supervisor-cooperation ratings in DB; 5 have partial supervisor history making them ready after dates are applied at generate time.

---

## 5. Regression — Omar محمد ثلجي المواجده (`120232222080`)

| Check | Result |
|-------|--------|
| Hours shown | **10** (real stored value — **not zero**) |
| Criterion 1–2,4,5,9,10 | Derived from real performance |
| Criterion 3 | **Missing** — no post assessment / task quality evidence |
| Criteria 6,7,8 | **Missing** — behavioral; requires manual rating |
| Professional total | **null** until behavioral criteria completed |
| Random scores | **NO** |
| Unknown → zero | **NO** for hours; task completion 0% is confirmed real zero |

**Required manual action for Omar:**

- العلاقات مع الزملاء والتعاون معهم (criterion 6)
- المحافظة على المظهر واللياقة العامة (criterion 7)
- التعاون مع المشرف الميداني (criterion 8)

---

## 6. Remaining Missing Information Table

| Student Name | University Number | Missing Criterion/Field | Why It Cannot Be Derived | Required Action |
|--------------|-------------------|-------------------------|--------------------------|-----------------|
| عمر محمد ثلجي المواجده | 120232222080 | Teamwork (6) | No collaboration evidence in LMS | Admin/Instructor manual 1–5 rating |
| عمر محمد ثلجي المواجده | 120232222080 | Appearance (7) | No conduct/appearance observation | Admin/Instructor manual 1–5 rating |
| عمر محمد ثلجي المواجده | 120232222080 | Supervisor cooperation (8) | No structured interaction evidence | Admin/Instructor manual 1–5 rating |
| عمر محمد ثلجي المواجده | 120232222080 | Thinking (3) | No post assessment or task scores | Complete post assessment OR manual rating |
| BATUNI Student | *(empty)* | University number | Not stored anywhere | Enter official university number |
| Malak ksasbeh | 120252222134 | Academic supervisor | Not assigned | Assign academic supervisor |
| ابرار عواد علي الحباشنه | 120252222116 | Hours / absence / attendance criterion | No attendance rows loaded | Record attendance / hours |
| *(93 students)* | various | Criteria 6,7,8 | Behavioral — not inferable | Use **استكمال بيانات التقييم الناقصة** UI |

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `fieldTrainingEvaluation.performanceAutofill.unit.test.js` | 14 tests PASS |
| `fieldTrainingEvaluation.scoring.unit.test.js` | PASS (updated) |
| Full backend suite | **900 pass**, 0 fail, 2 skipped |

---

## 8. Implementation Files

- `fieldTrainingEvaluation.performanceSnapshot.js` — canonical performance snapshot
- `fieldTrainingEvaluation.scoring.js` — derivation + evidence + `score100ToFivePoint`
- `fieldTrainingEvaluation.readiness.js` — readiness classification
- `fieldTrainingEvaluation.service.js` — batch context, partial manual ratings, readiness API
- `ManageEvaluationTemplateTab.jsx` — **استكمال بيانات التقييم الناقصة** UI + score evidence preview

---

## 9. Suggested Commit Message

```
feat: derive field training evaluation scores from student performance
```
