# Field Training Recorded Lectures — Phase 1 Core Architecture

**Product:** BATTECHNO LMS  
**Module:** `المحاضرات المسجلة` / Recorded Lectures  
**Date:** 2026-09-12  
**Scope:** Phase 1 only — database model, provider-neutral backend, admin CRUD, student read foundation.

This phase does **not** implement YouTube Data API, playlist import, drag-and-drop UI, the student player, watch tracking, analytics, or Vimeo playback.

---

## Architecture

```text
University
   ↓
Field Training Opportunity
   ↓
Recorded Lectures
   ↓
Recorded Lecture
```

A lecture belongs to **exactly one** Field Training opportunity. The same provider video may be added to another opportunity only if it is created there explicitly.

A lecture **may** optionally link to an existing Field Training session in the **same** opportunity (for example “تسجيل المحاضرة الخامسة”). Session linkage is not required: supplementary, orientation, and revision videos have no live session.

```text
RecordedLecture
   ↓
provider
   ↓
YOUTUBE | VIMEO
```

The rest of the LMS talks to a provider-neutral `field_training_recorded_lectures` row. Canonical identity is:

```text
opportunity_id + provider + provider_video_id
```

not a raw YouTube URL.

---

## Schema / model

Prisma model: `field_training_recorded_lectures`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | `gen_random_uuid()` |
| `opportunity_id` | UUID | required |
| `session_id` | UUID? | optional |
| `provider` | enum | `youtube` \| `vimeo` |
| `provider_video_id` | VARCHAR(128) | provider-native video id |
| `source_type` | enum | `single` (default) \| `playlist` |
| `source_playlist_id` | VARCHAR(128)? | retained for Phase 2 playlist import |
| `source_playlist_url` | VARCHAR(2000)? | retained for Phase 2 |
| `title` | VARCHAR(255) | required, trimmed |
| `description` | TEXT? | |
| `thumbnail_url` | VARCHAR(1000)? | |
| `duration_seconds` | INT? | must be ≥ 0 if supplied |
| `lecture_date` | DATE? | |
| `instructor_name` | VARCHAR(255)? | |
| `sort_order` | INT | default `0`; new rows use `max + 1` |
| `status` | enum | `draft` \| `published` \| `hidden` |
| `published_at` | TIMESTAMPTZ? | set on first publish |
| `created_by_id` | UUID? | creator user id only |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

API responses expose provider / source type / status as `YOUTUBE`, `SINGLE`, `DRAFT`, etc.

---

## Relationships

| Relation | On delete | Meaning |
|---|---|---|
| Opportunity → lectures | **CASCADE** | Same as sessions/tasks: removing an opportunity removes its lectures |
| Session → lectures | **SET NULL** | Deleting a live session does not destroy the recording |

No reverse relation was added on `users`. `created_by_id` follows the session audit convention (UUID only).

---

## Provider abstraction

Module: `backend/src/modules/fieldTraining/fieldTraining.recordedLectures.provider.js`

```text
RecordedLectureProvider
  validateVideoReference()
  normalizeVideoReference()
  getEmbedReference()
```

Phase 1 behavior:

- Accepts `YOUTUBE` / `VIMEO` (case-insensitive).
- Stores lowercase Prisma enum values (`youtube`, `vimeo`).
- Rejects empty ids and raw URLs (`https://…`, `youtu.be`, `vimeo.com`).
- Returns a provider-neutral embed reference (`youtube_embed` / `vimeo_embed`) **without** calling YouTube or Vimeo APIs and **without** requiring API keys.

Vimeo is a first-class provider value so the module is not YouTube-hard-coded. No Vimeo player is implemented yet.

---

## Statuses

| Status | Meaning |
|---|---|
| `DRAFT` | Admin is preparing the lecture. Students cannot see it. |
| `PUBLISHED` | Eligible enrolled students can access it. |
| `HIDDEN` | Stored with full metadata (and future watch history). Not visible to students. |

Hiding is the normal way to remove a lecture from student visibility. This phase does **not** expose destructive delete.

---

## Source types

| Source | Meaning |
|---|---|
| `SINGLE` | Standalone video. `source_playlist_id` / `source_playlist_url` are forced to null. |
| `PLAYLIST` | Imported as part of a playlist (Phase 2). Playlist metadata may be retained. |

