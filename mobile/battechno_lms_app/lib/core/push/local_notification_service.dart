import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'push_message.dart';

/// Wraps `flutter_local_notifications` for the single channel used to
/// surface push alerts while the app is in the foreground (FCM already
/// shows a system notification for background/terminated states).
///
/// Never initialized unless push is enabled — see `push_providers.dart`.
class LocalNotificationService {
  LocalNotificationService({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _initialized = false;

  static const String channelId = 'battechno_lms_notifications';

  Future<void> initialize({
    required String channelName,
    required String channelDescription,
  }) async {
    if (_initialized) return;
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
    );
    final androidPlugin = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(
      AndroidNotificationChannel(
        channelId,
        channelName,
        description: channelDescription,
        importance: Importance.high,
      ),
    );
    _initialized = true;
  }

  /// Shows a foreground alert for [message]. No-op if [initialize] wasn't
  /// called or the message carries no visible title/body.
  Future<void> showForegroundAlert(
    PushMessage message, {
    String? fallbackTitle,
    String? fallbackBody,
  }) async {
    if (!_initialized) return;
    final title = message.title ?? fallbackTitle;
    final body = message.body ?? fallbackBody;
    if (title == null && body == null) return;
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelId,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }
}
