import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_controller.dart';

/// Registration-token platform string expected by the backend
/// (`mobilePush.validation.js` — `android` | `ios`).
abstract final class PushPlatform {
  static String get current => Platform.isIOS ? 'ios' : 'android';
}

/// Registers/unregisters this device's push token with
/// `POST/DELETE /api/v1/mobile/push/register`. Never sends a `user_id` —
/// the backend derives ownership from the authenticated session.
class PushTokenSyncService {
  PushTokenSyncService(this._client);

  final ApiClient _client;

  /// Pure body-builder — kept separate from the network call so request
  /// shape is unit-testable without a live/mocked Dio instance.
  static Map<String, dynamic> buildRegisterBody({
    required String registrationToken,
    required String platform,
    String? appVersion,
    String? locale,
    String? permissionStatus,
    String? appId,
    String? deviceInstallationId,
  }) {
    return {
      'registration_token': registrationToken,
      'platform': platform,
      if (appVersion != null && appVersion.isNotEmpty)
        'app_version': appVersion,
      if (locale != null && locale.isNotEmpty) 'locale': locale,
      if (permissionStatus != null && permissionStatus.isNotEmpty)
        'permission_status': permissionStatus,
      if (appId != null && appId.isNotEmpty) 'app_id': appId,
      if (deviceInstallationId != null && deviceInstallationId.isNotEmpty)
        'device_installation_id': deviceInstallationId,
    };
  }

  Future<void> register({
    required String registrationToken,
    String? appVersion,
    String? locale,
    String? permissionStatus,
    String? appId,
    String? deviceInstallationId,
  }) async {
    await _client.postJson(
      _client.endpoints.mobilePushRegister,
      body: buildRegisterBody(
        registrationToken: registrationToken,
        platform: PushPlatform.current,
        appVersion: appVersion,
        locale: locale,
        permissionStatus: permissionStatus,
        appId: appId,
        deviceInstallationId: deviceInstallationId,
      ),
    );
  }

  Future<void> unregister(String registrationToken) async {
    await _client.deleteJson(
      _client.endpoints.mobilePushRegister,
      body: {'registration_token': registrationToken},
    );
  }

  Future<void> unregisterAll() async {
    await _client.deleteJson(_client.endpoints.mobilePushRegisterAll);
  }

  /// Best-effort — never throws. Used on logout/account-switch where a
  /// failed unregister call must not block sign-out.
  Future<void> unregisterAllBestEffort() async {
    try {
      await unregisterAll();
    } catch (_) {
      // Sign-out must always proceed locally regardless of network state.
    }
  }
}

final pushTokenSyncServiceProvider = Provider<PushTokenSyncService>(
  (ref) => PushTokenSyncService(ref.watch(apiClientProvider)),
);