---

## Duplicate strategy

Database unique constraint:

```text
uq_ft_recorded_lectures_opp_provider_video
(opportunity_id, provider, provider_video_id)
```

- Same video **cannot** be imported twice into the same opportunity.
- Same video **can** exist on another opportunity if added there explicitly.
- Unique violations are mapped to: `هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية.` (`RECORDED_LECTURE_DUPLICATE`). Prisma/SQL is not leaked.

Cross-opportunity session links are rejected: `الجلسة المحددة لا تتبع نفس فرصة التدريب.`

---

## Authorization matrix

Field Training remains UNIVERSITY-only except authoritative global `super_admin` (`isGlobal`). Missing organization assignment never implies global access. Institution roles (`INSTITUTION` admin, `trainer`, `trainee`) are denied.

| Actor | List / get (own university) | Create / update / publish / hide |
|---|---|---|
| `super_admin` (global) | Yes | Yes |
| UNIVERSITY `admin` | Own university opportunities only | Own university opportunities only |
| `reviewer` | Read-only, own university scope | **No** |
| Assigned `instructor` | Assigned opportunity (existing FT manage rights) | Assigned opportunity |
| Unassigned `instructor` | No | No |
| UNIVERSITY `student` | `PUBLISHED` lectures on **their** approved enrollment only | No |
| INSTITUTION admin / trainer / trainee | **No** | **No** |

Reviewer academic routes mount **read** only (`mountReadRoutes`). Admin/instructor routes mount manage APIs. Student routes mount published read APIs.

Student access requires:

- authenticated student
- UNIVERSITY portal
- published/in-progress opportunity
- approved, non-expelled application on **that** opportunity

Guessing another opportunity’s lecture id returns 403/404 without exposing drafts.

---

## Endpoints

Naming follows existing Field Training routers.

### Admin — `/api/v1/admin/field-training`

| Method | Path | Purpose |
|---|---|---|
| GET | `/:id/recorded-lectures` | List all statuses for an opportunity (`sort_order ASC`) |
| POST | `/:id/recorded-lectures` | Create metadata (no YouTube API) |
| GET | `/recorded-lectures/:lectureId` | Get one |
| PATCH | `/recorded-lectures/:lectureId` | Update metadata / status |
| PATCH | `/recorded-lectures/:lectureId/status` | Change `DRAFT` / `PUBLISHED` / `HIDDEN` |
| POST | `/recorded-lectures/:lectureId/publish` | Publish |
| POST | `/recorded-lectures/:lectureId/hide` | Hide |

Assigned instructors have the same manage surface on `/api/v1/instructor/field-training`.

### Academic / reviewer — `/api/v1/academic/field-training`

| Method | Path | Purpose |
|---|---|---|
| GET | `/opportunities/:opportunityId/recorded-lectures` | Read list (includes drafts/hidden) |
| GET | `/recorded-lectures/:lectureId` | Read one |

No create / update / publish / hide on academic routes.

### Student — `/api/v1/student/field-training`

| Method | Path | Purpose |
|---|---|---|
| GET | `/:id/recorded-lectures` | Published lectures for the enrolled opportunity |
| GET | `/:id/recorded-lectures/:lectureId` | One published lecture on that opportunity |

Student payload (safe metadata only):

```json
{
  "id": "...",
  "title": "...",
  "description": "...",
  "provider": "YOUTUBE",
  "providerVideoId": "...",
  "thumbnailUrl": "...",
  "durationSeconds": 5400,
  "lectureDate": "...",
  "instructorName": "...",
  "sortOrder": 1
}
```

Creator, audit, organization, and status internals are omitted.

Arabic errors used by the API:

- `المحاضرة المسجلة غير موجودة.`
- `لا تملك صلاحية الوصول إلى هذه المحاضرة.`
- `هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية.`
- `الجلسة المحددة لا تتبع نفس فرصة التدريب.`
- `ليس لديك صلاحية إنشاء أو تعديل المحاضرات المسجلة.`

---

## Indexes

| Index | Columns |
|---|---|
| `uq_ft_recorded_lectures_opp_provider_video` | `(opportunity_id, provider, provider_video_id)` unique |
| `idx_ft_recorded_lectures_opp_status_sort` | `(opportunity_id, status, sort_order)` |
| `idx_ft_recorded_lectures_session` | `(session_id)` |

