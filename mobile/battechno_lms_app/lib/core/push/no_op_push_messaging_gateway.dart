import 'push_message.dart';
import 'push_messaging_gateway.dart';

/// Used whenever `PushConfig.isConfigured` is false — the default in this
/// repo, since no `firebase_options.dart` / native config files are shipped.
/// Every method is a safe, immediate no-op; nothing here ever touches
/// Firebase native code.
class NoOpPushMessagingGateway implements PushMessagingGateway {
  @override
  Future<void> initialize() async {}

  @override
  Future<String?> getToken() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream.empty();

  @override
  Stream<PushMessage> get onForegroundMessage => const Stream.empty();

  @override
  Future<PushMessage?> getInitialMessage() async => null;

  @override
  Stream<PushMessage> get onMessageOpenedApp => const Stream.empty();

  @override
  Future<PushPermissionStatus> requestPermission() async =>
      PushPermissionStatus.denied;

  @override
  Future<PushPermissionStatus> permissionStatus() async =>
      PushPermissionStatus.denied;
}
