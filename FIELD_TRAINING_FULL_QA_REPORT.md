# FIELD TRAINING FULL QA REPORT

**Product:** BATTECHNO LMS  
**Date:** 2026-09-10  
**Mode:** QA / logic validation (no product redesign; no production data mutation)  
**DB:** Neon production (read-only queries only)  
**UI:** https://lms.battechno.com  

---

## FIELD TRAINING QA STATUS

**Overall: PASS WITH ISSUES**

| Metric | Count |
|--------|------:|
| Tests Executed | 128 |
| Passed | 119 |
| Failed | 3 (+ several classified findings) |
| Blocked | 6 |
| Critical Issues | 1 |
| High Issues | 4 |
| Medium Issues | 3 |
| Low Issues | 1 |
| Data Anomalies | 2 |
| Logic Contradictions | 3 |
| Security/Scope Issues | 1 (investigate) |
| Report Mismatches | 1 (unit label) |

**Ship Decision: YES WITH CONDITIONS**

### Blockers / conditions before acceptance

1. **P0:** Revoke/quarantine completion letters issued to currently ineligible students (including Laith `320230601066`) and harden issue path so ineligible/expelled cannot receive new letters.
2. **P1:** Document or reconcile `training_status=completed` with `completion_eligibility_status=ineligible`.
3. **P1:** Publish an explicit policy hierarchy for Tafila approved overlay vs live qualification (single source of truth for UI/PDF/Excel).
4. **P2:** Align task “submitted/completed” semantics between `taskProgress` and scoring accepted statuses.
5. Isolated QA database required before mutation/stale-recalc browser suites can be unmarked BLOCKED.

---

## 1. Business Logic Map (actual runtime)

```
Opportunity (UNIVERSITY-scoped)
  → Application (status) + Training status machine
  → Pre assessment (optional/required by opportunity/policy)
  → Training / Sessions / Attendance windows
  → Attendance % (required sessions) + Hours (Model A stored hours preferred)
  → Tasks + LMS submissions (authoritative rows)
  → Post assessment
  → Professional / supervisor ratings → criteria
  → Score engine:
       FIXED_COMPONENTS_V1 (e.g. 20/20/40/20) OR legacy weighted evaluation
  → Completion eligibility persisted on application
  → Tafila primary opportunity overlay:
       eligibility_reason.details.approvedEvaluationResult (display/workflow truth)
  → Reports / Excel / Completion letters consume persisted + overlay fields
```

### Canonical sources

| Concept | Canonical source |
|---------|------------------|
| Completion eligibility | `fieldTraining.qualification` → `applications.completion_eligibility_status` |
| Final score (live) | Fixed component sum / legacy evaluation |
| Final score (Tafila primary `4d9466cb-…`) | `approvedEvaluationResult.approvedFinalScore` |
| Hours | `applications.completed_training_hours` once recorded |
| Attendance % | attendance rows on required sessions |
| Task submission count | LMS `field_training_task_submissions` |
| Task grades for scoring | `review_status ∈ {graded,approved}` + `manual_score` |
| Reports | Cohort/comprehensive services over approved/persisted fields |

### Competing calculators (architecture finding)

1. Live FIXED vs legacy evaluation  
2. Tafila approved overlay vs live recalc  
3. Hours merge vs overlay helpers  
4. Excel evaluation presentation scoring vs official final score  
5. Task progress success statuses vs scoring accepted statuses  

---

## 2. Logical Consistency Findings

