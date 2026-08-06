import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/notifications_repository.dart';
import '../domain/notification_models.dart';

class NotificationsInboxScreen extends ConsumerStatefulWidget {
  const NotificationsInboxScreen({super.key, this.embeddedInShell = false});

  /// When true (QA shell tab), skip inner Scaffold/AppBar — shell owns chrome.
  final bool embeddedInShell;

  @override
  ConsumerState<NotificationsInboxScreen> createState() =>
      _NotificationsInboxScreenState();
}

class _NotificationsInboxScreenState
    extends ConsumerState<NotificationsInboxScreen> {
  static const _pageBg = Color(0xFFF2F3F5);

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
    final body = SafeArea(child: _buildBody(l10n, state));

    if (widget.embeddedInShell) {
      return ColoredBox(color: _pageBg, child: body);
    }

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Text(l10n.notifications),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: body,
    );
  }

  Widget _buildBody(AppLocalizations l10n, AsyncValue<NotificationPage> state) {
    return state.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      ),
      error: (_, _) => RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _refresh,
      ),
      data: (page) {
        final unread = page.notifications.where((n) => !n.isRead).length;
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              _SoftCard(
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: BatColors.primarySoft,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.notifications_outlined,
                        color: BatColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.notifications,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.notificationsUnreadCount(unread),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: BatColors.muted),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: unread == 0
                          ? null
                          : () => ref
                                .read(notificationsControllerProvider.notifier)
                                .markAllRead(),
                      style: TextButton.styleFrom(
                        foregroundColor: BatColors.primaryLight,
                      ),
                      child: Text(
                        l10n.markAllRead,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _UnreadFilterBar(
                unreadOnly: _unreadOnly,
                allLabel: l10n.coursesFilterAll,
                unreadLabel: l10n.unreadOnly,
                onChanged: (value) {
                  setState(() => _unreadOnly = value);
                  ref
                      .read(notificationsControllerProvider.notifier)
                      .refresh(unreadOnly: value);
                },
              ),
              const SizedBox(height: 14),
              if (page.notifications.isEmpty)
                EmptyState(
                  title: l10n.noNotifications,
                  icon: Icons.notifications_none_outlined,
                )
              else
                for (final n in page.notifications)
                  _NotificationCard(
                    notification: n,
                    onTap: () => _openNotification(n),
                  ),
            ],
          ),
        );
      },
    );
  }
}

class _SoftCard extends StatelessWidget {
  const _SoftCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

class _UnreadFilterBar extends StatelessWidget {
  const _UnreadFilterBar({
    required this.unreadOnly,
    required this.allLabel,
    required this.unreadLabel,
    required this.onChanged,
  });

  final bool unreadOnly;
  final String allLabel;
  final String unreadLabel;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6E8EC)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _FilterSegment(
              label: allLabel,
              icon: Icons.inbox_outlined,
              selected: !unreadOnly,
              onTap: () => onChanged(false),
            ),
          ),
          Expanded(
            child: _FilterSegment(
              label: unreadLabel,
              icon: Icons.mark_email_unread_outlined,
              selected: unreadOnly,
              onTap: () => onChanged(true),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterSegment extends StatelessWidget {
  const _FilterSegment({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BatColors.primarySoft : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: selected ? BatColors.primary : const Color(0xFF8B93A0),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: selected
                        ? BatColors.primary
                        : const Color(0xFF8B93A0),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  IconData get _icon {
    switch (notification.type) {
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

  Color get _iconBg {
    switch (notification.type) {
      case 'action_required':
        return BatColors.accentSoft;
      case 'success':
        return BatColors.success.withValues(alpha: 0.12);
      case 'warning':
      case 'danger':
        return const Color(0xFFFFF1E8);
      default:
        return BatColors.primarySoft;
    }
  }

  Color get _iconColor {
    switch (notification.type) {
      case 'action_required':
        return BatColors.accentHover;
      case 'success':
        return BatColors.successText;
      case 'warning':
      case 'danger':
        return const Color(0xFFC45C26);
      default:
        return BatColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = notification.createdAt.length >= 10
        ? notification.createdAt.substring(0, 10)
        : notification.createdAt;
    final unread = !notification.isRead;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: unread
                    ? BatColors.primaryLight.withValues(alpha: 0.45)
                    : const Color(0xFFE6E8EC),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1A2330).withValues(alpha: 0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: _iconBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(_icon, color: _iconColor, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                notification.title,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: BatColors.heading,
                                    ),
                              ),
                            ),
                            if (unread)
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsetsDirectional.only(
                                  start: 8,
                                ),
                                decoration: const BoxDecoration(
                                  color: BatColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          notification.body,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: BatColors.muted, height: 1.35),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          date,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: const Color(0xFF8B93A0),
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Icon(Icons.chevron_left, color: BatColors.muted),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
