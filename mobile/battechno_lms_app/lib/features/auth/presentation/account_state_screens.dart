import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';

class PendingApprovalScreen extends StatelessWidget {
  const PendingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _StatusScaffold(
      icon: Icons.hourglass_top_outlined,
      title: l10n.accountPendingTitle,
      body: l10n.accountPendingBody,
      actionLabel: l10n.login,
      onAction: () => context.go('/auth/login'),
    );
  }
}

class InactiveAccountScreen extends StatelessWidget {
  const InactiveAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _StatusScaffold(
      icon: Icons.block_outlined,
      title: l10n.accountInactiveTitle,
      body: l10n.accountInactiveBody,
      actionLabel: l10n.login,
      onAction: () => context.go('/auth/login'),
    );
  }
}

class UnsupportedRoleScreen extends StatelessWidget {
  const UnsupportedRoleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _StatusScaffold(
      icon: Icons.no_accounts_outlined,
      title: l10n.unsupportedRoleTitle,
      body: l10n.unsupportedRoleBody,
      actionLabel: l10n.login,
      onAction: () => context.go('/auth/login'),
    );
  }
}

class NetworkErrorScreen extends StatelessWidget {
  const NetworkErrorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _StatusScaffold(
      icon: Icons.wifi_off_rounded,
      title: l10n.networkErrorTitle,
      body: l10n.networkErrorBody,
      actionLabel: l10n.retry,
      onAction: () => context.go('/auth/login'),
    );
  }
}

class _StatusScaffold extends StatelessWidget {
  const _StatusScaffold({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Icon(icon, size: 72, color: BatColors.primaryLight),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center),
              const Spacer(),
              PrimaryButton(label: actionLabel, onPressed: onAction),
            ],
          ),
        ),
      ),
    );
  }
}
