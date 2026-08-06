import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../auth/domain/auth_user.dart';
import '../../dashboard/presentation/home_shell_screen.dart';
import '../../notifications/data/notifications_repository.dart';
import 'widgets/super_admin_widgets.dart';

/// `super_admin` profile — shows the backend-verified `isGlobal` badge so
/// the user can see at a glance that global scope is active.
class SuperAdminProfileScreen extends ConsumerWidget {
  const SuperAdminProfileScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final AuthUser user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final unread =
        ref
            .watch(notificationsControllerProvider)
            .valueOrNull
            ?.notifications
            .where((n) => !n.isRead)
            .length ??
        0;
    final subtitle = user.isGlobal
        ? l10n.isGlobalBadge
        : l10n.superAdminRoleLabel;

    return ColoredBox(
      color: kSaPageBg,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          SaProfileHero(
            title: l10n.yourProfile,
            name: user.fullName,
            roleLabel: l10n.superAdminRoleLabel,
            subtitle: subtitle,
            unreadCount: unread,
            onNotifications: () => context.push('/notifications'),
            onBack: () =>
                ref.read(shellTabIndexRequestProvider.notifier).state = 0,
          ),
          Transform.translate(
            offset: const Offset(0, -18),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
              child: Column(
                children: [
                  SaSoftCard(
                    child: Column(
                      children: [
                        SaInfoRow(label: l10n.email, value: user.email),
                        const SizedBox(height: 12),
                        SaInfoRow(
                          label: l10n.accountStatus,
                          value: user.status,
                        ),
                        if (user.isGlobal) ...[
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  l10n.isGlobalBadge,
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(color: BatColors.muted),
                                ),
                              ),
                              SaStatusBadge(
                                label: l10n.isGlobalBadge,
                                tone: SaBadgeTone.success,
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SaSoftCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: BatColors.accentSoft,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.info_outline,
                            color: BatColors.accentHover,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            l10n.profileReadOnlyNotice,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: BatColors.heading,
                                  height: 1.4,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/super/settings'),
                      icon: const Icon(Icons.settings_outlined, size: 18),
                      label: Text(
                        l10n.settings,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      style: saOutlinedButtonStyle(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/super/system-status'),
                      icon: const Icon(Icons.monitor_heart_outlined, size: 18),
                      label: Text(
                        l10n.systemStatusTitle,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      style: saOutlinedButtonStyle(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: onLogout,
                      style: saPrimaryButtonStyle(),
                      child: Text(
                        l10n.logout,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.paddingOf(context).bottom + 88),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
