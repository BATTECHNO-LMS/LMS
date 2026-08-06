import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/super_admin_repository.dart';
import 'widgets/super_admin_widgets.dart';

/// Read-only audit log list — safe display fields only (action type, entity
/// type, actor name, timestamp). Never renders `old_values`/`new_values`,
/// `ip_address`, or any raw JSON/tokens; the repository already strips
/// those before this screen ever sees them.
class SuperAdminAuditScreen extends ConsumerStatefulWidget {
  const SuperAdminAuditScreen({super.key});

  @override
  ConsumerState<SuperAdminAuditScreen> createState() =>
      _SuperAdminAuditScreenState();
}

class _SuperAdminAuditScreenState extends ConsumerState<SuperAdminAuditScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;
  String _search = '';

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
      final userId = ref.read(authControllerProvider).user?.id;
      final result = await ref
          .read(superAdminRepositoryProvider)
          .listAuditLogs(userId: userId, search: _search);
      setState(() => _items = result.items);
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 403
            ? 'forbidden'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: l10n.auditLogsTitle,
        onBack: () => context.pop(),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading && _items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && _items.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          TextField(
            decoration:
                saSoftFieldDecoration(
                  l10n.searchAuditLogs,
                  hint: l10n.searchAuditLogs,
                ).copyWith(
                  prefixIcon: const Icon(
                    Icons.search,
                    color: BatColors.primaryLight,
                  ),
                ),
            onChanged: (v) => _search = v,
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 14),
          if (_items.isEmpty)
            EmptyState(title: l10n.noAuditLogs)
          else
            for (final row in _items) _auditCard(row),
        ],
      ),
    );
  }

  Widget _auditCard(Map<String, dynamic> row) {
    final subtitle = [
      row['entity_type']?.toString(),
      (row['user'] as Map?)?['full_name']?.toString(),
    ].whereType<String>().join(' • ');

    return SaSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.receipt_long_outlined,
              color: BatColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['action_type']?.toString() ?? '—',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _shortDate(row['created_at']?.toString()),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: BatColors.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _shortDate(String? value) {
    if (value == null || value.length < 10) return value ?? '—';
    return value.substring(0, 10);
  }
}
