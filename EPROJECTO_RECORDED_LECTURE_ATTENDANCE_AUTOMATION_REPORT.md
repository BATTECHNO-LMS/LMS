# EPROJECTO — Recorded Lecture Completion → Automatic Session Attendance

## Existing architecture (reused)

### Recorded Lecture completion
- Progress model: `field_training_recorded_lecture_progress`
- Segments: `field_training_recorded_lecture_watch_segments` (union of watched ranges)
- Heartbeat: `processHeartbeat` → `applyHeartbeatTransaction`
- Canonical completion: `reachedCompletion(uniqueWatchedSeconds, durationSeconds, threshold)`
- Default threshold: **90%** unique watched (`RECORDED_LECTURE_COMPLETION_PERCENT` env override)
- Completion is sticky via `completed_at` (never cleared by later heartbeats)
- Audit milestones only: `RECORDED_LECTURE_STARTED` / `RECORDED_LECTURE_COMPLETED` (no heartbeat spam)

### Session relation
- `field_training_recorded_lectures.session_id` → optional FK to `field_training_sessions`
- One lecture → at most one session (nullable)
- Multiple lectures may link to the same session; any completing lecture marks PRESENT

### Attendance model
- Canonical table: `field_training_attendance`
- Unique: `(session_id, application_id)`
- Statuses: `present | absent | late | excused | unconfirmed`
- Methods: `electronic | manual | auto_finalize | bulk_manual` (optional)
- Source for this rule stored in `note = RECORDED_LECTURE_COMPLETION` (no migration)

### Score / eligibility
- After status change: `workflow.refreshAttendancePercentage` + `workflow.persistEligibility`
- Field Training scoring policy untouched (Attendance 20 / POST 20 / Tasks 40 / Behavior 20)

---

## Trigger point

Inside `applyHeartbeatTransaction` when progress transitions:

```text
completed_at: null → set
```

In the **same DB transaction** as progress persistence:

```text
upsertPresentInTx → status = present
```

Then post-commit (only if status actually changed):

```text
audit ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE
refreshAttendancePercentage
persistEligibility
```

---

## Completion rule reused

**YES** — `reachedCompletion` + `getCompletionThresholdPercent()` (default 90%).  
Client cannot force completion by sending `progress = 100`.

---

## Attendance override behavior

Any prior status → `present`, including:

- absent (manual or `auto_finalize`)
- late
- excused
- unconfirmed
- missing row → create present

Already present → no-op (no audit, no eligibility refresh).

One-way: never auto-reverts to absent.

---

## Finalized session

Attendance rows are not hard-locked. Finalization marks unconfirmed → absent via `auto_finalize`.  
This rule still updates that row to `present` (tested).

---

## Idempotency & concurrency

- Unique constraint on `(session_id, application_id)`
- Atomic completion claim: `updateMany` where `completed_at IS NULL` — only the winning TX runs attendance
- Conditional attendance update: `updateMany` where `status != present` (or `create` + P2002 catch)
- Already-present short-circuit
- Transition-only trigger (`null → completed_at`) + service-level idempotency

---

## Audit event

```text
ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE
```

Arabic label:

```text
تم تحويل حضور الطالب إلى "حاضر" تلقائيًا بعد إكمال المحاضرة المسجلة
```

Metadata: student, lecture, session, oldStatus → present, source, titles.

Student activity timeline surfaces lecture/session + status transition.

---

## Student report / UI

- Completion milestone + attendance automation appear in central Logs / student timeline
- Player shows: “تم إكمال المحاضرة وتحديث حضورك في الجلسة المرتبطة.” when lecture has linked session
- Student lecture DTO exposes `sessionId` for UI

---

## Reconciliation (dry-run only)

```bash
node scripts/reconcile-recorded-lecture-attendance.js
node scripts/reconcile-recorded-lecture-attendance.js --opportunity <uuid>
```

Lists completed linked lectures whose attendance ≠ present. **No writes.**

---

## Migration

**NONE**

---

## Tests

`tests/fieldTraining.recordedLectures.attendanceFromCompletion.unit.test.js`  
Plus existing watch + audit registry suites.

| Case | Result |
|------|--------|
| absent → present | PASS |
| late → present | PASS |
| excused → present | PASS |
| unconfirmed (PENDING equivalent) → present | PASS |
| manual absent → present | PASS |
| auto_finalize absent → present | PASS |
| missing → create present | PASS |
| already present idempotent | PASS |
| repeated completion | PASS |
| unlinked lecture | SAFE |
| wrong student | PASS |
| wrong session protected | PASS |
| concurrent create | PASS |
| concurrent status flip | PASS |

Note: FT attendance enum has `unconfirmed`, not `pending`. Spec “PENDING” maps to `unconfirmed`.

---

## Remaining edge cases

- Historical completions are **not** backfilled automatically (use dry-run script)
- Training Programs (non–Field Training) materials are out of scope; this rule is Field Training only
- If eligibility refresh fails after commit, attendance is already PRESENT (progress+attendance atomic); retry via reconciliation + eligibility tools
