import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';

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

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: CircleAvatar(
            radius: 42,
            child: Text(
              user.fullName.isNotEmpty ? user.fullName.characters.first : '?',
              style: const TextStyle(fontSize: 28),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            user.fullName,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(height: 4),
        Center(child: Text(l10n.superAdminRoleLabel)),
        const SizedBox(height: 8),
        if (user.isGlobal)
          Center(
            child: Chip(
              avatar: const Icon(Icons.public, size: 16, color: Colors.white),
              label: Text(l10n.isGlobalBadge),
              backgroundColor: Colors.green.shade700,
              labelStyle: const TextStyle(color: Colors.white),
            ),
          ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row(l10n.email, user.email),
                _row(l10n.accountStatus, user.status),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        InfoBanner(message: l10n.profileReadOnlyNotice),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.push('/super/settings'),
          child: Text(l10n.settings),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => context.push('/super/system-status'),
          icon: const Icon(Icons.monitor_heart_outlined),
          label: Text(l10n.systemStatusTitle),
        ),
        const SizedBox(height: 24),
        PrimaryButton(label: l10n.logout, onPressed: onLogout),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
