import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/widgets/app_shell.dart';
import 'package:battechno_lms_app/core/widgets/bat_widgets.dart';

void main() {
  testWidgets('student navigation shell exposes four destinations', (
    tester,
  ) async {
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
        home: Builder(
          builder: (context) {
            final l10n = AppLocalizations.of(context);
            final items = shellNavForRole(LmsRoles.student, l10n);
            return Scaffold(
              bottomNavigationBar: AppBottomNavigation(
                items: items,
                currentIndex: 0,
                onTap: (_) {},
              ),
            );
          },
        ),
      ),
    );

    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('التدريب'), findsOneWidget);
    expect(find.text('الكورسات'), findsOneWidget);
    expect(find.text('حسابي'), findsOneWidget);
  });

  testWidgets('instructor navigation shell exposes four destinations', (
    tester,
  ) async {
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
        home: Builder(
          builder: (context) {
            final l10n = AppLocalizations.of(context);
            final items = shellNavForRole(LmsRoles.instructor, l10n);
            return Scaffold(
              bottomNavigationBar: AppBottomNavigation(
                items: items,
                currentIndex: 0,
                onTap: (_) {},
              ),
            );
          },
        ),
      ),
    );

    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('تدريباتي'), findsOneWidget);
    expect(find.text('الطلاب'), findsOneWidget);
    expect(find.text('حسابي'), findsOneWidget);
  });

  testWidgets('error state renders retry affordance', (tester) async {
    var retried = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RetryView(
            title: 'Network',
            message: 'Offline',
            onRetry: () => retried = true,
          ),
        ),
      ),
    );

    expect(find.text('Network'), findsOneWidget);
    expect(find.text('Offline'), findsOneWidget);
    await tester.tap(find.byType(OutlinedButton));
    expect(retried, isTrue);
  });
}
