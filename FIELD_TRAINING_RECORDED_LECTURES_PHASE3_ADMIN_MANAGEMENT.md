# Field Training Recorded Lectures — Phase 3 Admin Management

**Product:** BATTECHNO LMS  
**Module:** `المحاضرات المسجلة` / Recorded Lectures  
**Date:** 2026-09-12  
**Scope:** Phase 3 only — admin list, local metadata editing, status transitions, drag-and-drop order, and **manual** YouTube playlist sync.

This phase does **not** implement the student player, watch tracking, watch analytics, reports integration, or Vimeo playback.

---

## Core principle

A YouTube playlist is an **import source**, not the LMS catalog.

Each imported video is an independent `field_training_recorded_lectures` row. After import, **LMS `sortOrder` is authoritative**. YouTube order is used only:

* on first import (Phase 2)
* as the relative order among **newly** synced videos (this phase)

Sync never silently restores YouTube order over a manual LMS arrangement.

---

## Admin page

Entry: opportunity management tab `المحاضرات المسجلة`.

The list is scoped to **that opportunity only**. There is no global mixed list.

Header shows:

* `المحاضرات المسجلة`
* opportunity title
* university name when available
* lecture count

Primary action: `+ إضافة محاضرات مسجلة` (reuses the Phase 2 importer; it is not duplicated as a second pipeline).

Empty state:

`لا توجد محاضرات مسجلة لهذه الفرصة حتى الآن.`

Filters (client-side, one list request): `الكل` / `منشورة` / `مسودة` / `مخفية`.

Drag-and-drop is enabled only on `الكل`, because reorder requires the complete lecture set.

---

## List row

Each card includes:

* drag handle (`☰`)
* thumbnail
* local title
* duration
* provider label `YouTube`
* source `فيديو منفرد` or `قائمة تشغيل`
* publication status (`مسودة` / `منشورة` / `مخفية`)
* optional linked session title
* actions: نشر / إخفاء / إعادة إلى المسودة / تعديل

Raw enums are not shown in the normal UI.

No watch counts, completion %, or watched minutes.

---

## Edit workflow

Admins may edit LMS metadata only:

* title (local; does not change the YouTube title)
* description
* lecture date
* instructor name
* linked Field Training session (`بدون جلسة مرتبطة` allowed)
* publication status

`providerVideoId` is **immutable** after creation. Ordinary PATCH that tries to change provider identity is rejected.

The backend revalidates that a linked session belongs to the same opportunity.

---

## Statuses

| Status | Student API |
|---|---|
| DRAFT | hidden |
| PUBLISHED | visible to eligible enrolled students |
| HIDDEN | hidden; row preserved |

Preferred lifecycle: `DRAFT → PUBLISHED → HIDDEN`. There is **no** normal hard-delete action (and no delete route).

---

## Drag and Drop

