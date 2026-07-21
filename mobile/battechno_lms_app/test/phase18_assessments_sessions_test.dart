import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/widgets/bat_widgets.dart';
import 'package:battechno_lms_app/features/auth/domain/auth_user.dart';
import 'package:battechno_lms_app/features/field_training/domain/assessment_models.dart';
import 'package:battechno_lms_app/features/field_training/domain/session_models.dart';
import 'package:battechno_lms_app/features/field_training/presentation/widgets/assessment_widgets.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Assessment availability', () {
    test('pre-assessment available when can_take is true', () {
      const summary = StudentAssessmentSummary(
        id: '1',
        type: 'pre',
        title: 'Pre',
        status: 'published',
        canTake: true,
      );
      expect(
        AssessmentLabels.resolveAction(summary: summary, isRequired: true),
        AssessmentPrimaryAction.start,
      );
    });

    test('post-assessment locked when can_take is false', () {
      const summary = StudentAssessmentSummary(
        id: '2',
        type: 'post',
        title: 'Post',
        status: 'published',
        canTake: false,
      );
      expect(
        AssessmentLabels.resolveAction(summary: summary, isRequired: true),
        AssessmentPrimaryAction.unavailable,
      );
    });

    test('completed assessment shows view result action', () {
      const summary = StudentAssessmentSummary(
        id: '3',
        type: 'pre',
        title: 'Pre',
        status: 'published',
        canTake: false,
        attempt: {'score': 80, 'submitted_at': '2026-01-01'},
      );
      expect(
        AssessmentLabels.resolveAction(summary: summary, isRequired: true),
        AssessmentPrimaryAction.viewResult,
      );
    });
  });

  group('Assessment answer validation', () {
    test('requires answers for mandatory questions', () {
      final error = AssessmentAnswerValidator.validateRequired(
        questions: [
          {'id': 'q1', 'is_required': true},
        ],
        answers: {},
      );
      expect(error, isNotNull);
    });

    test('accepts filled answers', () {
      final error = AssessmentAnswerValidator.validateRequired(
        questions: [
          {'id': 'q1', 'is_required': true},
        ],
        answers: {'q1': 'answer'},
      );
      expect(error, isNull);
    });
  });

  group('Assessment result rendering', () {
    testWidgets('renders passed result state', (tester) async {
      await tester.pumpWidget(
        _localized(
          Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return AssessmentResultHero(
                l10n: l10n,
                score: 85,
                passed: true,
                level: 'advanced',
              );
            },
          ),
        ),
      );
      expect(find.text('النتيجة: 85%'), findsOneWidget);
      expect(find.text('ناجح'), findsOneWidget);
    });

    testWidgets('renders failed result state', (tester) async {
      await tester.pumpWidget(
        _localized(
          Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return AssessmentResultHero(l10n: l10n, score: 40, passed: false);
            },
          ),
        ),
      );
      expect(find.text('النتيجة: 40%'), findsOneWidget);
      expect(find.text('غير ناجح'), findsOneWidget);
    });
  });

  group('Session and attendance mapping', () {
    test('maps attendance statuses to Arabic labels', () {
      expect(SessionLabels.attendanceAr(AttendanceStatus.present), 'حضرت');
      expect(
        SessionLabels.attendanceAr(AttendanceStatus.pending),
        'لم يسجل الحضور بعد',
      );
    });

    testWidgets('empty sessions state uses localized copy', (tester) async {
      await tester.pumpWidget(
        _localized(
          Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return EmptyState(
                title: l10n.noSessionsCurrently,
                icon: Icons.event_outlined,
              );
            },
          ),
        ),
      );
      expect(find.text('لا توجد جلسات مجدولة حاليًا.'), findsOneWidget);
    });
  });

  group('Student route protection', () {
    test('program_admin remains unsupported', () {
      const user = AuthUser(
        id: '1',
        email: 'admin@test.com',
        fullName: 'Admin',
        status: 'active',
        roles: [LmsRoles.programAdmin],
        primaryRole: LmsRoles.programAdmin,
        permissions: [],
        isGlobal: false,
      );
      expect(user.isSupported, isFalse);
    });
  });

  group('Assessment question navigation widget', () {
    testWidgets('shows question progress in RTL locale', (tester) async {
      await tester.pumpWidget(
        _localized(
          Builder(
            builder: (context) {
              final l10n = AppLocalizations.of(context);
              return Directionality(
                textDirection: TextDirection.rtl,
                child: QuestionProgressHeader(current: 2, total: 5, l10n: l10n),
              );
            },
          ),
        ),
      );
      expect(find.text('السؤال 2 من 5'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

Widget _localized(Widget child) {
  return MaterialApp(
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('ar'),
    home: Scaffold(body: child),
  );
}