| Question | Answer | Expected | Actual | Evidence |
|----------|--------|----------|--------|----------|
| Completed student with zero hours? | **NO** in scan | Reject/flag | `completedZeroHours=0` | scanner |
| Eligible with missing requirements / score&lt;80? | **NO** on Tafila primary | Reject | invariants all 0 | scanner |
| Task graded without score? | **NO** globally | Handle explicitly | 0 rows | scanner |
| Reports disagree with website? | **PARTIAL RISK** | Same canonical | Dual engines exist; sample Tafila matches | ARCH-02 |
| Same student contradictory statuses? | **YES (1)** | Coherent model | Laith `completed` + `ineligible` | LOGIC-01 |
| Expelling/ineligible letter? | **YES** | Forbidden | 2 letters | BUG-CL-01 |
| Admin access another university? | **NO** for non-global | Deny | deny-all without universityId; isGlobal required | SEC-01 |
| Final score API vs report differ? | **RISK** | Same | Overlay vs live possible | ARCH-02 |

---

## 3. Tafila Regression

Opportunity: `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Students | 151 | 151 | PASS |
| Eligible | 146 | 146 | PASS |
| Not eligible | 5 | 5 | PASS |
| Eligible score &lt; 80 | 0 | 0 | PASS |
| Eligible null score | 0 | 0 | PASS |
| Score &gt; 100 / &lt; 0 | 0 | 0 | PASS |
| Eligible expelled | 0 | 0 | PASS |
| Required tasks | 4 | 4 | PASS |
| Submission rows | — | 551 | INFO |

Second opportunity `01666ebc-…`: **25** students, **16** university-number overlaps with primary — **not merged**; classified `EXPECTED_BY_POLICY` if intentional dual enrollment.

---

## 4. Laith Regression (`320230601066`)

| Field | Expected | Actual | Result |
|-------|----------|--------|--------|
| Eligibility | NOT_ELIGIBLE / ineligible | ineligible | PASS |
| Final score | 59.4 | 59.4 | PASS |
| Tasks | 2/4 | 2/4 (`submitted_required=2`, `total_required=4`) | PASS |
| Task1 / Task2 | 84 / 78 | 84 / 78 graded | PASS |
| Task component | 16.2 | 16.2 | PASS |
| Breakdown | 20 + 14.4 + 16.2 + 8.8 | matches | PASS |

**Defect:** completion letter issued while ineligible (see BUG-CL-01).  
**Status smell:** `training_status=completed` while not eligible.

---

## 5. Field Training Data Quality (scanner)

Global applications: **295**

| Suspicious state | Count |
|------------------|------:|
| Attendance &gt; 100% | 0 |
| Negative hours | 0 |
| Eligible + failed/expelled | 0 |
| Duplicate student+opportunity | 0 |
| Graded without manual_score | 0 |
| Letters for non-eligible/expelled | **2** |
| Completed + ineligible | **1** |

Letter examples (internal):

1. Uni `320230601066` (Laith) — Tafila primary — ineligible — letter issued 2026-09-07  
2. Mutah opportunity application `76e405f3-…` — ineligible — letter issued 2026-08-08  

---

## 6. Defect Catalog

### BUG-CL-01 — Completion letter for ineligible student (CRITICAL)

- **Classification:** BUSINESS_LOGIC_CONTRADICTION / BUG  
- **Module:** Completion letters  
- **Expected:** Issue/download denied unless eligible (and not expelled)  
- **Actual:** Letter rows exist for ineligible applications  
- **Why illogical:** Official completion artifact contradicts eligibility engine  
- **Likely root cause:** Letter issued under prior eligible/override state; no revoke on eligibility downgrade / insufficient re-check on download  
- **Recommended fix:** Gate issue+download on current eligibility; revoke or mark superseded when eligibility leaves `eligible`  
- **Regression risk:** Medium (letter workflows)  
- **Evidence:** `logs/auth-and-letter-probe.json`  

### ARCH-02 — Multiple score/eligibility calculators (HIGH)

- **Classification:** BUSINESS_LOGIC_CONTRADICTION  
- **Recommended fix:** Document precedence; make one resolver authoritative for UI/PDF/Excel  

### LOGIC-01 — completed + ineligible (HIGH)

- **Classification:** BUSINESS_LOGIC_CONTRADICTION or HISTORICAL_EXCEPTION (needs product decision)  

### ARCH-03 — Task progress vs scoring statuses (MEDIUM)

- **Classification:** UX_CONFUSION / BUSINESS_LOGIC_CONTRADICTION  

### SEC-03 — Super admin INSTITUTION portal token (MEDIUM)

- **Classification:** SECURITY_OR_SCOPE_ISSUE (investigate)  
- UI gateway correctly labels FT as university-only; API allows super_admin INSTITUTION login with `organization=null`. Confirm FT routers still reject institution portal sessions.  

### API-01 — Opportunities list 400 with valid token (MEDIUM)

- UI works; raw GET without params returned 400 — contract/docs issue.  

### UNIT-01 — cohortReports Arabic source label (LOW)

- Expected label string drifted (`مراجعة واعتماد نهائي` vs legacy expected).  

---

## 7. Automated tests

Focused backend FT unit run: **105 passed / 1 failed** (cohortReports label).  
Logic property script: renormalization fail-closed **PASS**; `isSystemWideAdmin` **PASS**.  
Playwright: **12 passed** (10 journey + 2 authenticated).  

Mutation / stale recalculation / concurrency write tests: **BLOCKED** (production Neon via local `.env`).

---

## 8. Browser / Video QA

- Overlays used for expected behavior narration.  
- Videos: `qa-artifacts/field-training/videos/` (01–10 + FULL).  
- Screenshots: `qa-artifacts/field-training/screenshots/`.  
- Traces: `qa-artifacts/field-training/traces/` + `playwright-raw/`.  
- Authenticated hub proves Tafila 151 / second 25 / Mutah / Zarqa visible to super_admin.  

---

## 9. Coverage matrix (summary)

| Domain | Coverage | Verdict |
|--------|----------|---------|
| Opportunity lifecycle | Code + UI hub | PASS |
| Applications | Read-only counts | PASS |
| Pre/post assessment | Unit + architecture | PASS |
| Attendance / hours | Unit + scanner | PASS |
| Tasks / grading | Scanner + unit | PASS_WITH_ISSUES |
| Scoring | Unit + property | PASS_WITH_ISSUES |
| Eligibility / overrides | Scanner + unit | PASS_WITH_ISSUES |
| Reports | Unit presentation + UI hub | PASS_WITH_ISSUES |
| Excel | Unit only; live export blocked | BLOCKED |
| Completion letters | Scanner defect | FAIL |
| Roles / isolation | Unit + gateway + API 401 | PASS |
| Browser E2E / video | Playwright | PASS |
| Mutation edge cases | — | BLOCKED |

---

## 10. Priority remediation plan

| Priority | Issue | Impact | Fix | Scope |
|----------|-------|--------|-----|-------|
| P0 | Ineligible completion letters | Official wrong artifact | Gate + revoke/supersede | MEDIUM |
| P1 | Dual score/eligibility sources | Wrong report/UI risk | Single resolver / documented hierarchy | LARGE |
| P1 | completed + ineligible | Status confusion | Clarify enum semantics or transition rules | SMALL |
| P2 | Task progress vs scoring statuses | Misleading UI | Align enums or label distinctly | MEDIUM |
| P2 | Super admin institution portal session | Possible scope leak | Enforce portal sticky on FT routes | SMALL |
| P3 | cohortReports label unit fail | CI noise | Update expectation or label map | SMALL |
| P3 | Opportunities API 400 without params | Integrator friction | Document required query or return 200 empty | SMALL |

---

## 11. Artifacts

- Report: `FIELD_TRAINING_FULL_QA_REPORT.md` (this file)  
- Machine results: `qa-artifacts/field-training/results.json`  
- Scanner: `qa-artifacts/field-training/scanner-findings.json`  
- Video index: `qa-artifacts/field-training/VIDEO_INDEX.md`  
- Videos / screenshots / traces / logs: under `qa-artifacts/field-training/`  
- QA harness: `qa/field-training/`  

Suggested commit message (not committed):

`test: add comprehensive field training QA audit and video evidence`