Library: **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`). No second DnD framework.

* Handle activation (not the whole card) so buttons stay clickable
* Pointer + keyboard sensors
* Optimistic UI; on failure the previous order is restored and the admin sees: `تعذر حفظ ترتيب المحاضرات، يرجى المحاولة مرة أخرى.`

One HTTP mutation:

```text
PATCH /api/v1/admin/field-training/:id/recorded-lectures/reorder
{ "lecture_ids": ["…", "…"] }
```

Instructor manage routes use the same path under `/instructor/field-training`.

---

## Reorder API

Backend checks:

* caller may **manage** the opportunity
* payload is a complete permutation of that opportunity’s lecture IDs
* no duplicates
* no foreign lecture IDs (Zarqa cannot reorder Tafila by crafting IDs)

Updates run in a **single Prisma transaction**. `sortOrder` is normalized to contiguous `1..N`. Last successful transaction wins under concurrent admins. There is no unique constraint on `sortOrder`; the transaction still writes a consistent permutation.

---

## Playlist source display

If any lecture has `source_type = playlist`, the same list response includes `playlistSources` (derived from the lecture rows — **no N+1**).

UI: `مصدر الاستيراد: قائمة تشغيل YouTube`. Playlist IDs are not the primary label.

---

## Manual playlist sync

Button: `مزامنة قائمة التشغيل`.

Pressing it **previews only**. Nothing is imported until the admin confirms.

```text
POST .../recorded-lectures/youtube/playlist/sync/preview
POST .../recorded-lectures/youtube/playlist/sync
```

Algorithm (reuses Phase 2 YouTube client: paginated `playlistItems.list` + batched `videos.list`):

1. Resolve the stored `source_playlist_id` for this opportunity
2. Fetch current playlist items (all pages)
3. Batch-fetch metadata
4. Compare with LMS lectures for the opportunity
5. Classify and return a preview
6. Admin imports selected / all **NEW** videos

### Classifications

| Code | Arabic |
|---|---|
| EXISTING | موجود مسبقًا |
| NEW | جديد |
| UNAVAILABLE | غير متاح |
| REMOVED_FROM_SOURCE | لم يعد موجودًا في قائمة التشغيل |

EXISTING uses uniqueness `opportunityId + provider + providerVideoId` (including videos originally imported as SINGLE). They are never recreated.

REMOVED_FROM_SOURCE: LMS rows that were imported from **this** playlist and are no longer in the current YouTube playlist. They are **not** deleted, hidden, or reordered automatically. Admin may explicitly `إخفاء المحاضرة`.

Unavailable/private YouTube videos that are still in the playlist: warning (`تعذر الوصول إلى الفيديو على YouTube.`), LMS row kept.

### New videos after manual ordering

Append after current LMS `max(sortOrder)`. Relative YouTube playlist order is preserved **among the new rows only**. Existing 1..N stay put.

Repeated sync is idempotent (`NEW = 0` → `imported = 0`).

---

## Deferred optional action

`إعادة الترتيب حسب قائمة التشغيل` is **not** implemented.

Mixing SINGLE and PLAYLIST lectures makes an automatic reset easy to get wrong. Phase 3 keeps manual DnD as the only LMS reorder tool. A future phase can add an explicit confirmed reset if product wants it.

---

## Authorization

| Actor | List | Edit / reorder / sync / import |
|---|---|---|
| `super_admin` | yes | yes |
| University `admin` | own university | own university |
| Assigned instructor | assigned opportunity | assigned opportunity |
| `reviewer` | yes (all statuses) | no |
| Student | published student API only | no |
| Institution | denied | denied |

---

## Audit

| Action | When |
|---|---|
| `RECORDED_LECTURE_UPDATED` | metadata / draft restore |
| `RECORDED_LECTURE_PUBLISHED` | publish |
| `RECORDED_LECTURE_HIDDEN` | hide |
| `RECORDED_LECTURES_REORDERED` | successful reorder (`opportunityId`, `count`) |
| `RECORDED_LECTURE_PLAYLIST_SYNCED` | sync apply (`discoveredNew`, `imported`, `removedFromSource`, `unavailable`) |

Never log the YouTube API key.

---

## Tests

Backend (`fieldTraining.recordedLectures.phase3.unit.test.js`): list statuses, edit, session validation, provider immutability, publish/hide/draft, reorder permutations, duplicate/foreign/incomplete payloads, concurrent reorder uniqueness, sync scenarios A–E, selective + import-all new, append-after-max, relative new order, idempotent repeat, reviewer/student/cross-university/institution, student visibility.

Frontend: `moveLecture` helper + source wiring for dnd-kit, single reorder endpoint, Arabic sync/reorder copy, no watch analytics.

---

## Scoring / attendance / eligibility

Unchanged. Recorded lectures remain separate from attendance, hours, and approved results.

Live read-only check of Tafila primary `4d9466cb-127b-42f2-ac08-88e7fcc7c7df`:

| Check | Result |
|---|---|
| Approved applications | **151** |
| Eligible | **146** |
| Ineligible | **5** |
| Laith `320230601066` | `NOT_ELIGIBLE`, **59.4**, tasks **2/4** |

---

## Phase 4 deferred work

* Embedded student YouTube player
* Playback heartbeat / unique watched time / segments / seek detection
* Student progress and completion
* Watch analytics and report integration
* Vimeo player
* Optional “reset to playlist order”

Suggested commit message:

```text
feat: add recorded lectures admin management and playlist sync
```
