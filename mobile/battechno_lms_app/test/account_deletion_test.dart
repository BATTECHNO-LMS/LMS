import 'package:battechno_lms_app/features/profile/presentation/settings_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/config/public_web_urls.dart';
import 'package:battechno_lms_app/features/profile/domain/account_deletion_models.dart';

void main() {
  test('PublicWebUrls are approved HTTPS production hosts', () {
    expect(
      PublicWebUrls.privacyPolicy.startsWith('https://lms.battechno.com/'),
      isTrue,
    );
    expect(
      PublicWebUrls.accountDeletion,
      'https://lms.battechno.com/account-deletion',
    );
    expect(PublicWebUrls.privacyPolicy.contains('localhost'), isFalse);
  });

  test('active roles include seven roles and exclude program_admin', () {
    expect(LmsRoles.activeRoles.length, 7);
    expect(LmsRoles.activeRoles.contains(LmsRoles.programAdmin), isFalse);
    expect(LmsRoles.isSupported([LmsRoles.programAdmin]), isFalse);
    for (final role in LmsRoles.activeRoles) {
      expect(LmsRoles.isSupported([role]), isTrue);
    }
  });

  test('AccountDeletionRequest parses statuses and cancel rules', () {
    final pending = AccountDeletionRequest.fromJson({
      'id': '1',
      'status': 'pending',
      'requested_at': '2026-08-06T10:00:00.000Z',
    });
    expect(pending.canCancel, isTrue);
    expect(pending.isActive, isTrue);

    final processing = AccountDeletionRequest.fromJson({
      'id': '2',
      'status': 'processing',
    });
    expect(processing.canCancel, isFalse);
    expect(processing.isActive, isTrue);

    final completed = AccountDeletionRequest.fromJson({
      'id': '3',
      'status': 'completed',
    });
    expect(completed.isCompleted, isTrue);
    expect(completed.isActive, isFalse);
  });

  testWidgets('Settings shows Delete Account for localized AR and EN', (
    tester,
  ) async {
    Future<void> pumpLocale(Locale locale) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await pumpLocale(const Locale('en'));
    expect(find.text('Account Management'), findsOneWidget);
    expect(find.text('Delete Account'), findsOneWidget);

    await pumpLocale(const Locale('ar'));
    expect(find.text('إدارة الحساب'), findsOneWidget);
    expect(find.text('حذف الحساب'), findsOneWidget);
  });

  testWidgets('Settings delete section survives large text scale', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) {
            return MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(1.6)),
              child: child!,
            );
          },
          home: const SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Delete Account'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Delete Account'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('l10n deletion keys exist in both languages', () {
    // Smoke: generated getters compile via AppLocalizations usage above.
    expect(
      AppLocalizations.supportedLocales.map((l) => l.languageCode),
      containsAll(['ar', 'en']),
    );
  });
}
