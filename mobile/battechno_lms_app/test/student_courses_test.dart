import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/core/errors/api_exception.dart';
import 'package:battechno_lms_app/features/courses/domain/course_url_safety.dart';
import 'package:battechno_lms_app/features/courses/domain/student_course_models.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';

void main() {
  group('StudentCourse models', () {
    test('parses course list card fields', () {
      final course = StudentCourse.fromMap({
        'id': 'c1',
        'title': 'Intro to Security',
        'short_description': 'Basics',
        'level': 'beginner',
        'lessons_count': 10,
        'completed_lessons_count': 3,
        'progress_percent': 30,
        'enrollment_status': 'active',
      });
      expect(course.id, 'c1');
      expect(course.hasStarted, isTrue);
      expect(course.isCompleted, isFalse);
      expect(course.progressPercent, 30);
      expect(course.enrollmentStatus, StudentCourseEnrollmentStatus.active);
    });

    test('null enrollment maps to notStarted', () {
      final course = StudentCourse.fromMap({
        'id': 'c2',
        'title': 'Draft path',
        'enrollment_status': null,
      });
      expect(course.enrollmentStatus, StudentCourseEnrollmentStatus.notStarted);
      expect(course.hasStarted, isFalse);
    });

    test('detail finds next incomplete lesson', () {
      final detail = StudentCourseDetail.fromMap({
        'course': {
          'id': 'c1',
          'title': 'Course',
          'enrollment_status': 'active',
          'progress_percent': 50,
        },
        'progress_percent': 50,
        'sections': [
          {
            'id': 's1',
            'title': 'Section 1',
            'sort_order': 2,
            'lessons': [
              {
                'id': 'l1',
                'title': 'Done',
                'type': 'text',
                'sort_order': 2,
                'is_completed': true,
                'status': 'published',
              },
              {
                'id': 'l2',
                'title': 'Next',
                'type': 'video',
                'sort_order': 1,
                'is_completed': false,
                'status': 'published',
              },
            ],
          },
          {
            'id': 's0',
            'title': 'Section 0',
            'sort_order': 1,
            'lessons': [
              {
                'id': 'l0',
                'title': 'First',
                'type': 'text',
                'sort_order': 1,
                'is_completed': true,
                'status': 'published',
              },
            ],
          },
        ],
      });
      expect(detail.sections.first.id, 's0');
      expect(detail.sections.last.lessons.first.id, 'l2');
      expect(detail.nextLesson?.id, 'l2');
      expect(detail.completedLessons, 2);
      expect(detail.totalLessons, 3);
    });

    test('filters draft lessons from student detail', () {
      final detail = StudentCourseDetail.fromMap({
        'course': {'id': 'c1', 'title': 'Course'},
        'sections': [
          {
            'id': 's1',
            'title': 'S',
            'lessons': [
              {
                'id': 'draft',
                'title': 'Hidden',
                'status': 'draft',
                'is_completed': false,
              },
              {
                'id': 'pub',
                'title': 'Visible',
                'status': 'published',
                'is_completed': false,
              },
            ],
          },
        ],
      });
      expect(detail.totalLessons, 1);
      expect(detail.sections.first.lessons.single.id, 'pub');
    });

    test('unknown enrollment status falls back safely', () {
      final course = StudentCourse.fromMap({
        'id': 'c3',
        'title': 'X',
        'enrollment_status': 'weird_future_status',
      });
      expect(course.enrollmentStatus, StudentCourseEnrollmentStatus.unknown);
    });
  });

  group('Course URL safety', () {
    test('allows https urls with host', () {
      expect(isSafeLessonUrl('https://cdn.example.com/v.mp4'), isTrue);
    });

    test('rejects http, javascript, data, and empty', () {
      expect(isSafeLessonUrl('http://insecure.example.com/a'), isFalse);
      expect(isSafeLessonUrl('javascript:alert(1)'), isFalse);
      expect(isSafeLessonUrl('data:text/html,hi'), isFalse);
      expect(isSafeLessonUrl(''), isFalse);
      expect(isSafeLessonUrl(null), isFalse);
      expect(isSafeLessonUrl('https://'), isFalse);
    });

    test('extracts YouTube ids from common https shapes', () {
      expect(
        extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
      expect(
        extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
      expect(
        extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
      expect(
        extractYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
        'dQw4w9WgXcQ',
      );
      expect(
        extractYoutubeVideoId('https://cdn.example.com/video.mp4'),
        isNull,
      );
      expect(extractYoutubeVideoId('http://youtu.be/dQw4w9WgXcQ'), isNull);
    });
  });

  group('ApiException course write helpers', () {
    test('network/conflict/forbidden flags', () {
      expect(ApiException(message: 'n', isNetwork: true).isNetwork, isTrue);
      expect(ApiException(message: 'c', statusCode: 409).isConflict, isTrue);
      expect(ApiException(message: 'f', statusCode: 403).isForbidden, isTrue);
      expect(ApiException(message: 'm', statusCode: 404).isNotFound, isTrue);
    });
  });

  group('Course notification deep links', () {
    test('maps /student/courses list', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/student/courses'),
        '/student/courses',
      );
    });

    test('maps /student/courses/:id', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/student/courses/abc-123',
        ),
        '/student/courses/abc-123',
      );
    });

    test('maps lesson urls to course detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/student/courses/abc/lessons/l1',
        ),
        '/student/courses/abc',
      );
    });
  });
}
