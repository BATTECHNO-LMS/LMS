import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/notifications_repository.dart';
import '../domain/notification_models.dart';

class NotificationsInboxScreen extends ConsumerStatefulWidget {
  const NotificationsInboxScreen({super.key});

  @override
  ConsumerState<NotificationsInboxScreen> createState() =>
      _NotificationsInboxScreenState();
}

class _NotificationsInboxScreenState
    extends ConsumerState<NotificationsInboxScreen> {
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(notificationsControllerProvider.notifier)
          .refresh(unreadOnly: _unreadOnly);
    });
  }

  Future<void> _refresh() async {
    await ref
        .read(notificationsControllerProvider.notifier)
        .refresh(unreadOnly: _unreadOnly);
  }

  Future<void> _openNotification(AppNotification notification) async {
    if (!notification.isRead) {
      await ref
          .read(notificationsControllerProvider.notifier)
          .markRead(notification.id);
    }
    if (!mounted) return;
    final route = NotificationNavigator.mobileRouteFromActionUrl(
      notification.actionUrl,
    );
    final l10n = AppLocalizations.of(context);
    if (route != null) {
      context.push(route);
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.notificationTargetUnavailable)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(notificationsControllerProvider);

    return state.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      ),
      error: (_, __) => RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _refresh,
      ),
      data: (page) {
        final unread = page.notifications.where((n) => !n.isRead).length;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.notificationsUnreadCount(unread),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: unread == 0
                        ? null
                        : () => ref
                              .read(notificationsControllerProvider.notifier)
                              .markAllRead(),
                    child: Text(l10n.markAllRead),
                  ),
                ],
              ),
              FilterChip(
                label: Text(l10n.unreadOnly),
                selected: _unreadOnly,
                onSelected: (value) {
                  setState(() => _unreadOnly = value);
                  ref
                      .read(notificationsControllerProvider.notifier)
                      .refresh(unreadOnly: value);
                },
              ),
              const SizedBox(height: 12),
              if (page.notifications.isEmpty)
                EmptyState(
                  title: l10n.noNotifications,
                  icon: Icons.notifications_none_outlined,
                )
              else
                ...page.notifications.map(
                  (n) => Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    color: n.isRead ? null : BatColors.primarySoft,
                    child: ListTile(
                      leading: Icon(_iconForType(n.type)),
                      title: Text(n.title),
                      subtitle: Text(
                        n.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(
                        n.createdAt.length >= 10
                            ? n.createdAt.substring(0, 10)
                            : n.createdAt,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      onTap: () => _openNotification(n),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'action_required':
        return Icons.flag_outlined;
      case 'success':
        return Icons.check_circle_outline;
      case 'warning':
      case 'danger':
        return Icons.warning_amber_outlined;
      default:
        return Icons.notifications_outlined;
    }
  }
}
