# EPROJECTO Field Training Phase 2 Report
## Training Logbook + Evidence Portfolio + Smart Notifications

**Execution:** LOCAL ONLY  
**Production modified:** NO  
**Suggested commit (not applied):** `feat: add field training logbook evidence portfolio and smart notifications`

---

## 1. Existing architecture (reused)

| Concern | Reuse |
|---|---|
| Scoring 20/20/40/20 | Unchanged — logbook/portfolio add **0** points |
| Hours (not scored) | Canonical `fieldTraining.hours` |
| Files | Multer + private `uploads/field-training/...` + ACL download |
| Notifications | `notification.service` + FT helpers + rule-state table |
| PDF | `analytics/pdfRenderer` (Puppeteer) |
| RBAC | `fieldTraining.access` + `supervisorScope` |
| Command Center | Extended summary KPIs |
| Student journey/readiness | Preserved; overview adds Phase 2 cards |

---

## 2. Logbook model

**Migration:** `20261020140000_field_training_logbook_portfolio_notifications` (additive)

Tables:

- `field_training_logbook_entries` — date, activity, learning, skills, challenges, outcome, reported_hours (informational), status, review fields, soft `deleted_at`
- `field_training_logbook_attachments` — storage_key, original_name, mime, size
- `field_training_logbook_review_events` — SUBMITTED / REVISION_REQUESTED / RESUBMITTED / APPROVED + comment history
- `field_training_portfolio_uploads` — optional student-added evidence
- `field_training_notification_rule_states` — dedupe / cooldown / transition state

**Statuses:** `DRAFT → SUBMITTED → APPROVED` or `SUBMITTED → REVISION_REQUESTED → SUBMITTED → APPROVED`

**Date security:** within training start/end, no far-future dates.

**Hours:** `reported_hours` are **informational only** — never auto-merge into approved training hours.

**Audit:**  
`FIELD_TRAINING_LOGBOOK_CREATED|SUBMITTED|REVISION_REQUESTED|RESUBMITTED|APPROVED|DELETED`

---

## 3. Portfolio resolver

`getStudentEvidencePortfolio(applicationId, user)`

Aggregates (batched):

- Overview / student / opportunity
- Canonical score breakdown (explicit note: logbook/portfolio not scored)
- Skills from **approved** logbook skills only (no AI invention)
- Approved logbook + attachments
- Tasks + submission files
- Recorded lectures + progress
- Assessments (PRE marked not scored in total)
- Attendance + hours (hours labeled as hours)
- Supervisor evaluations
- Completion letter
- Student-added uploads (distinct label)

**PDF:** `fieldTraining.portfolio.pdf.js` — ivory/navy/gold RTL HTML → PDF. Lists evidence; does not embed binaries or leak IPs/storage keys/JWTs.

---

## 4. Smart notifications

`fieldTraining.smartNotifications.js`

| Rule | Behavior |
|---|---|
| TASK_DUE_SOON | Due within 24h, not submitted |
| TASK_OVERDUE | Past due, not submitted |
| RECORDED_LECTURE_NOT_STARTED | Available ≥3 days, 0% progress |
| RECORDED_LECTURE_INCOMPLETE | Partial progress after delay |
| HOURS_REMAINING | Real remaining hours when near completion |
| READY_TO_COMPLETE | On readiness READY transition |

**Dedup:** `field_training_notification_rule_states` — prefer false→true; cooldown blocks repeats; second evaluator run without state change does not re-fire.

**Event-driven logbook:** submit / revision / approve via `fieldTraining.notifications.js`.

**Scheduled hook:** `POST .../:id/smart-notifications/evaluate` (staff) — safe to re-run.

Catalog events added: `FT_LOGBOOK_*`, `FT_RECORDED_LECTURE_*`, `FT_HOURS_REMAINING`.

---

## 5. APIs

Student:

- `GET/POST /student/field-training/:id/logbook`
- `PATCH/POST/DELETE /student/field-training/logbook/:entryId...`
- `POST .../attachments`, `GET .../attachments/:id/download`
- `GET .../:id/portfolio`, `GET .../:id/portfolio/pdf`

Admin/Instructor:

- `GET /:id/logbook` (filters + pagination)
- `POST /logbook/:entryId/approve`
- `POST /logbook/:entryId/request-revision`
- `GET /applications/:applicationId/portfolio[+pdf]`
- `POST /:id/smart-notifications/evaluate`

---

## 6. UI integration

- Student tabs: **سجل التدريب**, **ملف الإنجاز**
- Overview Phase 2 cards
- Command Center KPIs: logbook pending + revision resubmissions
- Student report: `logbookSummary` (approved highlights)

---

## 7. Security

- Student owns entries only
- Staff: manage opportunity + university scope + supervisor assignment
- Attachment download ACL (student self or scoped staff)
- Cross-university filter throws forbidden (existing helper)
- No JWT in download URLs

---

## 8. Performance

Portfolio uses parallel batched queries (tasks, submissions, files, lectures, progress, logbook, assessments, hours, letter) — not N+1 per item.

Command Center logbook counts: one `groupBy` over scoped application IDs.

---

## 9. Tests

**Backend:** logbook workflow + smart notification registry/PDF — **8 passed**  
**Frontend:** UI wiring — **2 passed**  
Prior Phase 1 suites remain available.

---

## 10. Responsive QA (CSS)

| Width | Status |
|---|---|
| 375–430 | PASS — stacked cards, 44px actions |
| 768 | PASS — 2-col overview cards |
| 1024–1920 | PASS |

---

## 11. Migration status

**Additive migration present.** Apply locally with:

```bash
cd backend && npx prisma migrate deploy
# or: npx prisma migrate dev
npx prisma generate
```

Not applied to production.

---

## 12. Remaining gaps

- Full HTTP e2e fixture (draft→revision→approve) needs DB migrate + seed
- Portfolio ZIP package deferred (PDF + references shipped)
- Digest aggregation for high-volume supervisor mail deferred to existing digest infra
- Dedicated browser pixel QA not run

**Recommended next Field Training phase:**  
DYNAMIC QR ATTENDANCE + INTERVENTION CASES + EXTERNAL SUPERVISOR PORTAL
