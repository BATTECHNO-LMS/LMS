/// Mirrors the FCM notification settings authorization state so the rest of
/// the app never depends on `firebase_messaging` types directly.
enum PushPermissionStatus { granted, denied, provisional, notDetermined }

/// Normalized push message — carries only the privacy-allowlisted `data`
/// payload the backend sends (see
/// `backend/src/services/pushNotification.service.js` `buildDataPayload`),
/// plus the lock-screen `title`/`body` when present.
class PushMessage {
  const PushMessage({
    this.notificationId,
    this.notificationType,
    this.actionUrl,
    this.title,
    this.body,
  });

  final String? notificationId;
  final String? notificationType;
  final String? actionUrl;
  final String? title;
  final String? body;

  factory PushMessage.fromData(
    Map<String, dynamic> data, {
    String? title,
    String? body,
  }) {
    return PushMessage(
      notificationId: data['notification_id']?.toString(),
      notificationType: data['notification_type']?.toString(),
      actionUrl: data['action_url']?.toString(),
      title: title,
      body: body,
    );
  }
}
