# Field Training Recorded Lectures — Phase 4 Watch Tracking

**Product:** BATTECHNO LMS  
**Module:** `المحاضرات المسجلة` / Recorded Lectures  
**Date:** 2026-09-12  
**Scope:** Phase 4 only — student embedded player, exact watch tracking, heartbeat, segments, resume.

This phase does **not** implement admin/university watch analytics, comprehensive report sections, Vimeo playback, attendance replacement, or recorded-lecture scoring.

---

## Core principle

Tracking measures **what the student actually watched**, not the furthest timestamp reached.

Example:

```text
Watched 00:00 → 10:00
Seek to 30:00
Watched 30:00 → 40:00

Unique watched = 20 minutes
Last position  = 40 minutes
```

Seek distance is never treated as watched time.

---

## Player architecture

```text
YouTube IFrame Player
  → YouTubeRecordedLecturePlayer (adapter)
    → RecordedLecturePlayer (provider-neutral shell)
      → BATTECHNO watch tracking layer
        → Backend heartbeat
          → Progress + watch segments
```

YouTube supplies playback events only. Per-student progress is owned by BATTECHNO LMS, not YouTube Analytics.

The Data API key (`YOUTUBE_API_KEY`) stays server-side. The browser loads the official IFrame Player API (`https://www.youtube.com/iframe_api`) and does not receive the Data API key.

Vimeo remains a reserved provider. `RecordedLecturePlayer` can host `VimeoRecordedLecturePlayer` later without rewriting heartbeat math.

Student playback stays inside the LMS. Students are not sent to the public YouTube playlist page.

Navigation:

```text
التدريب الميداني → الفرصة التدريبية → المحاضرات المسجلة → المحاضرة
```

---

## Progress schema

Table: `field_training_recorded_lecture_progress`

One row per `(lecture_id, application_id)`.

| Field | Role |
| --- | --- |
| `unique_watched_seconds` | Union of watched segments |
| `total_playback_seconds` | All confirmed playback, including replays |
| `last_position_seconds` | Resume pointer only |
| `progress_percentage` | Backend `unique / duration * 100`, clamped 0–100 |
| `started_at` | First confirmed PLAYING span (not page load) |
| `last_watched_at` | Server timestamp |
| `completed_at` | Set once unique coverage reaches the threshold; never cleared |
| `heartbeat_cursors` | `{ watchSessionId: lastSequence }` for idempotency |

`progress_percentage` is never accepted from the client.

If `duration_seconds` is missing on the lecture, unique seconds can still accumulate, but completion percentage is not computed.

---

## Watch segments

Table: `field_training_recorded_lecture_watch_segments`

Stores normalized `[start_second, end_second]` ranges for a progress row.

Example:

```text
0 → 600
1800 → 2400
```

means the student watched 00:00–10:00 and 30:00–40:00.

Overlapping or adjacent ranges are merged with a **2-second** heartbeat-gap tolerance. Large unobserved gaps are not merged.

Persisted values use **whole seconds**.

---

## Heartbeat

While the player is genuinely `PLAYING`, the client sends a heartbeat about every **10 seconds**, and also flushes on PAUSE, SEEK, ENDED, `pagehide` / `beforeunload`, and visibility change (`fetch` + `keepalive`).

Conceptual payload:

```json
{
  "watchSessionId": "uuid",
  "sequenceNumber": 4,
  "fromSecond": 120,
  "toSecond": 130,
  "currentTime": 130,
  "playerState": "PLAYING"
}
```

Student endpoints (opportunity-scoped):

* `GET /:id/recorded-lectures/:lectureId/progress`
* `POST /:id/recorded-lectures/:lectureId/watch-session`
* `POST /:id/recorded-lectures/:lectureId/heartbeat`
* `POST /:id/recorded-lectures/:lectureId/player-event`

Opening a watch session creates the progress row if needed. It does **not** start watched time.

Backend validation rejects:

* negative times
* `fromSecond` beyond video duration
* `toSecond` beyond duration + small tolerance
* spans larger than the allowed heartbeat window (~28s, covering 2.5× playback speed)
* impossible claims such as `0 → 5400` in one heartbeat

Only `PLAYING` spans with `to > from` increment unique/total time. Pause and buffering add zero.

---

## Seek detection

