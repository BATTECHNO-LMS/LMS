import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Top-level background message handler, required by `firebase_messaging`
/// to run in its own background isolate (no widget tree / router / Riverpod
/// context is available here).
///
/// Only ever registered by [FirebasePushMessagingGateway.initialize] — which
/// is only ever called when `PushConfig.isConfigured` is true. Deliberately
/// does nothing beyond a debug-only log: it must never navigate or touch
/// app state from a background isolate.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    final type = message.data['notification_type'] ?? 'unknown';
    debugPrint('[push] background message received (type=$type)');
  }
}
