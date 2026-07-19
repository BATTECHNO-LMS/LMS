# 22 — Field Training State Transition QA (QA-001)

**Evidence sources:** `fieldTraining.workflow.js`, workflow/service writers, `fieldTraining.integration.test.js` (mocked AI/fetch), prior ISS-003 notes.

**Environment:** Disposable Postgres + integration suite — **8 pass / 0 fail** (QA-001 run).

---

## Happy-path transitions (written statuses)

| # | From → To (observed) | Trigger | Actor | Side effects | Idempotency / duplicate | Tests |
|---|----------------------|---------|-------|--------------|-------------------------|-------|
| 1 | apply → pending app | student apply | student | app row | unique opp+student (BE) | I |
| 2 | pending → approved | review approve | FT admin | training_status set | re-review rules | I |
| 3 | → pre_assessment_pending / ready / in_training | approval resolver | system | — | — | U workflow + I |
| 4 | pre → pre_assessment_completed | submit pre assessment | student | may unlock training | attempt uniqueness | I |
| 5 | → in_training | startTraining | instructor/admin | notifications | — | I |
| 6 | task published | create/publish task | manage roles | — | — | I |
| 7 | → task_submitted | submit task (+ AI meta) | student | notify instructor/admins | upsert submission | I (mocked AI) |
| 8 | submission reviewed | review approve/reject | instructor | final_task_status if final | — | I |
| 9 | post assessment | submit post | student | status update | — | I |
| 10 | → eligible_for_completion | persistEligibility | system | eligibility flags | — | I / U |
| 11 | → completed | issue letter | admin | letter + verify codes | unique letter_no | I |
| 12 | → expelled | expel | admin/instructor | blocks content | — | I |

---

## Never-written enum values (product)

| Status | Writers found | Finding |
|--------|---------------|---------|
| `task_pending` | none | **QA-FT-001** / ISS-003 |
| `post_assessment_pending` | none | **QA-FT-001** |
| `failed` | none | **QA-FT-001** |

UI must not imply these are reachable without product work.

---

## Negative / scope checks (integration)

| Case | Result | Coverage |
|------|--------|----------|
| Student cannot access another student’s submission download | Denied / skip if setup incomplete | I |
| Instructor cannot manage unassigned opportunity | Denied | I |
| Student visibility / apply guards | Covered | I |
| Reports: university / global / academic scoping | Covered | I |
| Cross-university denial | Scope helpers + I report scoping | Partial — staging probe recommended |

---

## External isolation

| Integration | Test mode | Accidental real call risk |
|-------------|-----------|---------------------------|
| OpenAI / Gemini | Mocked `runSelfEvaluationAi` + `isAiConfigured`; fetch stub | Low in I suite |
| Resend | unset key | Low |
| R2 | `STORAGE_BACKEND=local` | Low |

---

## FE / BE role drift

| Surface | BE default | FE manage UI | Finding |
|---------|------------|--------------|---------|
| FT admin manage | env may include `academic_admin` | `super_admin` + `university_admin` only | **QA-ROLE-001** |

Academic portal is read-only reports — intentional for AA/QA/reviewer.

---

## Manual staging still required

- Full UI click-through for opportunity builder, eligibility matrix, letter PDF download UX
- Mobile FT student detail at 360px
- Real file upload path (local storage) with PDF
- Notification content language review

Do not call real AI/email in staging unless explicitly approved sandbox keys.
