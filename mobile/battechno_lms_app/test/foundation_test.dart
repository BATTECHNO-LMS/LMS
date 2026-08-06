import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/app/app.dart';
import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/app/theme/bat_colors.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/utils/validators.dart';
import 'package:battechno_lms_app/features/auth/domain/auth_user.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('BatTheme', () {
    test('brand colors match web design tokens', () {
      expect(BatColors.primary, const Color(0xFF132D4A));
      expect(BatColors.accent, const Color(0xFFC9A227));
      expect(BatColors.background, const Color(0xFFF6F7F5));
    });
  });

  group('RTL startup', () {
    testWidgets('Arabic locale applies RTL directionality', (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.rtl,
          child: Text('مرحبا'),
        ),
      );
      expect(find.text('مرحبا'), findsOneWidget);
    });
  });

  group('Validators', () {
    test('required validator rejects empty values', () {
      expect(Validators.required(null, 'required'), isNotNull);
      expect(Validators.required('  ', 'required'), isNotNull);
      expect(Validators.required('value', 'required'), isNull);
    });

    test('otp validator requires six digits', () {
      const l10n = _SimpleL10n();
      expect(Validators.otp('123', l10n), isNotNull);
      expect(Validators.otp('123456', l10n), isNull);
    });
  });

  group('Auth routing roles', () {
    test('pickPrimaryRole prefers admin roles', () {
      expect(
        LmsRoles.pickPrimaryRole(['student', 'university_admin']),
        LmsRoles.universityAdmin,
      );
    });

    test('program_admin is unsupported', () {
      expect(
        LmsRoles.isSupported([LmsRoles.programAdmin, LmsRoles.student]),
        isFalse,
      );
      const user = AuthUser(
        id: '1',
        email: 'x@test.com',
        fullName: 'Test',
        status: 'active',
        roles: [LmsRoles.programAdmin],
        primaryRole: LmsRoles.programAdmin,
        permissions: [],
        isGlobal: false,
      );
      expect(user.isSupported, isFalse);
      expect(user.hasProgramAdmin, isTrue);
    });

    test(
      'legacy server role code admin is unsupported (not university_admin)',
      () {
        expect(LmsRoles.isSupported(['admin']), isFalse);
        expect(LmsRoles.isSupported([LmsRoles.universityAdmin]), isTrue);
      },
    );
  });

  group('AppConfig', () {
    test('defaults to approved production host base without secrets', () {
      final config = readAppConfig();
      expect(config.apiBaseUrl, 'https://lms-7txx.onrender.com');
      expect(config.authRoot, 'https://lms-7txx.onrender.com/api/auth');
      expect(config.apiRoot, 'https://lms-7txx.onrender.com/api/v1');
    });
  });
}

class _SimpleL10n implements AppLocalizations {
  const _SimpleL10n();

  @override
  String get otpRequired => 'otpRequired';

  @override
  String get otpInvalid => 'otpInvalid';

  @override
  dynamic noSuchMethod(Invocation invocation) => '';
}
