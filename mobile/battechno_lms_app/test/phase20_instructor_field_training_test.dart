import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/storage/offline_cache.dart';
import 'package:battechno_lms_app/features/instructor/domain/instructor_models.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Instructor training sections', () {
    test('maps in_progress to active', () {
      final opp = InstructorOpportunity({
        'id': '1',
        'title': 'T',
        'status': 'in_progress',
      });
      expect(opp.section, InstructorTrainingSection.active);
    });

    test('maps archived to completed', () {
      final opp = InstructorOpportunity({
        'id': '1',
        'title': 'T',
        'status': 'archived',
      });
      expect(opp.section, InstructorTrainingSection.completed);
    });

    test('empty assigned list has zero pending submissions', () {
      const data = InstructorTrainingListData(opportunities: []);
      expect(data.totalPendingSubmissions, 0);
      expect(InstructorDashboardData(list: data).priorityAction, isNull);
    });

    test('priority prefers pending submissions', () {
      final data = InstructorTrainingListData(
        opportunities: [
          InstructorOpportunity({
            'id': 'a',
            'title': 'Alpha',
            'status': 'in_progress',
            'pending_submissions_count': 5,
            'participants_count': 3,
          }),
        ],
      );
      final dash = InstructorDashboardData(list: data);
      expect(
        dash.priorityAction?.type,
        InstructorPriorityType.reviewSubmissions,
      );
      expect(dash.priorityAction?.count, 5);
    });
  });

  group('Attendance status', () {
    test('parses api values', () {
      expect(AttendanceStatus.fromApi('present'), AttendanceStatus.present);
      expect(AttendanceStatus.fromApi('late'), AttendanceStatus.late);
      expect(AttendanceStatus.fromApi(null), AttendanceStatus.unrecorded);
      expect(AttendanceStatus.present.apiValue, 'present');
      expect(AttendanceStatus.unrecorded.apiValue, isNull);
    });
  });

  group('Session validation', () {
    test('end must be after start', () {
      expect(InstructorLabels.isEndAfterStart('09:00', '10:00'), isTrue);
      expect(InstructorLabels.isEndAfterStart('10:00', '09:00'), isFalse);
    });

    test('meeting url allows https', () {
      expect(
        InstructorLabels.isSafeHttpsUrl('https://zoom.example/j/1'),
        isTrue,
      );
      expect(InstructorLabels.isSafeHttpsUrl('javascript:alert(1)'), isFalse);
    });
  });

  group('Submission review status', () {
    test('maps needs_revision', () {
      expect(
        SubmissionReviewStatus.fromApi('needs_revision'),
        SubmissionReviewStatus.needsRevision,
      );
      expect(SubmissionReviewStatus.approved.apiValue, 'approved');
    });
  });

  group('Instructor notification deep links', () {
    test('maps manage url to training detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/instructor/field-training/abc/manage',
        ),
        '/instructor/field-training/abc',
      );
    });

    test('maps tasks path to submissions', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/instructor/field-training/abc/tasks',
        ),
        '/instructor/field-training/abc/submissions',
      );
    });

    test('admin field-training url maps to admin opportunity detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/x',
        ),
        '/admin/field-training/x',
      );
    });
  });

  group('Instructor role and program_admin', () {
    test('instructor is active role', () {
      expect(LmsRoles.activeRoles.contains(LmsRoles.instructor), isTrue);
    });

    test('program_admin is unsupported', () {
      expect(LmsRoles.isSupported(['program_admin']), isFalse);
      expect(LmsRoles.activeRoles.contains(LmsRoles.programAdmin), isFalse);
    });
  });

  group('Instructor offline cache isolation', () {
    test('clears instructor namespaces per user', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = await OfflineCache.open();
      await cache.writeJson(
        userId: 'inst-a',
        namespace: 'instructor_trainings',
        payload: {
          'opportunities': [
            {'id': '1'},
          ],
        },
      );
      await cache.writeJson(
        userId: 'inst-b',
        namespace: 'instructor_trainings',
        payload: {'opportunities': []},
      );
      await cache.clearUser('inst-a');
      expect(
        cache.readJson(userId: 'inst-a', namespace: 'instructor_trainings'),
        isNull,
      );
      expect(
        cache.readJson(userId: 'inst-b', namespace: 'instructor_trainings'),
        isNotNull,
      );
      await cache.clearAll();
    });
  });

  group('Hours display', () {
    test('required hours null when absent', () {
      final opp = InstructorOpportunity({'id': '1', 'title': 'T'});
      expect(opp.requiredHours, isNull);
    });

    test('required hours from api field', () {
      final opp = InstructorOpportunity({
        'id': '1',
        'title': 'T',
        'required_training_hours': 120,
      });
      expect(opp.requiredHours, 120);
    });
  });
}
