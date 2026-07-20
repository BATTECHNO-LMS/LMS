import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/push/push_config.dart';
import '../../../core/push/push_message.dart';
import '../../../core/push/push_messaging_gateway.dart';
import '../../../core/push/push_providers.dart';
import '../data/push_token_sync_service.dart';

/// Device-level (not per-account) flag — OS notification permission is
/// scoped to the device/app install, so re-asking after every login (or for
/// a second account on the same device) would be noisy and pointless.
const String pushPermissionPromptedPrefsKey =
    'battechno_push_permission_prompted';

class PushPermissionControllerState {
  const PushPermissionControllerState({
    this.status = PushPermissionStatus.notDetermined,
    this.hasPrompted = false,
    this.isSyncing = false,
  });

  final PushPermissionStatus status;
  final bool hasPrompted;
  final bool isSyncing;

  bool get isGrantedOrProvisional =>
      status == PushPermissionStatus.granted ||
      status == PushPermissionStatus.provisional;

  PushPermissionControllerState copyWith({
    PushPermissionStatus? status,
    bool? hasPrompted,
    bool? isSyncing,
  }) {
    return PushPermissionControllerState(
      status: status ?? this.status,
      hasPrompted: hasPrompted ?? this.hasPrompted,
      isSyncing: isSyncing ?? this.isSyncing,
    );
  }
}

/// Orchestrates the permission-education flow: check whether push is
/// configured, load whether the user was already prompted on this device,
/// and (on request) ask the OS for permission and sync the resulting token.
///
/// Every method below is a safe no-op when `PushConfig.isConfigured` is
/// false — the default in this repo.
class PushPermissionController extends Notifier<PushPermissionControllerState> {
  @override
  PushPermissionControllerState build() =>
      const PushPermissionControllerState();

  Future<bool> loadHasPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    final hasPrompted = prefs.getBool(pushPermissionPromptedPrefsKey) ?? false;
    state = state.copyWith(hasPrompted: hasPrompted);
    return hasPrompted;
  }

  Future<void> markPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(pushPermissionPromptedPrefsKey, true);
    state = state.copyWith(hasPrompted: true);
  }

  Future<void> refreshStatus() async {
    if (!PushConfig.isConfigured) return;
    final status = await ref
        .read(pushMessagingGatewayProvider)
        .permissionStatus();
    state = state.copyWith(status: status);
  }

  /// Requests OS permission, then registers the device token when granted
  /// (or provisional, iOS-only). No-op when push isn't configured.
  Future<void> requestAndSync({String? locale, String? appVersion}) async {
    if (!PushConfig.isConfigured) return;
    state = state.copyWith(isSyncing: true);
    try {
      final gateway = ref.read(pushMessagingGatewayProvider);
      await gateway.initialize();
      final status = await gateway.requestPermission();
      state = state.copyWith(status: status);
      if (status == PushPermissionStatus.granted ||
          status == PushPermissionStatus.provisional) {
        await _syncToken(
          gateway,
          status,
          locale: locale,
          appVersion: appVersion,
        );
      }
    } finally {
      state = state.copyWith(isSyncing: false);
    }
  }

  Future<void> _syncToken(
    PushMessagingGateway gateway,
    PushPermissionStatus status, {
    String? locale,
    String? appVersion,
  }) async {
    final token = await gateway.getToken();
    if (token == null || token.isEmpty) return;
    await ref
        .read(pushTokenSyncServiceProvider)
        .register(
          registrationToken: token,
          appVersion: appVersion,
          locale: locale,
          permissionStatus: status.name,
        );
  }
}

final pushPermissionControllerProvider =
    NotifierProvider<PushPermissionController, PushPermissionControllerState>(
      PushPermissionController.new,
    );
