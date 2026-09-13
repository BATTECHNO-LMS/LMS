# Query counts (code inspection + unit harness)

These are not APM traces. Service-level counters and repository reads.

## Student lecture list

`listForStudent`:

1. load opportunity / enrollment
2. list published lectures for the opportunity
3. `progressByLectureIds` — one `IN` query for all lecture ids

Frontend tab uses `useStudentRecordedLectures` once. No per-lecture progress fetch.

**Frontend N+1: NO. Backend N+1 for list: NO.**

## Heartbeat

Service-level `queryCounter` (unit): `lecture`, `application`, `ensureProgress`, `heartbeatTx`. Length <= 6. Typical **4 named operations**.

Inside `heartbeatTx` (one Prisma transaction): `SELECT … FOR UPDATE`, load progress, replace segments, update progress. Does not call scoring, reports, attendance, tasks, or assessments.

**Heartbeat query count: 4 service-level (NOT_MEASURED p50/p95).**

## Lecture analytics

No analytics resolver/routes exist (Phase 6 not implemented).

**Lecture analytics query count: N/A (feature missing).**

## 151-student analytics

Not implemented. **NOT_MEASURED / FAIL (missing).**

## Playlist 100 videos (mocked YouTube client)

Playlist items: 2 pages of 50. Metadata: `ceil(100/50) = 2` `videos.list` calls. Also verified for 1, 10, 50, 51, 123.
