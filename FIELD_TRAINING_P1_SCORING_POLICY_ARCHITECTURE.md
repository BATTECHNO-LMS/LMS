# FIELD TRAINING P1 — SCORING POLICY ARCHITECTURE

**Product:** BATTECHNO LMS  
**Date:** 2026-09-10  
**Scope:** P1 only. No task-workflow redesign. No report language cleanup. No PDF/Excel visual redesign.

Suggested commit message:

`refactor: unify field training scoring policy and eligibility architecture`

---

## 1. Previous competing calculators

| Location | What it did | Classification |
|---|---|---|
| `fieldTraining.qualification.js` `calculateFixedComponentQualification` | Live 20/20/40/20 | **CANONICAL_ACTIVE** (live engine for FIXED) |
| `fieldTraining.qualification.js` `wrapLegacyEvaluation` | Routes to weighted engine | **LEGACY_WEIGHTED** — isolated, policy-routed |
| `fieldTrainingEvaluation.scoring.js` `calculateFinalEvaluation` | Legacy weighted + optional renormalization | **LEGACY_WEIGHTED** / evaluation-form **POLICY_SPECIFIC** |
| `fieldTraining.workflow.js` `calculateLegacyFieldTrainingEligibility` | Attendance/hours/post/final-task gates | **LEGACY_DB_ONLY** |
| `fieldTraining.tafilaApprovedResult.service.js` | Persist/reconcile Tafila overlay | **HISTORICAL_ONLY** |
| `fieldTraining.tafilaApprovedBaseline.js` | Approved Excel baseline keyed by university number | **HISTORICAL_ONLY** |
| `fieldTraining.tafilaTaskNormalization.js` | Historical task-point reconstruction | **HISTORICAL_ONLY** |
| `fieldTraining.officialResult.service.js` | P0 official resolver | **CANONICAL_ACTIVE** |
| `fieldTraining.qualification.service.js` persist | Writes eligibility; now preserves any approved overlay | **CANONICAL_ACTIVE** |
| `fieldTraining.eligibilityOverrides.js` | FORCE_NOT_ELIGIBLE by university number | **POLICY_SPECIFIC** |
| Cohort / comprehensive / student reports | Presentation after P0 | **PRESENTATION_ONLY** (must consume official) |
| `fieldTrainingStudentsExcel.js` | Excel mapping | **PRESENTATION_ONLY** |
| Frontend score breakdown / cards | Display backend qualification | **PRESENTATION_ONLY** |
| Mutah evaluation template generation | DOCX/PDF professional form | **POLICY_SPECIFIC** — not LMS official score |
| Unit tests | Fixtures and engines | **TEST_ONLY** |

Nothing was deleted. Legacy and historical engines remain, but they are no longer independently official.

---

## 2. New policy-selection architecture

Central module:

`backend/src/modules/fieldTraining/fieldTraining.policy.service.js`

Canonical function:

`resolveFieldTrainingPolicy({ application, opportunity, universityPolicy, student })`

Official result path:

```
application
  -> resolveFieldTrainingPolicy
  -> overlay (approved/manual) OR live engine selected by family
  -> resolveFieldTrainingApprovedResult
  -> officialResult
```

Consumers never choose a scoring family. Reports, Excel, UI, bulk recalculation, and completion letters all receive `officialResult`.

---

## 3. Policy precedence

Explicit order (matches existing production semantics):

1. **MANUAL_APPROVED_OVERRIDE** — stored `approvedEvaluationResult` whose source is an authorized admin eligibility override (`AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE` / FORCE_NOT_ELIGIBLE).
2. **HISTORICAL_APPROVED_RESULT** — any other stored `approvedEvaluationResult` overlay (Tafila primary cohort and later approved overlays).
3. **Opportunity `completion_rules.scoringPolicy`** — opportunity-specific configured family.
4. **University evaluation policy** `scoring_rules.model`.
5. **LEGACY_WEIGHTED_V1** — only for unstamped historical opportunities that still have no overlay, no opportunity policy, and no FIXED university model.

Automatic background recalculation cannot overwrite an active approved overlay (persist preserves it).

The primary Tafila opportunity id `4d9466cb-127b-42f2-ac08-88e7fcc7c7df` is a **historical exception isolated in the policy layer** (`historicalException: PRIMARY_TAFILA_ONLINE`). Other services must not scatter `if (opportunityId === tafilaId)`.

Second Tafila opportunity `01666ebc-bfc1-4948-87a5-2add3f641c65` is never merged into the primary cohort.

---

## 4. Current default policy (new opportunities)

Family: `FIXED_COMPONENTS_V1`  
Code: `FIXED_COMPONENTS_20_20_40_20_V1`

| Component | Max |
|---|---|
| Attendance | 20 |
| Post assessment | 20 |
| Tasks | 40 |
| Behavior / professional evaluation | 20 |
| **Total** | **100** |

Formula:

`finalScore = attendancePoints + postPoints + taskPoints + behaviorPoints`

- No silent renormalization of missing components.
- Pre-assessment is **not** in the 100 unless a different configured policy says so. It may remain a workflow condition via `opportunity.requires_pre_assessment`.
- Training hours are a completion requirement, not a fifth score component.
- Default qualification threshold: **80**, unless the opportunity/university configures another.
- `requireAllRequiredTasksSubmitted` defaults to **false** for newly stamped opportunities. Unsubmitted required tasks contribute **zero** to the 40-point task component. This is **not** applied retroactively to historical approved cohorts (Tafila `TAFILA_SCORING_RULES` unchanged).

