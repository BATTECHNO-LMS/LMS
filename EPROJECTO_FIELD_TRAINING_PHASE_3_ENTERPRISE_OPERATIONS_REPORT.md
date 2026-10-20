# EPROJECTO FIELD TRAINING PHASE 3 — ENTERPRISE OPERATIONS REPORT

**Execution:** LOCAL ONLY  
**Production modified:** NO  
**Suggested commit (not performed):** `feat: add field training qr attendance interventions and external supervisor portal`

---

## 1. Existing architecture (inspected & reused)

| Domain | Canonical surface |
|--------|-------------------|
| Attendance windows | `field_training_attendance_windows` + `fieldTraining.attendanceWindow.service.js` (`open` / `close` / `finalize` / electronic code confirm) |
| Attendance rows | `field_training_attendance` unique `(session_id, application_id)` |
| Recorded lecture → PRESENT | `fieldTraining.recordedLectures.attendanceFromCompletion.service.js` (unchanged; regression 24/24 PASS) |
| Hours | `fieldTraining.hours.js` + `workflowService.updateApplicationHours` |
| Behavior / supervisor ratings | `fieldTrainingEvaluation.service.saveSupervisorRating` + scoring resolvers |
| Logbook | `fieldTraining.logbook.service` (university retains final APPROVE) |
| Command Center | `fieldTraining.commandCenter.service.js` |
| Notifications | `emitDomainEvent` + existing FT notify helpers |
| Audit | `shared/audit/auditActions.js` registry |
| Scoring | Attendance 20 / POST 20 / Tasks 40 / Behavior 20 — PRE & Hours not scored |

**No parallel attendance write path** for QR: confirmation upserts the same `field_training_attendance` table with `method: 'qr'`.

---

## 2. Dynamic QR design

### Challenge model
- **HMAC time-slot challenges** (not JWT):  
  `HMAC-SHA256(pepper, ft-qr-v1|windowId|sessionId|slot)`  
  Slot = `floor(now / ATTENDANCE_QR_ROTATION_SECONDS)`.
- QR encodes base64url JSON: `{ v:1, w:windowId, s:sessionId, k:slot, c:challenge }`.
- Absolute scan URL: `/student/field-training/attendance/qr?t=<token>` — **no auth secret in QR**.
- Rotation is **compute-only** (no DB write per tick). Accepts current + previous slot for edge grace.

### Config
| Env | Default | Purpose |
|-----|---------|---------|
| `ATTENDANCE_QR_ROTATION_SECONDS` | `45` | Challenge rotation |
| `ATTENDANCE_QR_WINDOW_SECONDS` | `600` | Suggested open duration (UI opens with 600s) |

Allowed window durations extended: `60,120,180,300,600,900`.

### Window lifecycle
Reuses existing states: open → closed / expired via `expireWindowIfNeeded` / `closeAttendanceWindow`.  
Finalization reuses existing `finalizeUnconfirmedAbsences` — no second “final attendance” concept.

### Attendance integration
`confirmAttendanceWithQr`:
1. Decode token; ignore any client `studentId` / `applicationId`.
2. Load window; require `status=open` and not expired.
3. Verify session binding + HMAC slot.
4. Resolve student from **authenticated session** + approved enrollment.
5. Upsert PRESENT/late with `method: 'qr'` (idempotent if already present-like).
6. Audit `FIELD_TRAINING_QR_ATTENDANCE_CONFIRMED` (no raw challenge stored).
7. Domain event `ATTENDANCE_CONFIRMED` (not per rotation).

### Live staff view
`GET .../sessions/:sessionId/attendance-qr/live` → QR payload + roster (status, source, confirmed_at) + present/remaining counts. Frontend polls ~7s.

### Security tests (unit)
- No JWT shape in token  
- Wrong session → denied  
- Expired slot → denied  
- Tampered HMAC → denied  
- Identity never taken from QR payload  

---

## 3. Intervention Cases

### Model (additive migration)
- `field_training_intervention_cases` — type / severity / status / source / assignment / follow_up / resolution  
- `field_training_intervention_events` — controlled timeline actions; `student_visible` default **false**

### Workflow
Risk engine **suggests**; staff opens case (duplicate active same `case_type` blocked).  
Assign → follow-up notes → MONITORING → resolve / reopen (history preserved).

### RBAC
All mutations go through `assertManageOpportunityAccess` (university/instructor scope). Cross-tenant denied by existing opportunity access.

### Command Center
Summary KPIs: open cases, high/critical, overdue follow-ups, live attendance windows, external pending evals.  
Per-student: `intervention.has_open_case` / `suggest_open_case` with CTAs.