List queries load an opportunity’s lectures in **one** `findMany` ordered by `sort_order ASC`, then `created_at`, then `id`. Session title is joined in that same query when present (not N+1).

New lectures without an explicit `sort_order` receive `max(sort_order) + 1` (first lecture is `0`). Drag-and-drop reordering is deferred to Phase 3.

---

## Migration

Additive only:

`backend/prisma/migrations/20260912140000_field_training_recorded_lectures/`

- Creates enums + `field_training_recorded_lectures`
- Does **not** drop/rename unrelated tables
- Does **not** alter scoring, assessments, attendance, tasks, or submissions
- Never uses `prisma migrate reset`

Applied with `prisma migrate deploy`. Database reports schema up to date (59 migrations). Live checks:

- table `field_training_recorded_lectures` exists
- unique constraint and indexes active
- opportunity FK `ON DELETE CASCADE`
- session FK `ON DELETE SET NULL`

---

## Audit

Recorded lecture mutations use the existing `recordAudit` pipeline:

| Action | When |
|---|---|
| `RECORDED_LECTURE_CREATED` | create |
| `RECORDED_LECTURE_UPDATED` | metadata/status edit |
| `RECORDED_LECTURE_PUBLISHED` | transition to published |
| `RECORDED_LECTURE_HIDDEN` | transition to hidden |

Arabic labels were added to `fieldTraining.activityTranslate.js`. These admin events are **not** added to the student activity feed list.

---

## Scoring / attendance / eligibility

Recorded Lectures are a learning module only.

- No lecture field enters the `/100` score (`Attendance 20 / Post 20 / Tasks 40 / Behavior 20`).
- Attendance percentage, completed hours, and eligibility are untouched.
- PRE assessment still does not enter the final score.

Post-migration regression (Tafila primary `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`):

| Check | Result |
|---|---|
| Total approved applications | **151** |
| Eligible | **146** |
| Ineligible | **5** |
| Laith `320230601066` | ineligible, **59.4 / 100**, tasks **2 of 4** |

---

## Tests

`backend/tests/fieldTraining.recordedLectures.unit.test.js` (plus unauthenticated route checks in `fieldTraining.auth.test.js`):

- Authorized university admin can create under own opportunity
- Duplicate `opportunity + provider + providerVideoId` rejected
- Same video allowed on another opportunity
- Session from another opportunity rejected
- Student sees only `PUBLISHED`
- Student cannot see `DRAFT` or `HIDDEN`
- Reviewer can read, cannot mutate; Zarqa reviewer denied on Tafila
- Zarqa admin cannot manage Tafila
- Institution user denied
- Missing university assignment is not global
- Migration is additive (no scoring/attendance/assessment ALTER/DROP)
- Provider layer does not call remote APIs

Result: **15 passed / 0 failed** in the focused Phase 1 suite (plus related auth and baseline manifest checks).

---

## Deferred — Phase 2

`Phase 2 - YouTube Single Video + Playlist Import`

Not in this phase:

- YouTube API key / `playlistItems.list`
- Single-video import from URL
- Playlist preview, pagination, and sync
- Thumbnail/duration fetch from YouTube
- Drag-and-drop reorder UI
- Student video player
- Watch tracking (`uniqueWatchedSeconds`, heartbeat, segments)
- Admin analytics / reports
- Vimeo player

---

## Backend files

| Path | Role |
|---|---|
| `backend/prisma/schema.prisma` | Model + enums + relations |
| `backend/prisma/migrations/20260912140000_field_training_recorded_lectures/` | Additive migration |
| `fieldTraining.recordedLectures.constants.js` | Providers, statuses, Arabic messages |
| `fieldTraining.recordedLectures.provider.js` | Provider adapter |
| `fieldTraining.recordedLectures.repository.js` | Prisma access, mappers |
| `fieldTraining.recordedLectures.service.js` | Authorization + CRUD |
| `fieldTraining.recordedLectures.controller.js` | HTTP adapters |
| `fieldTraining.recordedLectures.routes.js` | Admin / academic / student mounts |
| `fieldTraining.recordedLectures.validation.js` | Zod schemas |
| `fieldTraining.access.js` | Lecture read/manage + portal isolation |
