# Field Training Recorded Lectures — Phase 5 Student UX

**Product:** BATTECHNO LMS  
**Module:** `المحاضرات المسجلة` / Recorded Lectures  
**Date:** 2026-09-12  
**Scope:** Phase 5 only — student list, lecture cards, player navigation, resume, caching, responsive UX.

This phase does **not** implement admin/university analytics, comprehensive report sections, Excel watch exports, Vimeo playback, attendance replacement, or recorded-lecture scoring.

---

## Navigation

Student flow stays inside BATTECHNO LMS:

```text
التدريب الميداني
↓
الفرصة التدريبية
↓
المحاضرات المسجلة
↓
اختيار محاضرة
↓
المشاهدة داخل المشغّل
↓
متابعة من آخر نقطة
↓
المحاضرة التالية
```

Entry: opportunity hub tab `المحاضرات المسجلة` (`?tab=recorded_lectures`).

Player route:

```text
/student/field-training/:opportunityId/recorded-lectures/:lectureId
```

Students are not sent to the public YouTube playlist as the normal flow. The IFrame Player stays inside the LMS page.

---

## Student list

Page header:

* title: `المحاضرات المسجلة`
* opportunity title when available
* lecture count of **PUBLISHED** accessible lectures
* completed count from the list payload `summary`

Example:

```text
المحاضرات المسجلة
8 محاضرات
تمت مشاهدة 5
5 من 8 محاضرات تمت مشاهدتها
```

List source: one request

```text
GET /api/v1/student/field-training/:opportunityId/recorded-lectures
```

Response concept:

```json
{
  "lectures": [
    {
      "id": "...",
      "title": "...",
      "thumbnailUrl": "...",
      "durationSeconds": 3600,
      "sortOrder": 1,
      "progress": {
        "uniqueWatchedSeconds": 1200,
        "progressPercentage": 33.3,
        "lastPositionSeconds": 1250,
        "completedAt": null
      }
    }
  ],
  "summary": { "total": 8, "completed": 5 }
}
```

Ordering: admin `sortOrder ASC`. Fallback in the repository is `created_at`, then `id`. Not YouTube date or title.

Search/filter (client-side, shown when there are 4+ lectures):

* search title / instructor name
* `الكل` / `لم يبدأ` / `قيد المشاهدة` / `تمت المشاهدة`

Empty published list:

```text
لا توجد محاضرات مسجلة متاحة حاليًا.
```

Drafts and hidden lectures are never listed. Loading uses card skeletons, not a full-page spinner.

---

## Lecture card

Each card shows:

* thumbnail (stored URL, with a clean placeholder if missing/broken)
* title (two-line clamp on the list; full title on the player page)
* duration
* lecture date when present (Arabic/English human date, not a raw ISO timestamp)
* instructor name when present (`المحاضر: ...` is omitted when empty)
* backend progress % and optional bar
* human watched duration: `شاهدت {{watched}} من أصل {{total}}`
* watch state
* CTA

Progress values are backend-authoritative. The UI does not recompute unique coverage.

---

## Progress states and CTAs

| Backend state | Arabic | CTA |
| --- | --- | --- |
| not started | `لم يبدأ` | `بدء المشاهدة` |
| in progress | `قيد المشاهدة` | `متابعة المشاهدة` |
| completed (`completedAt`) | `تمت المشاهدة` | `مشاهدة مرة أخرى` |

Completed cards stay visible with a small success mark. Rewatch does **not** reset unique segments, `completedAt`, or total playback.

If unique coverage is 94% and `completedAt` is set, the UI shows **94%**, not a forced 100%. Status can still be `تمت المشاهدة` because the Phase 4 threshold is 90%.

Wording uses `تقدم المشاهدة` / `مشاهدة التسجيل`. It does not say `حضور التسجيل`, and it does not show points.

---

## Player detail page

Layout:

```text
العودة إلى المحاضرات المسجلة
Title
Video player (16:9)
Progress / status
Description (plain text, collapse when long)
Previous lecture | Next lecture
```

Resume uses Phase 4 `resumePositionSeconds` / `lastPositionSeconds`.

* If a valid saved position exists and the lecture is not at the effective end, the player seeks there on load.
* Seeking to the saved position does not count as watched time. Only PLAYING spans persist.
* Hint: `متابعة من` + LTR clock (`24:18`).
* `المشاهدة من البداية` only calls `seekTo(0)`. It does not clear progress.

Previous / next use the student detail payload (`previous` / `next`), which is built from **PUBLISHED** lectures in `sortOrder`. Hidden for a single lecture.

End-of-video UX uses backend `completedAt` / `watchStatus`, not YouTube `ENDED`:

