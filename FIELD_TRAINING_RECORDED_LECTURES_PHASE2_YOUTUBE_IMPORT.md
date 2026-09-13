# Field Training Recorded Lectures — Phase 2 YouTube Import

**Product:** BATTECHNO LMS  
**Module:** `المحاضرات المسجلة` / Recorded Lectures  
**Date:** 2026-09-12  
**Scope:** Phase 2 only — official YouTube Data API v3 single-video and playlist import for Field Training.

This phase does **not** implement drag-and-drop reorder, playlist sync, student player UI, watch tracking, admin analytics, reports, or Vimeo playback.

---

## Architecture decision

Phase 1 already stores per-lecture source fields:

```text
source_type
source_playlist_id
source_playlist_url
```

Those fields are enough for a later Phase 3 playlist sync: every imported row still belongs to the same opportunity, provider, and playlist id. **No `FieldTrainingRecordedLectureSource` table was added.** A separate source entity would duplicate identity that uniqueness already enforces:

```text
opportunityId + provider + providerVideoId
```

Canonical identity remains `YOUTUBE + providerVideoId`. Raw URLs are never stored as identity.

Provider stays provider-neutral. This phase only writes:

```text
provider = youtube   (API alias: YOUTUBE)
```

---

## YouTube API configuration

Server-only environment (backend `.env`, never frontend `VITE_*`):

| Variable | Default | Meaning |
|---|---|---|
| `YOUTUBE_API_KEY` | empty | YouTube Data API v3 server key |
| `YOUTUBE_PLAYLIST_MAX_ITEMS` | `400` (clamped 50–2000) | Hard cap. Exceeding it **errors**; it does not silently truncate. |
| `YOUTUBE_API_TIMEOUT_MS` | `15000` | Per-request timeout |

Rules:

* The key exists only on the backend.
* It is never returned from an API response.
* It is never committed to Git.
* Request logs record `provider`, `operation`, HTTP status, item count, and duration — not the key, not the signed URL, not student data.
* If the key is missing or invalid, admins receive: `خدمة YouTube غير مهيأة على الخادم. تواصل مع مدير النظام.`

Official endpoints used (minimum set):

```text
GET https://www.googleapis.com/youtube/v3/videos
GET https://www.googleapis.com/youtube/v3/playlistItems
GET https://www.googleapis.com/youtube/v3/playlists
```

Pasted admin URLs are parsed locally. The backend never fetches the pasted URL. That is the SSRF control.

---

## Supported URLs

### Single video (`فيديو واحد`)

```text
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/embed/VIDEO_ID
```

Shorts/live paths with an 11-character id are also accepted. A raw 11-character id is accepted as a convenience; identity is still the id, not the paste.

### Playlist (`قائمة تشغيل YouTube`)

```text
https://www.youtube.com/playlist?list=PLAYLIST_ID
https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
```

If a watch URL contains both `v` and `list`, **import mode decides**:

* Single mode → video id
* Playlist mode → playlist id

Unknown hosts, `localhost`, link-local IPs, and non-http(s) schemes are rejected as `رابط YouTube غير صالح.`

---

## Preview flow

Nothing is saved when an admin pastes a link.

```text
Paste URL → validate host/id → YouTube Data API → preview → confirm → create rows
```

### Single video

`POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/preview`

Safe preview payload:

```text
provider
providerVideoId
title
thumbnailUrl
durationSeconds
duplicateStatus   NEW | ALREADY_IMPORTED
availability      AVAILABLE | UNAVAILABLE
```

Final import (`.../youtube/import`) **re-fetches** metadata. Client preview fields are not trusted.

### Playlist

`POST .../recorded-lectures/youtube/playlist/preview`

Returns playlist title, counts (`found`, `valid`, `duplicate`, `unavailable`, `newCount`), and one row per playlist position:

```text
providerVideoId
title
thumbnailUrl
durationSeconds
playlistPosition
duplicateStatus   NEW | ALREADY_IMPORTED | UNAVAILABLE
availability
```

Already-imported items are classified `ALREADY_IMPORTED`. Private, deleted, or missing items are `UNAVAILABLE` and are not importable. One bad item does not fail the playlist.

---

## Import

### Single

* `sourceType = SINGLE`
* `sourcePlaylistId = null`
* `sourcePlaylistUrl = null`
* `status = DRAFT`
* `sortOrder = max(existing) + 1`, or `1` when the opportunity has no lectures

### Playlist

* Each usable video becomes its **own** recorded lecture row. The playlist is not stored as one lecture.
* `sourceType = PLAYLIST`
* `sourcePlaylistId` / `sourcePlaylistUrl` retained for future sync
* `status = DRAFT`
* Playlist position order is preserved among **newly imported** rows
* New rows are appended after the current highest `sortOrder`
* Selective import (`video_ids`) keeps relative playlist order, not title order
* `import_all: true` imports every `NEW` item
* Duplicates are skipped; unavailable items are skipped
* `createMany` + `skipDuplicates` plus the unique constraint is the race backstop

Default imported status is **DRAFT** so admins can review titles and order before students see anything. Phase 1 publish/hide endpoints remain the way to expose lectures.

YouTube description is stored locally (clipped to 8000 characters). List UIs should not dump the full description. Admins may edit the LMS title later; `providerVideoId` does not change.

---

## Pagination and batching

`playlistItems.list` is paged with `maxResults=50` until `nextPageToken` is empty.

Example:

