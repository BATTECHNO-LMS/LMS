import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';

/// `super_admin` home — system-wide stat chips, a priority action, and
/// contextual links into universities, users, field training, QA oversight,
/// audit, system status, and certificates. This screen assumes the caller
/// has already gated entry with `SuperAdminCapabilities.canAccess`.
class SuperAdminHomeScreen extends ConsumerStatefulWidget {
  const SuperAdminHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<SuperAdminHomeScreen> createState() =>
      _SuperAdminHomeScreenState();
}

class _SuperAdminHomeScreenState extends ConsumerState<SuperAdminHomeScreen> {
  SuperAdminStats? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final stats = await ref
          .read(superAdminRepositoryProvider)
          .loadDashboardStats(userId: widget.user.id);
      setState(() => _stats = stats);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading && _stats == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network' && _stats == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final stats = _stats;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '${_greeting(l10n)}، ${widget.user.fullName.split(' ').first}',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          InfoBanner(message: l10n.superAdminGlobalScopeNotice),
          const SizedBox(height: 16),
          if (stats != null) ...[
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
                _statCard(l10n.universities, stats.universities),
                _statCard(l10n.users, stats.users),
                _statCard(l10n.superAdminCohortsLabel, stats.cohorts),
                _statCard(
                  l10n.superAdminPendingEnrollmentsLabel,
                  stats.pendingEnrollments,
                ),
              ],
            ),
            const SizedBox(height: 16),
          ] else if (_error != null)
            InfoBanner(message: l10n.networkErrorBody),
          AcademicSectionHeader(title: l10n.quickActions),
          const SizedBox(height: 8),
          _actionTile(
            icon: Icons.account_balance_outlined,
            label: l10n.universities,
            onTap: () => context.push('/home/universities'),
          ),
          _actionTile(
            icon: Icons.group_outlined,
            label: l10n.users,
            onTap: () => context.push('/home/users'),
          ),
          _actionTile(
            icon: Icons.hiking_outlined,
            label: l10n.superAdminFieldTrainingOversight,
            onTap: () => context.push('/super/field-training'),
          ),
          _actionTile(
            icon: Icons.fact_check_outlined,
            label: l10n.superAdminQaOversight,
            onTap: () => context.push('/super/qa'),
          ),
          _actionTile(
            icon: Icons.receipt_long_outlined,
            label: l10n.auditLogsTitle,
            onTap: () => context.push('/super/audit'),
          ),
          _actionTile(
            icon: Icons.monitor_heart_outlined,
            label: l10n.systemStatusTitle,
            onTap: () => context.push('/super/system-status'),
          ),
          _actionTile(
            icon: Icons.workspace_premium_outlined,
            label: l10n.certificatesTitle,
            onTap: () => context.push('/super/certificates'),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String label, int value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$value',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
            ),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _actionTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon),
        title: Text(label),
        trailing: const Icon(Icons.chevron_left),
        onTap: onTap,
      ),
    );
  }

  String _greeting(AppLocalizations l10n) {
    final hour = DateTime.now().hour;
    return hour < 17 ? l10n.greetingMorning : l10n.greetingEvening;
  }
}
