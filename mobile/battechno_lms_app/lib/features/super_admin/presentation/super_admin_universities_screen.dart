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
import 'widgets/super_admin_widgets.dart';

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

    return ColoredBox(
      color: kSaPageBg,
      child: Stack(
        children: [
          SafeArea(child: _buildBody(l10n, filtered)),
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton.extended(
              onPressed: () => context.push('/super/universities/new'),
              backgroundColor: BatColors.primary,
              foregroundColor: Colors.white,
              elevation: 2,
              icon: const Icon(Icons.add),
              label: Text(
                l10n.createUniversity,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
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
      color: BatColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
        children: [
          TextField(
            decoration:
                saSoftFieldDecoration(
                  l10n.searchUniversities,
                  hint: l10n.searchUniversities,
                ).copyWith(
                  prefixIcon: const Icon(
                    Icons.search,
                    color: BatColors.primaryLight,
                  ),
                ),
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            EmptyState(title: l10n.noUniversitiesFound)
          else
            for (final uni in filtered)
              SaListTileCard(
                title: uni.name,
                subtitle: SuperAdminLabels.universityStatusAr(uni.status),
                leadingIcon: Icons.account_balance_outlined,
                badge: SaStatusBadge(
                  label: SuperAdminLabels.universityStatusAr(uni.status),
                  tone: _statusTone(uni.status),
                ),
                onTap: () => context.push('/super/universities/${uni.id}'),
              ),
        ],
      ),
    );
  }

  SaBadgeTone _statusTone(String status) {
    switch (status) {
      case 'active':
        return SaBadgeTone.success;
      case 'inactive':
        return SaBadgeTone.accent;
      case 'archived':
        return SaBadgeTone.neutral;
      default:
        return SaBadgeTone.primary;
    }
  }
}
