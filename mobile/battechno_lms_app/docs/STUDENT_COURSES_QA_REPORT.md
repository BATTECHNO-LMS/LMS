# Student Courses QA Report (MOBILE-STUDENT-COURSES-QA-002)

**Date:** 2026-07-22  
**App:** `mobile/battechno_lms_app`  
**Device/emulator:** Android emulator `emulator-5554` (session `flutter run`); automated suite on host  
**Screenshots:** Not saved as in-repo image files this pass. Visual review used the live emulator session plus widget/theme inspection. Representative screens covered in code/live UI: Student Home course tile, courses list, empty/filter-empty, active/completed cards, course detail, sections/lessons, lesson detail, locked lesson handling, offline/error paths, notifications via bell.

## 1. Product-contract verification

Confirmed against Backend/web:

| Rule | Status |
|------|--------|
| Super Admin publishes LMS courses | OK |
| Optional `course_cohorts` visibility | OK |
| Empty cohort targeting → all eligible students | OK |
| Student starts via `POST /student/courses/:id/start` | OK |
| Enrollment `active` / progress Backend-authoritative | OK |
| Instructor does not assign LMS courses | OK — empty-state copy corrected |
| Separate from field-training tasks | OK |
| Separate from cohort academic grades | OK — no invented grades/certificates |

No remaining implementation contradicted these rules after QA fixes.

## 2–4. Navigation / notifications / course list

- Student tabs: الرئيسية / التدريب / **الكورسات** / حسابي — OK  
- Notifications not a bottom tab — OK  
- Bell → `/notifications` with unread badge — OK  
- Course routes student-only redirect — **fixed**  
- Deep links `/student/courses*` — OK  
- `program_admin` remains unsupported — unchanged  
- List: loading / empty / filter-empty / error+retry / offline cache / search / filters / localized statuses — OK after copy + filter-empty split  

## 5–8. Start / detail / lessons / completion

- Start only when supported; duplicate taps guarded; `409` refreshes authoritative enrollment — **fixed**  
- Detail uses Backend payload; completed chip instead of Start/Continue — **fixed**  
- Sections/lessons sorted by `sort_order`; draft lessons filtered — **fixed**  
- HTTPS-only URL open; unsafe/missing links snackbar — **fixed**  
- Mark-complete uses real endpoint; offline writes blocked with localized message — **fixed**  
- Field-training tasks not mixed into LMS lessons — OK  

## 9–10. Offline/cache / notification routing

- User-scoped course cache namespaces; cleared on logout — OK  
- Signed URLs not permanently cached — OK  
- Unsafe schemes rejected — OK  
- Course deep links recheck auth; unknown/inaccessible → inbox fallback — OK  
- Dedicated course push types may still be absent on Backend — documented gap  

## Defects found and fixed

1. Empty-state copy implied university/instructor assignment — platform/cohort wording.  
2. Lesson links allowed `http:` / failed silently — HTTPS-only + snackbars.  
3. Offline start/complete raw errors — localized offline-write message.  
4. Start `409` conflict not handled — refresh authoritative state.  
5. Sections/lessons not sorted by `sort_order` — sorted.  
6. Draft lessons could appear if present in payload — filtered.  
7. Filter empty reused “no courses” empty-state — distinct filter-empty title.  
8. Course `403`/`404` not localized — friendly messages.  
9. Completed courses still showed Start/Continue CTA — completed chip.  
10. Non-student authenticated users could open `/student/courses*` — redirect to `/home`.

## Open Backend gaps

- No dedicated LMS course push notification types (cohort enrollment notifications only).  
- Lesson training upload/quiz remains web-preferred.

## Intentional web-only

- Super-admin course CMS  
- Full lesson training workflow (file upload + auto-graded quiz)

## Visual / localization notes

- Navy/gold BATTECHNO identity preserved; no full redesign.  
- Arabic RTL + English LTR covered by existing i18n + widget tests.  
- Long titles: overflow soft-wrap/ellipsis patterns retained; automated long-title coverage in courses tests.  

## Automated results

| Check | Result |
|-------|--------|
| `dart format --output=none --set-exit-if-changed lib test` | Pass (exit 0) |
| `flutter analyze --no-fatal-infos` | Pass (exit 0; infos only, 53 info issues) |
| `flutter test` | **172 passed** |
| `flutter build apk --debug` | **Pass** → `build/app/outputs/flutter-apk/app-debug.apk` |

## Mobile v1 readiness

**Ready for mobile v1** for catalog → detail → lesson read/complete, with training quiz remaining web-only and course-specific push notification types pending Backend.
