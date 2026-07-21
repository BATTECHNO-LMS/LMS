import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/storage/offline_cache.dart';
import 'package:battechno_lms_app/core/widgets/app_shell.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';
import 'package:battechno_lms_app/features/reviewer/domain/reviewer_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget shellHarness(String role) {
    return MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('ar'),
      home: Builder(
        builder: (context) {
          final l10n = AppLocalizations.of(context);
          final items = shellNavForRole(role, l10n);
          return Scaffold(
            bottomNavigationBar: AppBottomNavigation(
              items: items,
              currentIndex: 0,
              onTap: (_) {},
            ),
          );
        },
      ),
    );
  }

  group('qa_officer shell nav', () {
    test('exposes exactly five destinations', () {
      final l10n = lookupAppLocalizations(const Locale('ar'));
      final items = shellNavForRole(LmsRoles.qaOfficer, l10n);
      expect(items.length, 5);
      expect(items.map((e) => e.label).toList(), [
        l10n.home,
        l10n.reviews,
        l10n.reports,
        l10n.notifications,
        l10n.profile,
      ]);
    });

    testWidgets('renders labels', (tester) async {
      await tester.pumpWidget(shellHarness(LmsRoles.qaOfficer));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('المراجعات'), findsOneWidget);
      expect(find.text('التقارير'), findsOneWidget);
      expect(find.text('الإشعارات'), findsOneWidget);
      expect(find.text('حسابي'), findsOneWidget);
    });
  });

  group('university_reviewer shell nav', () {
    test('exposes exactly five destinations with trainees tab', () {
      final l10n = lookupAppLocalizations(const Locale('ar'));
      final items = shellNavForRole(LmsRoles.universityReviewer, l10n);
      expect(items.length, 5);
      expect(items.map((e) => e.label).toList(), [
        l10n.home,
        l10n.reviews,
        l10n.trainees,
        l10n.reports,
        l10n.profile,
      ]);
    });

    testWidgets('renders labels', (tester) async {
      await tester.pumpWidget(shellHarness(LmsRoles.universityReviewer));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('المراجعات'), findsOneWidget);
      expect(find.text('المتدربون'), findsOneWidget);
      expect(find.text('التقارير'), findsOneWidget);
      expect(find.text('حسابي'), findsOneWidget);
    });
  });

  group('program_admin remains unsupported', () {
    test('is fail-closed', () {
      expect(LmsRoles.isSupported(['program_admin']), isFalse);
      expect(LmsRoles.activeRoles.contains(LmsRoles.programAdmin), isFalse);
    });
  });

  group('ReviewerCapabilities', () {
    test(
      'qa_officer can access QA/risk/integrity, not recognition/enrollment',
      () {
        const caps = ReviewerCapabilities(LmsRoles.qaOfficer);
        expect(caps.canAccessQaReviews, isTrue);
        expect(caps.canWriteQaStatus, isTrue);
        expect(caps.canAccessRiskIntegrity, isTrue);
        expect(caps.canAccessRecognition, isFalse);
        expect(caps.canDecideRecognition, isFalse);
        expect(caps.canDecideEnrollment, isFalse);
        expect(caps.canReadCertificates, isTrue);
      },
    );

    test(
      'university_reviewer can decide recognition/enrollment, not QA/risk/integrity',
      () {
        const caps = ReviewerCapabilities(LmsRoles.universityReviewer);
        expect(caps.canAccessQaReviews, isFalse);
        expect(caps.canWriteQaStatus, isFalse);
        expect(caps.canAccessRiskIntegrity, isFalse);
        expect(caps.canAccessRecognition, isTrue);
        expect(caps.canDecideRecognition, isTrue);
        expect(caps.canDecideEnrollment, isTrue);
        expect(caps.canReadCertificates, isFalse);
      },
    );

    test('evidence and academic FT reports are read-only for both roles', () {
      const qa = ReviewerCapabilities(LmsRoles.qaOfficer);
      const reviewer = ReviewerCapabilities(LmsRoles.universityReviewer);
      expect(qa.canReadEvidence, isTrue);
      expect(reviewer.canReadEvidence, isTrue);
      expect(qa.canReadFtReports, isTrue);
      expect(reviewer.canReadFtReports, isTrue);
    });

    test('neither role can ever write hours or attendance', () {
      for (final role in [
        LmsRoles.qaOfficer,
        LmsRoles.universityReviewer,
        LmsRoles.programAdmin,
        LmsRoles.instructor,
      ]) {
        final caps = ReviewerCapabilities(role);
        expect(caps.canWriteHours, isFalse);
        expect(caps.canWriteAttendance, isFalse);
      }
    });

    test('program_admin and student are fail-closed for every capability', () {
      for (final role in [LmsRoles.programAdmin, LmsRoles.student]) {
        final caps = ReviewerCapabilities(role);
        expect(caps.canAccessQaReviews, isFalse);
        expect(caps.canAccessRiskIntegrity, isFalse);
        expect(caps.canAccessRecognition, isFalse);
        expect(caps.canDecideRecognition, isFalse);
        expect(caps.canDecideEnrollment, isFalse);
        expect(caps.canReadCertificates, isFalse);
      }
    });
  });

  group('QA status transitions', () {
    test('open review can move to in_progress, resolved, or closed', () {
      expect(nextQaStatuses('open'), ['in_progress', 'resolved', 'closed']);
    });

    test('closed review has no further transitions', () {
      expect(nextQaStatuses('closed'), isEmpty);
    });

    test('unknown status returns an empty, unmodifiable list', () {
      final result = nextQaStatuses('bogus');
      expect(result, isEmpty);
      expect(() => result.add('x'), throwsUnsupportedError);
    });
  });

  group('Recognition status transitions', () {
    test('submitted moves to under_review or needs_revision', () {
      expect(nextRecognitionStatuses('submitted'), [
        'under_review',
        'needs_revision',
      ]);
    });

    test('under_review moves to approved, rejected, or needs_revision', () {
      expect(nextRecognitionStatuses('under_review'), [
        'approved',
        'rejected',
        'needs_revision',
      ]);
    });

    test('approved and rejected are terminal', () {
      expect(nextRecognitionStatuses('approved'), isEmpty);
      expect(nextRecognitionStatuses('rejected'), isEmpty);
    });

    test(
      'reviewer-actionable statuses are submitted and under_review only',
      () {
        expect(reviewerActionableRecognitionStatuses, {
          'submitted',
          'under_review',
        });
        expect(
          RecognitionRequestItem({'status': 'submitted'}).isActionable,
          isTrue,
        );
        expect(
          RecognitionRequestItem({'status': 'draft'}).isActionable,
          isFalse,
        );
      },
    );
  });

  group('Risk and integrity status transitions', () {
    test('risk case can escalate from open or in_progress', () {
      expect(nextRiskStatuses('open'), contains('escalated'));
      expect(nextRiskStatuses('in_progress'), contains('escalated'));
    });

    test('integrity case moves from reported to under_investigation', () {
      expect(
        nextIntegrityStatuses('reported'),
        contains('under_investigation'),
      );
    });
  });

  group('Phase 23 notification deep links', () {
    test('bare qa review url maps to QA review detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/qa-reviews/qr-1'),
        '/qa/reviews/qr-1',
      );
    });

    test('admin-prefixed qa review url maps to the same detail route', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/qa-reviews/qr-1',
        ),
        '/qa/reviews/qr-1',
      );
    });

    test('corrective action url maps to case detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/corrective-actions/ca-1',
        ),
        '/qa/corrective/ca-1',
      );
    });

    test('risk case url maps to case detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/risk-cases/rc-1'),
        '/qa/risk/rc-1',
      );
    });

    test('integrity case url maps to case detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/integrity-cases/ic-1'),
        '/qa/integrity/ic-1',
      );
    });

    test('recognition request url maps to recognition detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/recognition-requests/rr-1',
        ),
        '/reviewer/recognition/rr-1',
      );
    });

    test('bare recognition list url maps to recognition hub', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/reviewer/recognition-requests',
        ),
        '/reviewer/recognition',
      );
    });

    test('enrollment url maps to pending enrollments', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/reviewer/enrollment-requests',
        ),
        '/reviewer/enrollments',
      );
    });

    test('academic student report url maps to reviewer student detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/academic/field-training/reports/student/app-1',
        ),
        '/reviewer/students/app-1',
      );
    });

    test('academic students list url maps to reviewer students hub', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/academic/field-training/students',
        ),
        '/reviewer/students',
      );
    });

    test('unknown academic FT url falls back to reviewer reports', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/academic/field-training/reports/university',
        ),
        '/reviewer/reports',
      );
    });

    test('unrecognized url returns null', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/totally/unknown'),
        isNull,
      );
    });

    test('null and empty action urls return null', () {
      expect(NotificationNavigator.mobileRouteFromActionUrl(null), isNull);
      expect(NotificationNavigator.mobileRouteFromActionUrl(''), isNull);
    });
  });

  group('Offline cache isolation', () {
    test('reviewer namespaces are isolated per user', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = await OfflineCache.open();
      await cache.writeJson(
        userId: 'qa-a',
        namespace: 'reviewer_dashboard',
        payload: {'openQaReviewsCount': 0},
      );
      await cache.writeJson(
        userId: 'ur-b',
        namespace: 'reviewer_dashboard',
        payload: {'openQaReviewsCount': 7},
      );
      expect(
        cache
            .readJson(userId: 'qa-a', namespace: 'reviewer_dashboard')
            ?.data['openQaReviewsCount'],
        0,
      );
      expect(
        cache
            .readJson(userId: 'ur-b', namespace: 'reviewer_dashboard')
            ?.data['openQaReviewsCount'],
        7,
      );
      await cache.clearUser('qa-a');
      expect(
        cache.readJson(userId: 'qa-a', namespace: 'reviewer_dashboard'),
        isNull,
      );
      expect(
        cache.readJson(userId: 'ur-b', namespace: 'reviewer_dashboard'),
        isNotNull,
      );
      await cache.clearAll();
    });

    test(
      'qa_officer and university_reviewer namespaces do not collide',
      () async {
        SharedPreferences.setMockInitialValues({});
        final cache = await OfflineCache.open();
        await cache.writeJson(
          userId: 'same-user',
          namespace: 'qa_reviews',
          payload: {
            'items': [
              {'id': 'qr-1'},
            ],
          },
        );
        await cache.writeJson(
          userId: 'same-user',
          namespace: 'recognition_requests',
          payload: {
            'items': [
              {'id': 'rr-1'},
            ],
          },
        );
        expect(
          cache
              .readJson(userId: 'same-user', namespace: 'qa_reviews')
              ?.data['items'],
          [
            {'id': 'qr-1'},
          ],
        );
        expect(
          cache
              .readJson(userId: 'same-user', namespace: 'recognition_requests')
              ?.data['items'],
          [
            {'id': 'rr-1'},
          ],
        );
        await cache.clearAll();
      },
    );
  });
}