### Student visibility
Internal notes never auto-exposed. Only events with `student_visible=true` and communication-like actions are eligible via `listStudentVisibleActions`.

---

## 4. External Supervisor Portal

### Assignment model
`field_training_external_supervisor_assignments`  
`(supervisor_user_id, opportunity_id, application_id?)` — missing assignment ⇒ **NO ACCESS**.

### Portal
- Route prefix: `/api/v1/external/field-training`  
- UI: `/external/field-training`  
- Role codes: `FIELD_TRAINING_EXTERNAL_SUPERVISOR_ROLE_CODES` (default `external_supervisor`) — assignment remains the hard gate.

### Capabilities
| Action | Behavior |
|--------|----------|
| Hours confirm | Scoped update + `TRAINING_HOURS_CONFIRMED` + eligibility refresh |
| Hours correction request | Audit + notification event |
| Evaluation | Reuses `saveSupervisorRating` with `_ftExternalSupervisor` assignment gate |
| Logbook | External may REQUEST_REVISION or VERIFY comment; **APPROVE stays university staff** |

### Security
Cross-student / cross-opportunity / cross-org IDOR blocked by `assertAssignedToApplication`.  
No `role` / `isGlobal` mass assignment on request bodies.

---

## 5. Eligibility / readiness / notifications

- Hours confirm + evaluation submission call `workflow.persistEligibility`.  
- Attendance QR refresh uses existing `refreshAttendancePercentage`.  
- Domain events added for attendance confirmed, intervention assigned, hours confirmed/required, external evaluation submitted.  
- **No** audit/notification/activity on QR rotation ticks or polling.

---

## 6. Migrations

File: `backend/prisma/migrations/20261020160000_field_training_phase3_qr_intervention_external/migration.sql`

Additive only:
- enum value `qr` on attendance method  
- QR challenges table (available for future telemetry; rotation itself is HMAC)  
- intervention cases + events  
- external supervisor assignments  

**Local `prisma migrate deploy` against configured Neon timed out on advisory lock** — migration **not applied** in this session (no SSH / no production container restart). Apply later from a local/dev DB when lock is free.

Prisma Client regenerated successfully against updated schema.

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `fieldTraining.qrAttendance.unit.test.js` | PASS |
| `fieldTraining.intervention.unit.test.js` | PASS |
| `fieldTraining.externalScope.unit.test.js` | PASS |
| `fieldTraining.readiness.unit.test.js` | PASS |
| `fieldTraining.journey.unit.test.js` | PASS |
| `fieldTraining.risk.unit.test.js` | PASS |
| `fieldTraining.recordedLectures.attendanceFromCompletion.unit.test.js` (node:test) | **24/24 PASS** |
| `frontend/tests/fieldTraining.phase3.ui.test.js` | PASS |

Backend Phase 3 + regression unit: **22 passed** (jest subsets) + **24** recorded-lecture node tests.  
Frontend Phase 3: **2 passed**.

---

## 8. Responsive QA (CSS + layout)

Styles added for QR stage, intervention cards, external portal grid with `@media (max-width: 768px)` single-column collapse.  
Breakpoints 375–1920 covered by existing FT responsive patterns + new mobile grids (static review; no browser lab run this session).

---

## 9. Remaining gaps / next phase

1. Apply Phase 3 migration when DB advisory lock is available.  
2. Seed/invite UX for `external_supervisor` role + MFA policy alignment.  
3. Richer Command Center “open case” prefill from selected student (application_id).  
4. Optional location policy hook (architecture ready; GPS not required).  
5. End-to-end browser smoke against local API after migrate.

**Recommended next Field Training phase:**  
DIGITAL COMPLETION PACKAGE + ADVANCED UNIVERSITY ANALYTICS + TRAINING CALENDAR

---

## 10. Key files

**Backend:**  
`fieldTraining.qrAttendance.service.js`, `fieldTraining.intervention.service.js`, `fieldTraining.externalSupervisor.service.js`, `fieldTraining.externalScope.js`, `externalFieldTraining.routes.js`, attendance window duration + exports, evaluation external gate, command center enrichment, audit actions, env QR settings, migration SQL.

**Frontend:**  
`ManageLiveQrAttendance.jsx`, `ManageInterventionsTab.jsx`, `ManageExternalSupervisorsTab.jsx`, `StudentQrAttendancePage.jsx`, `ExternalSupervisorPortalPage.jsx`, service methods, router routes, i18n AR/EN, SCSS.