```text
Page 1: 50
Page 2: 50
Page 3: 23
Total: 123
```

All 123 positions are discovered. The backend does not stop at the first page.

`playlistItems.list` does not include duration. Video ids are collected, then `videos.list` is called in batches of 50 ids. A 51-video playlist costs **two** `videos.list` calls, not 51. Ids are de-duplicated inside one preview/import operation. There is no long-lived metadata cache.

If `pageInfo.totalResults` (or collected items) exceeds `YOUTUBE_PLAYLIST_MAX_ITEMS`, import/preview fails with a clear Arabic error. Nothing is silently truncated.

---

## Availability

| YouTube state | Preview | Import |
|---|---|---|
| Public | NEW / ALREADY_IMPORTED | Import if new |
| Unlisted | Same as public if the API key can read the id | Allowed. LMS access control is still application-layer; unlisted is not a security boundary. |
| Private / deleted / rejected | UNAVAILABLE | Skipped. No broken lecture row. |

---

## Errors (admin-facing Arabic)

| Case | Message |
|---|---|
| Bad URL / unknown host | رابط YouTube غير صالح. |
| Video missing / private / deleted | تعذر العثور على الفيديو أو الوصول إليه. |
| Duplicate in this opportunity | هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية. |
| Playlist missing / unreadable | تعذر العثور على قائمة التشغيل أو الوصول إليها. |
| No usable videos | لا توجد فيديوهات قابلة للاستيراد في قائمة التشغيل. |
| Playlist larger than cap | قائمة التشغيل أكبر من الحد المسموح ولا يمكن استيرادها دفعة واحدة. |
| Quota / 429 after retries | تم تجاوز الحد المتاح لخدمة YouTube مؤقتًا. |
| Network / 5xx | تعذر الاتصال بخدمة YouTube حاليًا، يرجى المحاولة لاحقًا. |
| Missing/invalid API key | خدمة YouTube غير مهيأة على الخادم. تواصل مع مدير النظام. |

Raw Google error payloads are not returned to clients.

Retries (capped exponential backoff, max 3 attempts) apply only to transient failures: `429`, `500`, `502`, `503`, `504`, and network timeouts. Do **not** retry `400`, invalid-key/quota `403`, `404`, or invalid ids.

---

## Authorization

Reuse Phase 1 recorded-lecture manage access.

| Actor | Preview / import |
|---|---|
| `super_admin` | Yes, global |
| University `admin` | Yes, own university opportunities only |
| Assigned instructor | Yes, assigned opportunity (existing manage routes) |
| `reviewer` | Read-only. Mutation denied. |
| Student | No import routes (student router is GET-only) |
| Institution roles | Denied (university Field Training portal) |

Opportunity existence and university scope are checked on the backend. Frontend route context is not trusted.

Audit actions:

```text
RECORDED_LECTURE_IMPORTED_SINGLE
RECORDED_LECTURES_IMPORTED_PLAYLIST
```

Audit metadata: `opportunityId`, `provider`, `count`, `playlistId` when applicable. Never the API key.

---

## Admin UI

Inside `المحاضرات المسجلة`:

1. `+ إضافة محاضرات مسجلة`
2. Choose `فيديو واحد` or `قائمة تشغيل YouTube`
3. Preview
4. Confirm import

Playlist preview supports تحديد الكل / إلغاء تحديد الكل, استيراد المحدد, and استيراد الكل. Already-imported rows show `مضاف مسبقًا` with a disabled checkbox. After import:

```text
تم الاستيراد بنجاح
تمت إضافة: N · موجود مسبقًا: N · غير متاح: N
```

The browser never calls YouTube Data API. It only calls BATTECHNO admin/instructor endpoints.

---

## Quota notes

Per playlist preview/import, typical cost:

* `playlists.list` × 1
* `playlistItems.list` × ceil(N / 50)
* `videos.list` × ceil(uniqueIds / 50)

Do not run live quota tests in CI. Unit tests stub `googleapis.com`.

---

## Tests

Covered with mocked YouTube HTTP:

* URL forms (watch / youtu.be / embed / playlist / watch+list)
* SSRF-like hosts rejected
* ISO-8601 durations: `PT45S`→45, `PT12M8S`→728, `PT1H3M20S`→3800, `PT2H`→7200, `PT1H12M35S`→4355
* Single preview/import, invalid URL, unavailable, duplicate
* Playlist pagination 50+50+23
* Batched `videos.list` (51 → 2 calls)
* Sizes 1 / 10 / 50 / 51 / 100
* Selective import order, import all, append after existing `sortOrder`
* Unavailable skipped, repeat import idempotent, concurrent unique-constraint safety
* Reviewer / student / cross-university / institution denied
* Frontend source scan: no `googleapis.com/youtube`, no `YOUTUBE_API_KEY`

---

## Scoring / attendance / eligibility

Phase 2 does not alter scoring, attendance, or eligibility schemas or services.

Live read-only check of Tafila primary opportunity `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`:

| Check | Result |
|---|---|
| Approved applications | **151** |
| Eligible | **146** |
| Ineligible | **5** |
| Laith `320230601066` | `NOT_ELIGIBLE`, **59.4**, tasks **2/4** |

---

## Phase 3 deferred work

* Drag and drop reorder
* `مزامنة Playlist`
* Student player / YouTube embed UI
* Watch heartbeat, segments, progress
* Admin analytics and reports
* Vimeo playback

Suggested commit message:

```text
feat: add youtube import for field training recorded lectures
```
