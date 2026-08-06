# Student Courses Implementation (MOBILE-STUDENT-COURSES-001)

## Web workflow audited

Standalone **LMS courses** (`courses` / sections / lessons) are distinct from cohort programs and field training.

| Step | Actor | Mechanism |
|------|-------|-----------|
| Create / publish | `super_admin` only | Admin CMS `/admin/courses` |
| Visibility | Optional `course_cohorts` | Empty = all students; otherwise student needs cohort enrollment `enrolled`/`completed` |
| Start | Student | `POST /student/courses/:id/start` → `course_enrollments.status = active` |
| Progress | Backend | `completed_published_lessons / published_lessons * 100` |
| Complete lesson | Student | `POST …/lessons/:lessonId/complete` |
| Finish course | Backend | When all published lessons complete → enrollment `completed` |

**Product terminology (Arabic):** **الكورسات / كورس** (not مقررات / دورات).

## Backend endpoints used

| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/student/courses` | student |
| GET | `/api/v1/student/courses/:id` | student |
| POST | `/api/v1/student/courses/:id/start` | student |
| GET | `/api/v1/student/courses/:id/progress` | student (available; list/detail embed progress) |
| POST | `/api/v1/student/courses/:courseId/lessons/:lessonId/complete` | student |
| GET/POST | `…/lessons/:lessonId/training*` | student (web-first; mobile shows web-only hint) |

## Student authorization

- Role must be `student`.
- Course must be `published`.
- Cohort gate as above.
- Grades for **cohort academic assessments** are a separate API surface and are **not** mixed into LMS course cards on mobile.

## Mobile routes

| Route | Screen |
|-------|--------|
| Shell tab `/home/courses` | `StudentCoursesListScreen` |
| `/student/courses` | Same list (standalone) |
| `/student/courses/:id` | `StudentCourseDetailScreen` |
| `/student/courses/:id/lessons/:lessonId` | `StudentCourseLessonScreen` |
| `/notifications` | Unchanged inbox (app-bar bell) |

## Bottom navigation (student)

1. الرئيسية  
2. التدريب  
3. **الكورسات**  
4. حسابي  

Notifications remain via:

- App-bar / home-header bell → `context.push('/notifications')`
- Unread badge
- Deep links / push coordinator
- Mark read / mark all read

## Feature layout

```
lib/features/courses/
  domain/student_course_models.dart
  data/student_courses_repository.dart
  presentation/student_courses_list_screen.dart
  presentation/student_course_detail_screen.dart  (+ lesson screen)
```

## QA follow-up (MOBILE-STUDENT-COURSES-QA-002)

See [STUDENT_COURSES_QA_REPORT.md](STUDENT_COURSES_QA_REPORT.md).

Fixes included:

- Empty-state copy (platform / cohort group)
- HTTPS-only lesson URL safety
- Offline write messaging
- 409 start conflict refresh
- Section/lesson sort + draft filter
- Student-only route guard
- Completed-course CTA
- Localized 403/404

## Offline policy

Cached (read-only): course list, course detail summary (sections/lessons metadata, progress).

Not cached for permanent offline use: signed URLs, videos, training uploads/answers.

Cleared on logout via existing `OfflineCache.clearUser` in home shell.

## Backend / product gaps

- No dedicated course push notification types (only cohort enrollment notifications exist).
- Lesson training workflow (upload + quiz) remains **web-preferred**; mobile marks simple completion and opens HTTPS video/resource links.
- Super-admin course CMS remains web-only.
- Cohort academic assessments/grades are not shown inside LMS course detail (separate domain).

## Tests

- `test/widget_shell_test.dart` — student nav shows الكورسات; bell → notifications
- `test/student_courses_test.dart` — models, deep links, URL safety, start/complete, route guard, RTL/LTR, cache isolation
- Suite after QA-002: **172** passing
- Debug APK: `flutter build apk --debug` OK (`app-debug.apk`)
