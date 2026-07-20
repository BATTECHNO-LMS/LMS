import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'firebase_messaging_background_handler.dart';
import 'push_message.dart';
import 'push_messaging_gateway.dart';

/// Real Firebase Cloud Messaging gateway.
///
/// Only ever constructed by `pushMessagingGatewayProvider` when
/// `PushConfig.isConfigured` is true. Since this repo ships no
/// `firebase_options.dart`, that flag is always `false` here, so this class
/// is compiled (it must be, to type-check) but never instantiated or
/// exercised at runtime — `Firebase.initializeApp()` is never called.
class FirebasePushMessagingGateway implements PushMessagingGateway {
  FirebaseMessaging? _messaging;

  FirebaseMessaging get _instance {
    final messaging = _messaging;
    if (messaging == null) {
      throw StateError(
        'FirebasePushMessagingGateway.initialize() was not called',
      );
    }
    return messaging;
  }

  @override
  Future<void> initialize() async {
    if (_messaging != null) return;
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    _messaging = FirebaseMessaging.instance;
  }

  @override
  Future<String?> getToken() => _instance.getToken();

  @override
  Stream<String> get onTokenRefresh => _instance.onTokenRefresh;

  @override
  Stream<PushMessage> get onForegroundMessage =>
      FirebaseMessaging.onMessage.map(_toPushMessage);

  @override
  Future<PushMessage?> getInitialMessage() async {
    final message = await _instance.getInitialMessage();
    return message == null ? null : _toPushMessage(message);
  }

  @override
  Stream<PushMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp.map(_toPushMessage);

  @override
  Future<PushPermissionStatus> requestPermission() async {
    final settings = await _instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return _fromAuthorizationStatus(settings.authorizationStatus);
  }

  @override
  Future<PushPermissionStatus> permissionStatus() async {
    final settings = await _instance.getNotificationSettings();
    return _fromAuthorizationStatus(settings.authorizationStatus);
  }

  PushMessage _toPushMessage(RemoteMessage message) {
    return PushMessage.fromData(
      message.data,
      title: message.notification?.title,
      body: message.notification?.body,
    );
  }

  PushPermissionStatus _fromAuthorizationStatus(AuthorizationStatus status) {
    switch (status) {
      case AuthorizationStatus.authorized:
        return PushPermissionStatus.granted;
      case AuthorizationStatus.provisional:
        return PushPermissionStatus.provisional;
      case AuthorizationStatus.denied:
        return PushPermissionStatus.denied;
      case AuthorizationStatus.notDetermined:
        return PushPermissionStatus.notDetermined;
    }
  }
}