New opportunities receive additive `completion_rules`:

```json
{
  "scoringPolicy": "FIXED_COMPONENTS_V1",
  "scoringPolicyVersion": 1,
  "qualificationThreshold": 80,
  "requireAllRequiredTasksSubmitted": false
}
```

Existing `completion_rules.scoringPolicy` is never overwritten. Historical rows are not backfilled.

---

## 5. Legacy policy

`LEGACY_WEIGHTED_V1` remains for unstamped historical opportunities and Mutah-style university policies.

- Weights historically 20/20/20/40 (attendance/tasks/post/behavior) with passing 60.
- `renormalizeMissingComponents` may be true **only** in this engine.
- Isolated in `fieldTrainingEvaluation.scoring.js` and `wrapLegacyEvaluation`.
- Persist path: `persistLegacyEligibility` → `calculateLegacyFieldTrainingEligibility`.
- If an approved overlay exists on a legacy application, persist **does not** replace it with live legacy gates.

---

## 6. Historical policy

Official score/eligibility for overlay-backed applications is **read**, never live-recalculated.

Live qualification may still be stored as `calculatedFinalScore` for audit.

Tafila primary online cohort remains the approved overlay result. Expected production snapshot:

| Metric | Value |
|---|---|
| Students | 151 |
| Eligible | 146 |
| Not eligible | 5 |
| Eligible below 80 | 0 |
| Eligibility changes from P1 | 0 |

Laith `320230601066`: training_status `completed`, eligibility `NOT_ELIGIBLE`, final score `59.4`, tasks 2 of 4, task points 16.2 / 40.

---

## 7. Manual override precedence

Highest family when a valid approved overlay carries an authorized admin override.

Preserved fields (already on overlay / eligibilityOverride): actor, timestamp, reason, source, previous/approved result.

`persistApplicationEligibility` preserves **any** approved overlay, not only the Tafila opportunity id.

---

## 8. Training status vs eligibility

These are independent.

- **حالة التدريب (`training_status`)** — workflow/progress: `not_started` / `in_training` / `completed` / `failed` / `expelled` / …
- **نتيجة التدريب (eligibility)** — qualification: `eligible` / `ineligible` / `pending` / `needs_review`

**VALID:** `training_status = completed` AND `eligibility = ineligible`  
Meaning: the training period/workflow finished; the student did not qualify. The system must not flip `completed → failed` or `ineligible → eligible` to remove this combination.

UI: eligibility cards and the student eligibility panel show both labels. Completed is not treated as “letter issued” or “successful”.

---

## 9. Invalid combinations

Central validator: `validateOfficialResultIntegrity`.

Reported as invalid:

- `ELIGIBLE` + `expelled`
- `ELIGIBLE` + `failed`
- `ELIGIBLE` + finalScore below threshold without historical/manual overlay
- `finalScore` outside 0–100
- component over its configured maximum

**Not** invalid: `completed` + `ineligible`.

Attached on `officialResult.integrity` for tests/diagnostics. Not shown in ordinary UI.

---

## 10. Rounding

Internal canonical rounding is **one decimal** (`Math.round(n * 10) / 10`) in qualification and the official resolver.

Presentation (PDF/Excel/UI) may format that same official number. Consumers must not recompute a different official score.

Approved historical values are not rewritten by rounding changes.

---

## 11. Recalculation

- Single: `persistQualification(applicationId)`
- Bulk: `persistMany` loops the **same** `persistQualification`
- Workflow `recalculateEligibility` uses `persistQualification`
- Overlay-backed results keep official fields; live values stay in `calculatedFinalScore`
- Same input twice → same score; no score drift
- Overlay persist does not create a new official score

---

## 12. Consumers

| Consumer | Source |
|---|---|
| Student UI | Official public qualification |
| Admin eligibility / student detail | Official public qualification |
| Student / university final + comprehensive reports | Official `finalScore` / eligibility |
| Excel | `officialResult.finalScore` then official `qualification.finalScore` |
| Completion letter issue/download | P0 gate on official `eligibility === ELIGIBLE` |

---

## 13. Database / migration

- Reused existing JSON: university `scoring_rules`, application `eligibility_reason.details.approvedEvaluationResult`, opportunity `completion_rules`.
- Additive only: new opportunities stamp `completion_rules.scoringPolicy`.
- **No destructive migration. No speculative backfill of historical opportunities.**

---

## 14. Tests

`backend/tests/fieldTraining.policy.unit.test.js` — matrix A–L plus Tafila/Laith, idempotency, cross-output, second opportunity, no all-tasks hard gate for new FIXED policy.

`backend/tests/fieldTraining.officialResult.unit.test.js` — overlay precedence, completed+ineligible VALID, expelled+eligible invalid.

Live read-only: `backend/scripts/p0-field-training-official-regression.js`.

---

## 15. Remaining P2 items

Do **not** implement in P1:

- Redesign task workflow statuses / rename all task states
- Change report language / remove technical report terminology
- Redesign PDFs
- Broad Excel presentation label cleanup
- UX cleanup beyond the semantic split of training status vs eligibility

---

## 16. Observability

`logPolicyResolution` records (no student name/email):

`applicationId`, `policy`, `policyVersion`, `resultSource`, `manualOverrideApplied`, `historicalApprovedResultApplied`

Logged on single-application official resolve. Not shown in normal UI.
