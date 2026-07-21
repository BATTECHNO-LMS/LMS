import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/storage/offline_cache.dart';
import 'package:battechno_lms_app/core/widgets/app_shell.dart';
import 'package:battechno_lms_app/features/admin/domain/admin_models.dart';
import 'package:battechno_lms_app/features/auth/domain/auth_user.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';
import 'package:battechno_lms_app/features/reviewer/domain/reviewer_models.dart';
import 'package:battechno_lms_app/features/super_admin/domain/super_admin_models.dart';

AuthUser _user({
  required String primaryRole,
  required bool isGlobal,
  List<String>? roles,
  String status = 'active',
}) {
  return AuthUser(
    id: 'u-1',
    email: 'user@example.com',
    fullName: 'Test User',
    status: status,
    roles: roles ?? [primaryRole],
    primaryRole: primaryRole,
    permissions: const [],
    isGlobal: isGlobal,
  );
}

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

  group('super_admin shell nav', () {
    test('exposes exactly five destinations', () {
      final l10n = lookupAppLocalizations(const Locale('ar'));
      final items = shellNavForRole(LmsRoles.superAdmin, l10n);
      expect(items.length, 5);
      expect(items.map((e) => e.label).toList(), [
        l10n.home,
        l10n.universities,
        l10n.users,
        l10n.reports,
        l10n.profile,
      ]);
    });

    testWidgets('renders labels', (tester) async {
      await tester.pumpWidget(shellHarness(LmsRoles.superAdmin));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('الجامعات'), findsOneWidget);
      expect(find.text('المستخدمون'), findsOneWidget);
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

  group('SuperAdminCapabilities.canAccess (isGlobal fail-closed)', () {
    test('true only when role is super_admin AND isGlobal is true', () {
      final globalSuperAdmin = _user(
        primaryRole: LmsRoles.superAdmin,
        isGlobal: true,
      );
      expect(SuperAdminCapabilities.canAccess(globalSuperAdmin), isTrue);
    });

    test(
      'false when role claims super_admin but isGlobal is false '
      '(stale token / revoked privilege) — fail closed, never trust role alone',
      () {
        final nonGlobalSuperAdmin = _user(
          primaryRole: LmsRoles.superAdmin,
          isGlobal: false,
        );
        expect(SuperAdminCapabilities.canAccess(nonGlobalSuperAdmin), isFalse);
        expect(
          SuperAdminCapabilities.canWriteUsers(nonGlobalSuperAdmin),
          isFalse,
        );
        expect(
          SuperAdminCapabilities.canWriteUniversities(nonGlobalSuperAdmin),
          isFalse,
        );
        expect(
          SuperAdminCapabilities.canManageFieldTraining(nonGlobalSuperAdmin),
          isFalse,
        );
        expect(
          SuperAdminCapabilities.canReadAuditLogs(nonGlobalSuperAdmin),
          isFalse,
        );
      },
    );

    test('false for any other role, even with isGlobal true', () {
      final other = _user(
        primaryRole: LmsRoles.universityAdmin,
        isGlobal: true,
      );
      expect(SuperAdminCapabilities.canAccess(other), isFalse);
    });

    test('false for program_admin regardless of isGlobal', () {
      final programAdmin = _user(
        primaryRole: LmsRoles.programAdmin,
        isGlobal: true,
        roles: [LmsRoles.programAdmin],
      );
      expect(SuperAdminCapabilities.canAccess(programAdmin), isFalse);
    });
  });

  group('SuperAdminCapabilities.assignableRoles', () {
    test('never includes program_admin', () {
      expect(
        SuperAdminCapabilities.assignableRoles.contains(LmsRoles.programAdmin),
        isFalse,
      );
      expect(
        SuperAdminCapabilities.isRoleAssignable(LmsRoles.programAdmin),
        isFalse,
      );
    });

    test(
      'includes university_admin, academic_admin, and other active roles',
      () {
        expect(
          SuperAdminCapabilities.assignableRoles,
          containsAll([
            LmsRoles.universityAdmin,
            LmsRoles.academicAdmin,
            LmsRoles.qaOfficer,
            LmsRoles.instructor,
            LmsRoles.student,
            LmsRoles.universityReviewer,
          ]),
        );
      },
    );

    test(
      'includes super_admin itself (SA-to-SA assignment requires UI confirmation)',
      () {
        expect(
          SuperAdminCapabilities.assignableRoles.contains(LmsRoles.superAdmin),
          isTrue,
        );
      },
    );
  });

  group('AdminCapabilities extended for super_admin', () {
    test(
      'super_admin can write hours / manage opportunities / review applications',
      () {
        expect(
          AdminCapabilities.isFieldTrainingAdmin(LmsRoles.superAdmin),
          isTrue,
        );
        expect(AdminCapabilities.canWriteHours(LmsRoles.superAdmin), isTrue);
        expect(
          AdminCapabilities.canManageOpportunities(LmsRoles.superAdmin),
          isTrue,
        );
        expect(
          AdminCapabilities.canReviewApplications(LmsRoles.superAdmin),
          isTrue,
        );
      },
    );

    test('super_admin can read users and admin stats', () {
      expect(AdminCapabilities.canReadUsers(LmsRoles.superAdmin), isTrue);
      expect(AdminCapabilities.canReadAdminStats(LmsRoles.superAdmin), isTrue);
    });

    test('existing university_admin/academic_admin behavior is unchanged', () {
      expect(
        AdminCapabilities.isFieldTrainingAdmin(LmsRoles.universityAdmin),
        isTrue,
      );
      expect(
        AdminCapabilities.isFieldTrainingAdmin(LmsRoles.academicAdmin),
        isTrue,
      );
      expect(AdminCapabilities.canReadUsers(LmsRoles.academicAdmin), isFalse);
      expect(
        AdminCapabilities.isFieldTrainingAdmin(LmsRoles.programAdmin),
        isFalse,
      );
    });
  });

  group('ReviewerCapabilities super_admin bypass', () {
    test(
      'super_admin with isGlobal true can access QA, recognition, and enrollment',
      () {
        const caps = ReviewerCapabilities(LmsRoles.superAdmin, isGlobal: true);
        expect(caps.canAccessQaReviews, isTrue);
        expect(caps.canWriteQaStatus, isTrue);
        expect(caps.canAccessRiskIntegrity, isTrue);
        expect(caps.canAccessRecognition, isTrue);
        expect(caps.canDecideRecognition, isTrue);
        expect(caps.canDecideEnrollment, isTrue);
        expect(caps.canReadCertificates, isTrue);
      },
    );

    test(
      'super_admin with isGlobal false gets none of the bypass (fail closed)',
      () {
        const caps = ReviewerCapabilities(LmsRoles.superAdmin, isGlobal: false);
        expect(caps.canAccessQaReviews, isFalse);
        expect(caps.canAccessRecognition, isFalse);
        expect(caps.canDecideEnrollment, isFalse);
        expect(caps.canReadCertificates, isFalse);
      },
    );

    test('existing qa_officer/university_reviewer behavior is unchanged', () {
      const qa = ReviewerCapabilities(LmsRoles.qaOfficer);
      expect(qa.canAccessQaReviews, isTrue);
      expect(qa.canAccessRecognition, isFalse);
      const reviewer = ReviewerCapabilities(LmsRoles.universityReviewer);
      expect(reviewer.canAccessRecognition, isTrue);
      expect(reviewer.canAccessQaReviews, isFalse);
    });

    test('neither role nor super_admin ever writes hours or attendance', () {
      const caps = ReviewerCapabilities(LmsRoles.superAdmin, isGlobal: true);
      expect(caps.canWriteHours, isFalse);
      expect(caps.canWriteAttendance, isFalse);
    });
  });

  group('Phase 24 notification deep links', () {
    test('user url maps to super_admin user detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/users/user-1'),
        '/super/users/user-1',
      );
    });

    test('university url maps to super_admin university detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/universities/uni-1'),
        '/super/universities/uni-1',
      );
    });

    test('audit log url maps to super_admin audit screen', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/audit-logs/log-1'),
        '/super/audit',
      );
    });

    test('health/system url maps to super_admin system status screen', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/health'),
        '/super/system-status',
      );
    });

    test(
      'admin field-training url still maps to admin routes for super_admin',
      () {
        expect(
          NotificationNavigator.mobileRouteFromActionUrl(
            '/admin/field-training/ft-1/applications',
          ),
          '/admin/field-training/ft-1/applications',
        );
      },
    );

    test('QA and recognition urls remain mapped as before', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/qa-reviews/qr-1'),
        '/qa/reviews/qr-1',
      );
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/recognition-requests/rr-1',
        ),
        '/reviewer/recognition/rr-1',
      );
    });
  });

  group('Offline cache isolation (sa_* namespaces)', () {
    test('sa_users namespace is isolated per user', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = await OfflineCache.open();
      await cache.writeJson(
        userId: 'sa-a',
        namespace: 'sa_users',
        payload: {'items': []},
      );
      await cache.writeJson(
        userId: 'sa-b',
        namespace: 'sa_users',
        payload: {
          'items': [
            {'id': 'user-1'},
          ],
        },
      );
      expect(
        cache.readJson(userId: 'sa-a', namespace: 'sa_users')?.data['items'],
        [],
      );
      expect(
        cache.readJson(userId: 'sa-b', namespace: 'sa_users')?.data['items'],
        [
          {'id': 'user-1'},
        ],
      );
      await cache.clearUser('sa-a');
      expect(cache.readJson(userId: 'sa-a', namespace: 'sa_users'), isNull);
      expect(cache.readJson(userId: 'sa-b', namespace: 'sa_users'), isNotNull);
      await cache.clearAll();
    });

    test(
      'sa_dashboard/sa_universities/sa_audit/sa_reports/sa_certificates do not collide',
      () async {
        SharedPreferences.setMockInitialValues({});
        final cache = await OfflineCache.open();
        const namespaces = [
          'sa_dashboard',
          'sa_universities',
          'sa_users',
          'sa_audit',
          'sa_reports',
          'sa_certificates',
        ];
        for (final ns in namespaces) {
          await cache.writeJson(
            userId: 'same-user',
            namespace: ns,
            payload: {'marker': ns},
          );
        }
        for (final ns in namespaces) {
          expect(
            cache.readJson(userId: 'same-user', namespace: ns)?.data['marker'],
            ns,
          );
        }
        await cache.clearAll();
      },
    );
  });

  group('Widget smoke: shell nav renders without throwing for super_admin', () {
    testWidgets('bottom nav tap cycles through five destinations', (
      tester,
    ) async {
      var current = 0;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('ar'),
          home: StatefulBuilder(
            builder: (context, setState) {
              final l10n = AppLocalizations.of(context);
              final items = shellNavForRole(LmsRoles.superAdmin, l10n);
              return Scaffold(
                bottomNavigationBar: AppBottomNavigation(
                  items: items,
                  currentIndex: current,
                  onTap: (i) => setState(() => current = i),
                ),
              );
            },
          ),
        ),
      );

      expect(find.text('المستخدمون'), findsOneWidget);
      await tester.tap(find.text('المستخدمون'));
      await tester.pumpAndSettle();
      expect(current, 2);
    });
  });
}
