import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/storage/offline_cache.dart';
import 'package:battechno_lms_app/core/widgets/app_shell.dart';
import 'package:battechno_lms_app/features/admin/domain/admin_models.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';

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

  group('University admin shell nav', () {
    test('exposes exactly five destinations', () {
      final l10n = lookupAppLocalizations(const Locale('ar'));
      final items = shellNavForRole(LmsRoles.universityAdmin, l10n);
      expect(items.length, 5);
      expect(items.map((e) => e.label).toList(), [
        l10n.home,
        l10n.opportunities,
        l10n.trainees,
        l10n.reports,
        l10n.profile,
      ]);
    });

    testWidgets('renders labels', (tester) async {
      await tester.pumpWidget(shellHarness(LmsRoles.universityAdmin));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('الفرص'), findsOneWidget);
      expect(find.text('المتدربون'), findsOneWidget);
      expect(find.text('التقارير'), findsOneWidget);
      expect(find.text('حسابي'), findsOneWidget);
    });
  });

  group('Academic admin shell nav', () {
    test('exposes exactly five destinations with training label', () {
      final l10n = lookupAppLocalizations(const Locale('ar'));
      final items = shellNavForRole(LmsRoles.academicAdmin, l10n);
      expect(items.length, 5);
      expect(items.map((e) => e.label).toList(), [
        l10n.home,
        l10n.training,
        l10n.trainees,
        l10n.reports,
        l10n.profile,
      ]);
    });

    testWidgets('renders labels', (tester) async {
      await tester.pumpWidget(shellHarness(LmsRoles.academicAdmin));
      expect(find.text('الرئيسية'), findsOneWidget);
      expect(find.text('التدريب'), findsOneWidget);
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

  group('AdminCapabilities', () {
    test('field-training admin write access is shared by both admin roles', () {
      expect(
        AdminCapabilities.canManageOpportunities(LmsRoles.universityAdmin),
        isTrue,
      );
      expect(
        AdminCapabilities.canManageOpportunities(LmsRoles.academicAdmin),
        isTrue,
      );
      expect(
        AdminCapabilities.canReviewApplications(LmsRoles.universityAdmin),
        isTrue,
      );
      expect(
        AdminCapabilities.canReviewApplications(LmsRoles.academicAdmin),
        isTrue,
      );
      expect(AdminCapabilities.canWriteHours(LmsRoles.universityAdmin), isTrue);
      expect(AdminCapabilities.canWriteHours(LmsRoles.academicAdmin), isTrue);
    });

    test('users and admin-stats reads are university_admin only', () {
      expect(AdminCapabilities.canReadUsers(LmsRoles.universityAdmin), isTrue);
      expect(AdminCapabilities.canReadUsers(LmsRoles.academicAdmin), isFalse);
      expect(
        AdminCapabilities.canReadAdminStats(LmsRoles.universityAdmin),
        isTrue,
      );
      expect(
        AdminCapabilities.canReadAdminStats(LmsRoles.academicAdmin),
        isFalse,
      );
    });

    test(
      'program_admin and instructor are fail-closed for every capability',
      () {
        for (final role in [
          LmsRoles.programAdmin,
          LmsRoles.instructor,
          LmsRoles.student,
        ]) {
          expect(AdminCapabilities.canManageOpportunities(role), isFalse);
          expect(AdminCapabilities.canReviewApplications(role), isFalse);
          expect(AdminCapabilities.canWriteHours(role), isFalse);
          expect(AdminCapabilities.canReadUsers(role), isFalse);
          expect(AdminCapabilities.canReadAdminStats(role), isFalse);
        }
      },
    );
  });

  group('Opportunity model', () {
    test('required hours parses numeric api field', () {
      final opp = AdminOpportunity({
        'id': '1',
        'title': 'T',
        'required_training_hours': 90,
      });
      expect(opp.requiredHours, 90);
    });

    test('sections map statuses', () {
      expect(
        AdminOpportunity({'status': 'draft'}).section,
        AdminOpportunitySection.draft,
      );
      expect(
        AdminOpportunity({'status': 'published'}).section,
        AdminOpportunitySection.published,
      );
      expect(
        AdminOpportunity({'status': 'archived'}).section,
        AdminOpportunitySection.archived,
      );
    });
  });

  group('Required hours validation', () {
    test('empty clears the target', () {
      expect(AdminLabels.isValidRequiredHours(''), isTrue);
    });

    test('rejects zero and negative values', () {
      expect(AdminLabels.isValidRequiredHours('0'), isFalse);
      expect(AdminLabels.isValidRequiredHours('-5'), isFalse);
    });

    test('accepts positive integers within range', () {
      expect(AdminLabels.isValidRequiredHours('120'), isTrue);
      expect(AdminLabels.isValidRequiredHours('10001'), isFalse);
    });
  });

  group('Priority actions', () {
    test('review submissions takes precedence over pending applications', () {
      final list = AdminOpportunityListData(
        opportunities: [
          AdminOpportunity({
            'id': 'a',
            'title': 'Alpha',
            'status': 'published',
            'pending_submissions_count': 2,
          }),
        ],
      );
      final data = AdminDashboardData(
        list: list,
        ftStats: const AdminFieldTrainingStats({'pendingApplications': 4}),
      );
      expect(data.priorityAction?.type, AdminPriorityType.reviewSubmissions);
      expect(data.priorityAction?.count, 2);
    });

    test('falls back to pending applications when no submissions pending', () {
      final list = AdminOpportunityListData(
        opportunities: [
          AdminOpportunity({
            'id': 'a',
            'title': 'Alpha',
            'status': 'published',
          }),
        ],
      );
      final data = AdminDashboardData(
        list: list,
        ftStats: const AdminFieldTrainingStats({'pendingApplications': 3}),
      );
      expect(data.priorityAction?.type, AdminPriorityType.reviewApplications);
      expect(data.priorityAction?.count, 3);
    });

    test('null when nothing needs attention', () {
      const list = AdminOpportunityListData(opportunities: []);
      expect(const AdminDashboardData(list: list).priorityAction, isNull);
    });
  });

  group('Admin notification deep links', () {
    test('maps manage url to opportunity detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/abc/manage',
        ),
        '/admin/field-training/abc',
      );
    });

    test('maps tasks path to submissions', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/abc/tasks',
        ),
        '/admin/field-training/abc/submissions',
      );
    });

    test('maps applications path', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/abc/applications',
        ),
        '/admin/field-training/abc/applications',
      );
    });

    test('maps admin application deep link', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/applications/xyz',
        ),
        '/admin/applications/xyz',
      );
    });

    test('bare opportunity url maps to detail', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/admin/field-training/abc',
        ),
        '/admin/field-training/abc',
      );
    });
  });

  group('Offline cache isolation', () {
    test('admin namespaces are isolated per user', () async {
      SharedPreferences.setMockInitialValues({});
      final cache = await OfflineCache.open();
      await cache.writeJson(
        userId: 'ua-a',
        namespace: 'admin_dashboard',
        payload: {'opportunities': []},
      );
      await cache.writeJson(
        userId: 'ua-b',
        namespace: 'admin_dashboard',
        payload: {
          'opportunities': [
            {'id': '1'},
          ],
        },
      );
      expect(
        cache
            .readJson(userId: 'ua-a', namespace: 'admin_dashboard')
            ?.data['opportunities'],
        isEmpty,
      );
      expect(
        cache
            .readJson(userId: 'ua-b', namespace: 'admin_dashboard')
            ?.data['opportunities'],
        isNotEmpty,
      );
      await cache.clearUser('ua-a');
      expect(
        cache.readJson(userId: 'ua-a', namespace: 'admin_dashboard'),
        isNull,
      );
      expect(
        cache.readJson(userId: 'ua-b', namespace: 'admin_dashboard'),
        isNotNull,
      );
      await cache.clearAll();
    });
  });
}
