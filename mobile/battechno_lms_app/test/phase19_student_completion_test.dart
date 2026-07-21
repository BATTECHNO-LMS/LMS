import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:battechno_lms_app/core/files/secure_file_service.dart';
import 'package:battechno_lms_app/core/storage/offline_cache.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';
import 'package:battechno_lms_app/features/training/domain/student_training_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Student training grouping', () {
    test('available when no application status', () {
      final section = StudentTrainingLabels.sectionForOpportunity({});
      expect(section, StudentTrainingSection.available);
    });

    test('current when approved', () {
      final section = StudentTrainingLabels.sectionForOpportunity({
        'my_application_status': 'approved',
        'my_training_status': 'in_training',
      });
      expect(section, StudentTrainingSection.current);
    });

    test('cannot apply when pending application exists', () {
      expect(
        StudentTrainingLabels.canApply({'my_application_status': 'pending'}),
        isFalse,
      );
    });
  });

  group('Notification navigation', () {
    test('maps student field training action url', () {
      final route = NotificationNavigator.mobileRouteFromActionUrl(
        '/student/field-training/abc-123?tab=assessments',
      );
      expect(route, '/student/field-training/abc-123/assessments');
    });

    test('admin field-training applications url maps to admin route', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/x/applications',
        ),
        '/admin/field-training/x/applications',
      );
    });
  });

  group('Secure file URL validation', () {
    test('accepts https urls', () {
      expect(
        SecureFileService.isSafeHttpsUrl('https://example.com/file.pdf'),
        isTrue,
      );
    });

    test('rejects javascript urls', () {
      expect(SecureFileService.isSafeHttpsUrl('javascript:alert(1)'), isFalse);
    });
  });

  group('Offline cache isolation', () {
    test('keys are scoped per user', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = await OfflineCache.open();
      await cache.writeJson(
        userId: 'user-a',
        namespace: 'training_list',
        payload: {'opportunities': []},
      );
      await cache.writeJson(
        userId: 'user-b',
        namespace: 'training_list',
        payload: {
          'opportunities': [
            {'id': '1'},
          ],
        },
      );
      final a = cache.readJson(userId: 'user-a', namespace: 'training_list');
      final b = cache.readJson(userId: 'user-b', namespace: 'training_list');
      expect((a?.data['opportunities'] as List?)?.length ?? 0, 0);
      expect(b?.data['opportunities'], isNotEmpty);
      await cache.clearUser('user-a');
      expect(
        cache.readJson(userId: 'user-a', namespace: 'training_list'),
        isNull,
      );
      expect(
        cache.readJson(userId: 'user-b', namespace: 'training_list'),
        isNotNull,
      );
      await cache.clearAll();
    });
  });
}