* completed → `تمت مشاهدة المحاضرة` and `الانتقال إلى المحاضرة التالية`
* skipped large sections → truthful % and `قيد المشاهدة`

---

## Resume, heartbeat, and cache

Canonical TanStack Query keys:

```text
fieldTrainingKeys.recordedLectures(opportunityId, 'student')
fieldTrainingKeys.studentRecordedLecture(opportunityId, lectureId)
```

Progress lives on those payloads. There is no second equivalent key.

During playback, heartbeat responses patch both caches directly. The player does **not** issue a progress GET every 10 seconds.

After pause/exit, the list is updated from the same cache patch so Back can render quickly (`staleTime` = field-training default 90s).

If admin hides a lecture, student 404/`RECORDED_LECTURE_NOT_FOUND` is shown as:

```text
لم تعد هذه المحاضرة متاحة.
```

That lecture is removed from the list cache. Stale rows are not kept indefinitely.

---

## RTL numeric formatting

The Arabic page is RTL. Clocks and percentages are isolated:

```html
<bdi class="ft-ltr-num" dir="ltr">1:32:14</bdi>
<bdi class="ft-ltr-num" dir="ltr">61%</bdi>
```

So `61%` and `1:32:14` do not reverse.

---

## Errors

| Situation | Copy |
| --- | --- |
| YouTube unavailable / embed blocked / player init failure | `تعذر تشغيل هذه المحاضرة حاليًا.` |
| Hidden/draft/direct URL after unpublish | `لم تعد هذه المحاضرة متاحة.` |
| Session expired | `انتهت صلاحية الجلسة. حدّث الصفحة ثم حاول مرة أخرى.` |
| Heartbeat retries exhausted | `تعذر حفظ تقدم المشاهدة مؤقتًا.` |

Player keep playing through a temporary heartbeat failure. Progress is not shown as saved until a heartbeat succeeds. Student progress is never deleted because the video failed.

Raw YouTube error codes are not shown.

---

## Responsive UX

* Phone: stacked cards, 44px controls, player width 100%, no horizontal overflow
* Tablet: slightly narrower thumbnail column
* Desktop: 16:9 thumbnail + body grid
* Player container is always `16:9` (`padding-top: 56.25%`)
* YouTube fullscreen (`fs=1`) has no LMS overlay on the iframe
* Layout does not use a fixed desktop-only player height

---

## Authorization

Unchanged from Phase 4:

* University student role + `requireOrganizationType('UNIVERSITY')`
* Approved application on the same opportunity
* `PUBLISHED` lectures only
* Cross-opportunity IDs denied
* Draft/hidden direct URLs → 404
* Institution trainees cannot use University Field Training student endpoints

The UI never relies on frontend filtering as the only control.

Privacy: a student sees only their own progress. No class averages, no other students.

---

## Performance

The student list is **not** N+1. One list endpoint attaches progress for all accessible lectures via `progressByLectureIds`.

Segment detail is omitted from list and student UI. Segment visualization is reserved for Phase 6.

---

## Accessibility

* Tab/list/player headings
* Native links/buttons and focus styles
* Search has a visually hidden label
* Filter `aria-pressed`
* Progress bars expose `role="progressbar"`
* Keyboard navigation is not removed from LMS chrome or YouTube controls

---

## What this phase does not change

* Live attendance records / attendance percentage
* Training hours
* Official scoring (`Attendance 20 / Post 20 / Tasks 40 / Behavior 20`)
* Eligibility
* Tafila primary `151 / 146 / 5`
* Student `320230601066` / Laith `59.4 / 2 of 4 / ineligible`
* Official reports / Excel analytics

---

## Tests

* CTA, filter/search, 20-lecture sort preservation, cache merge, 94% stays 94%
* Student list wiring: one list hook, empty copy, resume/restart/prev/next, RTL numbers, no `YOUTUBE_API_KEY`, no attendance/score wording
* Backend: published-only, summary, 20-lecture `sortOrder`, no segments in student payload, draft/hidden 404, other opportunity 403, university-only student router
* Playwright: unauthenticated recorded-lecture URLs stay off YouTube; optional authenticated flow only when `QA_STUDENT_EMAIL` / `QA_STUDENT_PASSWORD` / `QA_STUDENT_OPPORTUNITY_ID` are set (never mutate historical production student progress)

---

## Phase 6 deferred

**Phase 6 — Admin Analytics + Recorded Lectures Reporting**

* student-by-student watch table
* cohort watch statistics
* watched-segment viewer
* comprehensive report / Excel recorded-lecture sections
* university analytics

Still deferred: Vimeo player, attendance conversion, recorded-lecture scoring.
