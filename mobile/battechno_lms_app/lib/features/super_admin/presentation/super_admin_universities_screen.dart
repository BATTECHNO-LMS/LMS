import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';

/// Searchable universities list (`super_admin` shell tab 2).
class SuperAdminUniversitiesScreen extends ConsumerStatefulWidget {
  const SuperAdminUniversitiesScreen({super.key});

  @override
  ConsumerState<SuperAdminUniversitiesScreen> createState() =>
      _SuperAdminUniversitiesScreenState();
}

class _SuperAdminUniversitiesScreenState
    extends ConsumerState<SuperAdminUniversitiesScreen> {
  List<UniversityItem> _all = const [];
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
      final items = await ref
          .read(superAdminRepositoryProvider)
          .listUniversities(userId: _userId());
      setState(() => _all = items);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _userId() => ref.read(authControllerProvider).user?.id;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final filtered = _search.trim().isEmpty
        ? _all
        : _all
              .where(
                (u) => u.name.toLowerCase().contains(_search.toLowerCase()),
              )
              .toList();

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/super/universities/new'),
        icon: const Icon(Icons.add),
        label: Text(l10n.createUniversity),
      ),
      body: SafeArea(child: _buildBody(l10n, filtered)),
    );
  }

  Widget _buildBody(AppLocalizations l10n, List<UniversityItem> filtered) {
    if (_loading && _all.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network' && _all.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            decoration: InputDecoration(
              hintText: l10n.searchUniversities,
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            EmptyState(title: l10n.noUniversitiesFound)
          else
            for (final uni in filtered) ...[
              Card(
                child: ListTile(
                  leading: const Icon(Icons.account_balance_outlined),
                  title: Text(uni.name),
                  subtitle: Text(
                    SuperAdminLabels.universityStatusAr(uni.status),
                  ),
                  trailing: StatusChip(
                    label: SuperAdminLabels.universityStatusAr(uni.status),
                    color: _statusColor(uni.status),
                  ),
                  onTap: () => context.push('/super/universities/${uni.id}'),
                ),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 72),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
        return BatColors.success;
      case 'inactive':
        return BatColors.warning;
      case 'archived':
        return BatColors.muted;
      default:
        return BatColors.info;
    }
  }
}
