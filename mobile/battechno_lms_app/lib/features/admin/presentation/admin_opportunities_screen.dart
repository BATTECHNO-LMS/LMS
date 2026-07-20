import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';
import 'widgets/admin_widgets.dart';

class AdminOpportunitiesScreen extends ConsumerStatefulWidget {
  const AdminOpportunitiesScreen({super.key});

  @override
  ConsumerState<AdminOpportunitiesScreen> createState() =>
      _AdminOpportunitiesScreenState();
}

class _AdminOpportunitiesScreenState
    extends ConsumerState<AdminOpportunitiesScreen> {
  AdminOpportunityListData? _data;
  bool _loading = true;
  String? _error;
  String _search = '';
  AdminOpportunitySection _section = AdminOpportunitySection.published;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(adminRepositoryProvider)
          .listOpportunities(userId: user.id, search: _search);
      setState(() => _data = data);
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
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/field-training/new'),
        icon: const Icon(Icons.add),
        label: Text(l10n.createOpportunity),
      ),
      body: _buildBody(l10n),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading && _data == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network' && _data == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final items = _data?.forSection(_section) ?? const [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            decoration: InputDecoration(
              hintText: l10n.searchAssignedTrainings,
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => _search = v,
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final section in [
                  AdminOpportunitySection.published,
                  AdminOpportunitySection.draft,
                  AdminOpportunitySection.inProgress,
                  AdminOpportunitySection.archived,
                ])
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ChoiceChip(
                      label: Text(AdminLabels.sectionAr(section)),
                      selected: _section == section,
                      onSelected: (_) => setState(() => _section = section),
                    ),
                  ),
              ],
            ),
          ),
          if (_data?.fromCache == true) ...[
            const SizedBox(height: 8),
            InfoBanner(message: l10n.offlineCachedBanner),
          ],
          const SizedBox(height: 12),
          if (items.isEmpty)
            EmptyState(
              title: l10n.noOpportunities,
              subtitle: l10n.noTrainingInSection,
            )
          else
            for (final opp in items) ...[
              AdminOpportunityCard(
                opportunity: opp,
                onTap: () => context.push('/admin/field-training/${opp.id}'),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 72),
        ],
      ),
    );
  }
}
