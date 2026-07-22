import 'push_message.dart';

/// Abstraction over the push messaging SDK so the rest of the app never
/// imports `firebase_messaging` directly. [NoOpPushMessagingGateway] is used
/// whenever `PushConfig.isConfigured` is false (the default in this repo);
/// `FirebasePushMessagingGateway` is only ever constructed otherwise.
abstract class PushMessagingGateway {
  /// Idempotent. Must never throw when push is disabled/misconfigured.
  Future<void> initialize();

  /// Current device registration token, or `null` if unavailable/disabled.
  Future<String?> getToken();

  /// Fires when the platform issues a new token (rotation).
  Stream<String> get onTokenRefresh;

  /// Messages received while the app is in the foreground.
  Stream<PushMessage> get onForegroundMessage;

  /// The message that launched the app from a terminated state (tap), if any.
  Future<PushMessage?> getInitialMessage();

  /// Messages tapped while the app was backgrounded (not terminated).
  Stream<PushMessage> get onMessageOpenedApp;

  /// Requests OS-level notification permission (no-op / denied when disabled).
  Future<PushPermissionStatus> requestPermission();

  /// Reads the current OS-level permission status without prompting.
  Future<PushPermissionStatus> permissionStatus();
}
