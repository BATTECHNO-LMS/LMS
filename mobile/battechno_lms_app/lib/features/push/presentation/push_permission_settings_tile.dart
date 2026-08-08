import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/push/push_config.dart';
import '../../../core/push/push_message.dart';
import '../providers/push_permission_controller.dart';

/// Settings-screen row showing the current OS notification permission
/// status. When push isn't configured (the default in this repo) it shows
/// an "unsupported" label rather than a misleading toggle.
class PushPermissionSettingsTile extends ConsumerStatefulWidget {
  const PushPermissionSettingsTile({super.key});

  @override
  ConsumerState<PushPermissionSettingsTile> createState() =>
      _PushPermissionSettingsTileState();
}

class _PushPermissionSettingsTileState
    extends ConsumerState<PushPermissionSettingsTile> {
  @override
  void initState() {
    super.initState();
    if (PushConfig.isConfigured) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(pushPermissionControllerProvider.notifier).refreshStatus();
      });
    }
  }

  String _statusLabel(AppLocalizations l10n, PushPermissionStatus status) {
    switch (status) {
      case PushPermissionStatus.granted:
        return l10n.pushPermissionStatusGranted;
      case PushPermissionStatus.provisional:
        return l10n.pushPermissionStatusProvisional;
      case PushPermissionStatus.denied:
        return l10n.pushPermissionStatusDenied;
      case PushPermissionStatus.notDetermined:
        return l10n.pushPermissionStatusNotDetermined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(pushPermissionControllerProvider);

    if (!PushConfig.isConfigured) {
      return SettingsSoftTile(
        icon: Icons.notifications_outlined,
        title: l10n.pushPermissionSettingsTitle,
        subtitle: l10n.pushPermissionStatusUnsupported,
      );
    }

    final canRequest = state.status != PushPermissionStatus.granted;
    return SettingsSoftTile(
      icon: Icons.notifications_outlined,
      title: l10n.pushPermissionSettingsTitle,
      subtitle: _statusLabel(l10n, state.status),
      trailing: !canRequest
          ? null
          : TextButton(
              onPressed: state.isSyncing
                  ? null
                  : () => ref
                        .read(pushPermissionControllerProvider.notifier)
                        .requestAndSync(),
              style: TextButton.styleFrom(
                foregroundColor: BatColors.primaryLight,
              ),
              child: Text(
                l10n.pushPermissionSettingsAction,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
    );
  }
}

/// Soft settings row used by [SettingsScreen] and push permission tile.
class SettingsSoftTile extends StatelessWidget {
  const SettingsSoftTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.showDivider = false,
    this.iconColor,
    this.iconBackgroundColor,
    this.titleColor,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool showDivider;
  final Color? iconColor;
  final Color? iconBackgroundColor;
  final Color? titleColor;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBackgroundColor ?? BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor ?? BatColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: titleColor ?? BatColors.heading,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: BatColors.muted,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 4), trailing!],
          if (trailing == null && onTap != null)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Icon(Icons.chevron_left, color: BatColors.muted),
            ),
        ],
      ),
    );

    return Column(
      children: [
        Material(
          color: Colors.transparent,
          child: onTap == null
              ? content
              : InkWell(
                  onTap: onTap,
                  borderRadius: BorderRadius.circular(12),
                  child: content,
                ),
        ),
        if (showDivider)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Divider(height: 1, color: Color(0xFFE6E8EC)),
          ),
      ],
    );
  }
}
