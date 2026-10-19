# EPROJECTO — Recorded Lecture Progress & Attendance

## Summary

Extends live completion → PRESENT automation with:

1. Historical dry-run / apply reconciliation
2. Admin per-lecture student progress roster (eligible population, KPIs, filters)

Execution for this task: **LOCAL ONLY**. Apply against Neon was intentionally **not** executed.

---

## Existing data model

| Entity | Table / relation |
|--------|------------------|
| Lecture | `field_training_recorded_lectures` |
| Progress | `field_training_recorded_lecture_progress` (`completed_at` sticky) |
| Session link | `field_training_recorded_lectures.session_id` → `field_training_sessions` |
| Attendance | `field_training_attendance` unique `(session_id, application_id)` |
| Eligible students | Approved non-expelled applications via `findEligibleAttendanceParticipants` |

Statuses: `present | absent | late | excused | unconfirmed`  
(Spec “PENDING” maps to `unconfirmed`.)

---

## Canonical completion resolver

**Reused:** `reachedCompletion(uniqueWatchedSeconds, durationSeconds, threshold)`  
Default threshold **90%** (`RECORDED_LECTURE_COMPLETION_PERCENT`).  
Completion truth = `completed_at != null` (set only by server-side heartbeat aggregation).  
Admin % display is derived; attendance automation never trusts a client `progress=100`.

---

## Student population resolver (admin roster)

```text
eligible approved applications
  LEFT JOIN progress (this lecture)
  LEFT JOIN attendance (linked session, if any)
```

Students with no progress row appear as `0%` / `not_started`.

---

## Historical reconciliation

**Service:** `scanRecordedLectureAttendance` / `reconcileRecordedLectureAttendance`  
**Script:** `backend/scripts/reconcile-recorded-lecture-attendance.js`

| Mode | Behavior |
|------|----------|
| Default | DRY_RUN — report only |
| `--apply` + `--confirm-apply` (or `ALLOW_RECONCILE_APPLY=true`) | Writes PRESENT |
| Neon + `--apply` | Blocked unless `ALLOW_NEON_RECONCILE_APPLY=true` |

Apply path:

- Updates non-present → present (any prior status)
- Creates missing attendance rows
- Audit `ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE` with `reconciliation: true`
- `refreshAttendancePercentage` + `persistEligibility` only on real changes
- Does not modify `completed_at` or progress
- Incomplete students never scanned (requires `completed_at`)

### Local dry-run result (this session)

```text
Mode: DRY_RUN
Lectures scanned: 17
Student progress rows: 142
Completed students: 51
Already PRESENT: 7
Need attendance update (non-present): 4
Missing attendance rows: 40
Actionable total: 44
No linked session: 0
Invalid/orphaned: 0
```

**Apply:** NOT EXECUTED (DATABASE_URL is Neon; safety guard).

---

## Idempotency

- Already PRESENT → skip (no audit, no recalc)
- Second apply → actionable 0 (unit-tested)
- Unique `(session_id, application_id)` + conditional `updateMany` / create+P2002

---

## Live completion rule

Still wired in `applyHeartbeatTransaction`:

```text
atomic claim completed_at IS NULL
  → upsertPresentInTx (same TX)
  → post-commit audit (reconciliation: false) + eligibility
```

Historical reconciliation does **not** replace the runtime rule.

---

## Admin API

```text
GET .../recorded-lectures/:lectureId/students
```

Query allowlists: filter (`all|completed|in_progress|not_started|present|not_present|needs_sync`), sort, search, page / page_size.

Response: `lecture`, `linkedSession`, `summary` (full population), `students` (page), `pagination`.

**Auth:** `assertRecordedLectureReadAccess` (global / university FT admin / instructor manage / reviewer). Students cannot call this roster. Cross-tenant denied.

**Performance:** 1 progress batch + 1 attendance batch + eligible apps + profiles — no per-student N+1. No raw watch segments in payload.

---

## Admin UI

- List action: **الطلاب والتقدم**
- Panel: `ManageRecordedLectureProgressPanel.jsx`
- KPIs: total / completed / not completed / avg progress / linked present / needs-sync (when > 0)
- Desktop table + mobile cards
- Search, filters, sort, pagination, refresh, 20s refetch
- Progress via `StudentProgressBar`
- Unlinked lecture: **غير مرتبطة بجلسة**; attendance **غير متاح**

---

## Audit & student report

| Path | `reconciliation` |
|------|------------------|
| Live heartbeat completion | `false` |
| Historical apply | `true` |

Arabic registry label: تم تحويل حضور الطالب إلى "حاضر" تلقائيًا بعد إكمال المحاضرة المسجلة  
Timeline adds for reconcile: تم تحديث الحضور بناءً على إكمال المحاضرة المسجلة  
No heartbeat spam.

---

## Tests

| Suite | Result |
|-------|--------|
| `attendanceFromCompletion.unit.test.js` (live + reconcile) | PASS |
| `progressRoster.unit.test.js` | PASS |
| `recordedLectures.watch.unit.test.js` | PASS |
| `recordedLectures.admin.ui.test.js` (incl. roster wiring) | PASS |

---

## Migration

**NONE**

---

## Remaining edge cases

- Neon apply requires explicit `ALLOW_NEON_RECONCILE_APPLY=true` + confirm — run after dry-run review
- Scan `completedStudents` is capped by `--limit` (default 5000)
- Excel export not added (optional; out of minimal scope)
- Non–Field Training materials out of scope
