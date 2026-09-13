# Defects

## Found and fixed in Phase 7

1. **Player unmount did not flush heartbeat** (`useRecordedLectureWatchTracking.js`). Route changes could drop the last span. Cleanup now calls `flushExit()` and clears the tracker.
2. **No heartbeat abuse cap.** Added `recordedLectureHeartbeatLimiter` (90/min per user+lecture) on heartbeat and player-event.
3. **Inverted `fromSecond > toSecond` was sanitized only.** Now rejected at Zod and watch-service validation.
4. **Broken relative imports** in student player/watch hook (`../../../` vs `../../../../`) blocked the production frontend bundle from resolving the player.
5. **Pre-existing JSX/syntax errors** blocked `vite build`: extra `{ }` in comprehensive student report, stray `</div>` in applications report, truncated `createOpportunitySession` in `fieldTraining.service.js`. Minimal syntax restores only.

## Remaining

### BLOCKER for complete-module GO

- Phase 6 admin analytics, student/university comprehensive recorded-lecture sections, and Excel recorded-lecture sheet are **not implemented**.
- This session did **not** deploy to `lms.battechno.com`.

### HIGH

- Authenticated Playwright (admin import, student complete, reviewer, cross-university with real tokens) **NOT_TESTED** (no isolated QA credentials).
- Local Neon is missing `20260912160000_field_training_recorded_lecture_watch_progress`. Do not assume production has it without a production `migrate status`.
- Heartbeat/analytics latency under load **NOT_MEASURED**.

### MEDIUM / LOW

- Progress rows still `ON DELETE CASCADE` from lectures; there is no HTTP delete, but raw DB delete would wipe evidence.
- Global `apiLimiter` is defined but not mounted on `app.js`.
- `fieldTraining.tafilaApprovedExcel.unit.test.js` fails on overlay source string (pre-existing, not this module).
- Courses i18n mentions the env var name `YOUTUBE_API_KEY` (not the secret).