Client tracker: if timeline jumps more than ~6 seconds between ticks, the previous range is flushed and tracking resumes from the new position. The jump itself is not a watched segment.

Server: even if a client mis-sends a jump, the max span check rejects it.

Forward seek is not counted. Backward seek / replay increases `total_playback_seconds` only for overlap already in the unique union.

Playback speed uses **video timeline coverage**, not wall-clock time. Unique watched for a 20-minute range at 2× is still 20 minutes.

`ENDED` does not mean 100% watched. Completion still depends on unique coverage.

---

## Unique vs total vs last position

| Metric | Meaning |
| --- | --- |
| Unique watched | Union of segments |
| Total playback | Sum of confirmed PLAYING spans, including repeats |
| Last position | Last valid playhead, used for `متابعة المشاهدة` |

Resume seeks to `last_position_seconds` unless the lecture is complete and the pointer is near the end, in which case playback starts from the beginning.

---

## Completion

Central threshold: `RECORDED_LECTURE_COMPLETION_PERCENT` (default **90**).

```text
uniqueWatchedSeconds / videoDurationSeconds * 100 >= 90
```

Example: 3600s video, 3240s unique → 90% → `تمت المشاهدة`.

`completedAt` is stored once and not cleared if later rounding changes.

---

## Idempotency and multi-tab

Each playback session has a random UUID `watchSessionId`. Each heartbeat has a monotonic `sequenceNumber`.

Duplicate `(session, sequence)` is ignored: unique and total playback do not double on transport retry.

Two tabs are two sessions. Unique coverage is the segment union, so overlapping playback cannot inflate unique watched time.

---

## Authorization

Every lecture GET and every heartbeat re-checks:

* authenticated student
* approved, non-expelled Field Training application for that opportunity
* lecture belongs to that opportunity
* lecture status is `PUBLISHED`

Draft, hidden, other-opportunity, and other-university lectures return 404/403. Institution trainees remain blocked by the university student router.

Heartbeat does **not** load scoring, reports, full opportunity graphs, or the official result resolver.

---

## Student UI

Published lectures only, `sortOrder ASC`.

Card fields: thumbnail, title, duration (`1:32:14` / `H:MM:SS`), optional date/instructor, progress %, status.

Statuses (Arabic, not raw enums):

* `لم يبدأ` — unique watched = 0
* `قيد المشاهدة` — progress below threshold
* `تمت المشاهدة` — `completedAt` set

Continue: `متابعة المشاهدة` when `lastPositionSeconds > 0`.

Player page: embed, title, description, duration, progress, previous/next. Times/percentages use `<bdi dir="ltr">` so RTL does not reverse numeric meaning.

---

## What this phase does not change

* Live attendance / attendance percentage
* Training hours
* Official scoring (`Attendance 20 / Post 20 / Tasks 40 / Behavior 20`)
* Eligibility
* Tafila primary `151 / 146 / 5`
* Student `320230601066` / Laith `59.4 / 2 of 4 / ineligible`

No automatic makeup attendance. No admin manual progress editor. Heartbeats are not written to the general audit log.

---

## Performance

Heartbeat query shape:

1. lecture row (id, opportunity, status, duration)
2. application row (id, status, expelled)
3. progress upsert / lock
4. replace normalized segments for that progress row
5. update the single progress row

No scoring recalculation, report generation, or full opportunity include.

---

## Tests

* Interval merge: overlap, adjacency, contained, repeated, unordered, zero-length, out-of-range, large gaps
* Normal watch, forward seek, backward seek, rewatch, pause, buffering
* Completion 899 / 900 / 1000 on a 1000s video
* Seek-to-end cheating blocked; `ENDED` does not force completion
* Heartbeat idempotency; two-session unique union
* Resume last position without adding unique time
* Auth: other opportunity, unenrolled student, draft/hidden, unauthenticated, malformed id
* Heartbeat query count stays small and away from scoring/report modules

---

## Phase 5 / 6 deferred

**Phase 5 — Student Recorded Lectures UX and Navigation**  
Polish the student list/player experience. Do not rebuild tracking.

**Phase 6 — Analytics and reports**  
Admin/university watch tables, comprehensive report sections, Excel exports.

Also deferred: Vimeo player, attendance replacement, recorded-lecture scoring, admin progress correction workflow.
