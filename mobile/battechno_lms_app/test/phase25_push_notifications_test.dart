import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/core/push/push_config.dart';
import 'package:battechno_lms_app/core/push/push_message.dart';
import 'package:battechno_lms_app/core/push/no_op_push_messaging_gateway.dart';
import 'package:battechno_lms_app/features/auth/domain/auth_user.dart';
import 'package:battechno_lms_app/features/notifications/domain/notification_models.dart';
import 'package:battechno_lms_app/features/push/data/push_token_sync_service.dart';
import 'package:battechno_lms_app/features/push/providers/push_route_coordinator.dart';
import 'package:battechno_lms_app/features/super_admin/domain/super_admin_models.dart';

AuthUser _user({
  required String primaryRole,
  required bool isGlobal,
  List<String>? roles,
}) {
  return AuthUser(
    id: 'u-1',
    email: 'user@example.com',
    fullName: 'Test User',
    status: 'active',
    roles: roles ?? [primaryRole],
    primaryRole: primaryRole,
    permissions: const [],
    isGlobal: isGlobal,
  );
}

void main() {
  group('PushConfig', () {
    test('push is disabled by default (no firebase_options.dart shipped)', () {
      expect(PushConfig.isConfigured, isFalse);
    });
  });

  group('NoOpPushMessagingGateway', () {
    test('every operation is a safe no-op', () async {
      final gateway = NoOpPushMessagingGateway();
      await gateway.initialize();
      expect(await gateway.getToken(), isNull);
      expect(await gateway.getInitialMessage(), isNull);
      expect(await gateway.requestPermission(), PushPermissionStatus.denied);
      expect(await gateway.permissionStatus(), PushPermissionStatus.denied);
      expect(await gateway.onTokenRefresh.isEmpty, isTrue);
      expect(await gateway.onForegroundMessage.isEmpty, isTrue);
      expect(await gateway.onMessageOpenedApp.isEmpty, isTrue);
    });
  });

  group('PushMessage.fromData', () {
    test('reads the privacy-allowlisted data payload only', () {
      final message = PushMessage.fromData(
        {
          'notification_id': 'n-1',
          'notification_type': 'enrollment_approved',
          'action_url': '/student/programs',
          'event_version': '1',
        },
        title: 'Title',
        body: 'Body',
      );
      expect(message.notificationId, 'n-1');
      expect(message.notificationType, 'enrollment_approved');
      expect(message.actionUrl, '/student/programs');
      expect(message.title, 'Title');
      expect(message.body, 'Body');
    });

    test('tolerates missing keys', () {
      final message = PushMessage.fromData(const {});
      expect(message.notificationId, isNull);
      expect(message.actionUrl, isNull);
      expect(message.title, isNull);
    });
  });

  group('Permission explanation strings exist (AR + EN)', () {
    for (final localeCode in ['ar', 'en']) {
      test('$localeCode has non-empty push permission copy', () {
        final l10n = lookupAppLocalizations(Locale(localeCode));
        expect(l10n.pushPermissionSheetTitle, isNotEmpty);
        expect(l10n.pushPermissionSheetBody, isNotEmpty);
        expect(l10n.pushPermissionEnableAction, isNotEmpty);
        expect(l10n.pushPermissionSkipAction, isNotEmpty);
        expect(l10n.pushNotificationChannelName, isNotEmpty);
        expect(l10n.pushNotificationChannelDescription, isNotEmpty);
        expect(l10n.pushPermissionSettingsTitle, isNotEmpty);
        expect(l10n.pushPermissionStatusGranted, isNotEmpty);
        expect(l10n.pushPermissionStatusDenied, isNotEmpty);
        expect(l10n.pushPermissionStatusUnsupported, isNotEmpty);
      });
    }
  });

  group('PushTokenSyncService.buildRegisterBody (request shape)', () {
    test(
      'includes registration_token and platform only when others absent',
      () {
        final body = PushTokenSyncService.buildRegisterBody(
          registrationToken: 'tok-123',
          platform: 'android',
        );
        expect(body, {'registration_token': 'tok-123', 'platform': 'android'});
      },
    );

    test('includes optional metadata when provided, omits empty strings', () {
      final body = PushTokenSyncService.buildRegisterBody(
        registrationToken: 'tok-123',
        platform: 'ios',
        appVersion: '1.2.3',
        locale: 'ar',
        permissionStatus: 'granted',
        appId: 'com.battechno.battechnoLmsApp',
        deviceInstallationId: 'device-abc',
      );
      expect(body['registration_token'], 'tok-123');
      expect(body['platform'], 'ios');
      expect(body['app_version'], '1.2.3');
      expect(body['locale'], 'ar');
      expect(body['permission_status'], 'granted');
      expect(body['app_id'], 'com.battechno.battechnoLmsApp');
      expect(body['device_installation_id'], 'device-abc');
    });

    test('never includes a user/account identifier field', () {
      final body = PushTokenSyncService.buildRegisterBody(
        registrationToken: 'tok-123',
        platform: 'android',
      );
      expect(body.containsKey('user_id'), isFalse);
      expect(body.containsKey('userId'), isFalse);
    });

    test('PushPlatform.current is android or ios', () {
      expect(['android', 'ios'].contains(PushPlatform.current), isTrue);
    });
  });

  group('PushRouteCoordinator', () {
    test('known action_url resolves to a mapped mobile route', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final coordinator = container.read(pushRouteCoordinatorProvider.notifier);

      final route = coordinator.handleActionUrl('/student/field-training/ft-1');
      expect(route, '/student/field-training/ft-1');
      expect(container.read(pushRouteCoordinatorProvider), route);
    });

    test('unknown action_url resolves to null (never an arbitrary route)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final coordinator = container.read(pushRouteCoordinatorProvider.notifier);

      final route = coordinator.handleActionUrl('/totally/unmapped/path');
      expect(route, isNull);
    });

    test('null/empty action_url resolves to null', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final coordinator = container.read(pushRouteCoordinatorProvider.notifier);

      expect(coordinator.handleActionUrl(null), isNull);
      expect(coordinator.handleActionUrl(''), isNull);
    });

    test('consumePendingRoute returns the route once, then null', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final coordinator = container.read(pushRouteCoordinatorProvider.notifier);

      coordinator.handleActionUrl('/admin/field-training/ft-1/applications');
      expect(
        coordinator.consumePendingRoute(),
        '/admin/field-training/ft-1/applications',
      );
      expect(coordinator.consumePendingRoute(), isNull);
    });

    test('logout (clear) discards any pending navigation', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final coordinator = container.read(pushRouteCoordinatorProvider.notifier);

      coordinator.handleActionUrl('/qa-reviews/qr-1');
      expect(container.read(pushRouteCoordinatorProvider), isNotNull);

      coordinator.clear();
      expect(container.read(pushRouteCoordinatorProvider), isNull);
      expect(coordinator.consumePendingRoute(), isNull);
    });
  });

  group('Regression: program_admin remains unsupported', () {
    test('fail-closed for the mobile shell', () {
      expect(LmsRoles.isSupported(['program_admin']), isFalse);
      expect(LmsRoles.activeRoles.contains(LmsRoles.programAdmin), isFalse);
    });
  });

  group(
    'Regression: SuperAdminCapabilities.canAccess (isGlobal fail-closed)',
    () {
      test('true only when role is super_admin AND isGlobal is true', () {
        final globalSuperAdmin = _user(
          primaryRole: LmsRoles.superAdmin,
          isGlobal: true,
        );
        expect(SuperAdminCapabilities.canAccess(globalSuperAdmin), isTrue);
      });

      test('false when isGlobal is false, even if role claims super_admin', () {
        final nonGlobalSuperAdmin = _user(
          primaryRole: LmsRoles.superAdmin,
          isGlobal: false,
        );
        expect(SuperAdminCapabilities.canAccess(nonGlobalSuperAdmin), isFalse);
      });
    },
  );

  group('Regression: NotificationNavigator still maps existing URLs', () {
    test('field-training/qa/recognition URLs unchanged by Phase 25', () {
      expect(
        NotificationNavigator.mobileRouteFromActionUrl(
          '/student/field-training/ft-1',
        ),
        '/student/field-training/ft-1',
      );
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/qa-reviews/qr-1'),
        '/qa/reviews/qr-1',
      );
      expect(
        NotificationNavigator.mobileRouteFromActionUrl('/users/user-1'),
        '/super/users/user-1',
      );
    });
  });
}
