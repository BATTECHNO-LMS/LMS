import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/notification_models.dart';

class NotificationsRepository {
  NotificationsRepository(this._client);

  final ApiClient _client;

  Future<NotificationPage> load({
    int page = 1,
    int pageSize = 20,
    bool? isRead,
  }) async {
    final data = await _client.getJson(
      _client.endpoints.notifications,
      query: {
        'page': page,
        'page_size': pageSize,
        if (isRead != null) 'is_read': isRead ? 'true' : 'false',
      },
    );
    final meta = data['meta'] is Map<String, dynamic>
        ? data['meta'] as Map<String, dynamic>
        : <String, dynamic>{};
    final list = (data['notifications'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(AppNotification.fromMap)
        .toList();
    return NotificationPage(
      notifications: list,
      page: _asInt(meta['page'], page),
      pageSize: _asInt(meta['page_size'], pageSize),
      total: _asInt(meta['total'], list.length),
      totalPages: _asInt(meta['total_pages'], 1),
    );
  }

  Future<AppNotification> markRead(String id) async {
    final data = await _client.patchJson(
      _client.endpoints.notificationRead(id),
    );
    final notification = data['notification'];
    if (notification is Map<String, dynamic>) {
      return AppNotification.fromMap(notification);
    }
    return AppNotification.fromMap(data);
  }

  Future<int> markAllRead() async {
    final data = await _client.patchJson(
      _client.endpoints.notificationsReadAll,
    );
    return _asInt(data['updated_count'], 0);
  }

  int _asInt(dynamic value, int fallback) {
    if (value is num) return value.toInt();
    return fallback;
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(apiClientProvider)),
);

class NotificationsController extends Notifier<AsyncValue<NotificationPage>> {
  @override
  AsyncValue<NotificationPage> build() => const AsyncValue.loading();

  Future<void> refresh({bool? unreadOnly}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref
          .read(notificationsRepositoryProvider)
          .load(isRead: unreadOnly == true ? false : null),
    );
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationsRepositoryProvider).markRead(id);
    await refresh();
  }

  Future<void> markAllRead() async {
    await ref.read(notificationsRepositoryProvider).markAllRead();
    await refresh();
  }

  int get unreadBadgeCount {
    final page = state.valueOrNull;
    if (page == null) return 0;
    return page.notifications.where((n) => !n.isRead).length;
  }
}

final notificationsControllerProvider =
    NotifierProvider<NotificationsController, AsyncValue<NotificationPage>>(
      NotificationsController.new,
    );
