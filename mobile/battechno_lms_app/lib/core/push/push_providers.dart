import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'firebase_push_messaging_gateway.dart';
import 'local_notification_service.dart';
import 'no_op_push_messaging_gateway.dart';
import 'push_config.dart';
import 'push_messaging_gateway.dart';

/// Selects the push gateway implementation. Always [NoOpPushMessagingGateway]
/// in this repo — `PushConfig.isConfigured` is a compile-time `false`
/// constant until an owner adds Firebase config files (see
/// `PHASE_25_PUSH_NOTIFICATIONS.md`), so the `FirebasePushMessagingGateway()`
/// branch below is dead code in every build produced from this repo.
final pushMessagingGatewayProvider = Provider<PushMessagingGateway>((ref) {
  if (!PushConfig.isConfigured) return NoOpPushMessagingGateway();
  return FirebasePushMessagingGateway();
});

final localNotificationServiceProvider = Provider<LocalNotificationService>(
  (ref) => LocalNotificationService(),
);
