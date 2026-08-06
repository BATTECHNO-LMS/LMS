import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
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

  static const _sections = [
    AdminOpportunitySection.published,
    AdminOpportunitySection.draft,
    AdminOpportunitySection.inProgress,
    AdminOpportunitySection.archived,
  ];

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

  Map<AdminOpportunitySection, int> get _counts {
    final data = _data;
    if (data == null) {
      return {for (final s in _sections) s: 0};
    }
    return {for (final s in _sections) s: data.forSection(s).length};
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kAdminPageBg,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/field-training/new'),
        backgroundColor: BatColors.primary,
        foregroundColor: Colors.white,
        elevation: 2,
        icon: const Icon(Icons.add),
        label: Text(
          l10n.createOpportunity,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
        children: [
          TextField(
            decoration: InputDecoration(
              hintText: l10n.searchAssignedTrainings,
              prefixIcon: const Icon(
                Icons.search,
                color: BatColors.primaryLight,
              ),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(
                  color: BatColors.primary,
                  width: 1.4,
                ),
              ),
            ),
            onChanged: (v) => _search = v,
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 12),
          _SectionFilterBar(
            selected: _section,
            counts: _counts,
            onChanged: (s) => setState(() => _section = s),
          ),
          if (_data?.fromCache == true) ...[
            const SizedBox(height: 10),
            AdminSoftCard(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.cloud_off_outlined,
                    size: 18,
                    color: BatColors.accentHover,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l10n.offlineCachedBanner,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: BatColors.heading),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (items.isEmpty)
            EmptyState(
              title: l10n.noOpportunities,
              subtitle: l10n.noTrainingInSection,
              icon: Icons.hiking_outlined,
            )
          else
            for (final opp in items)
              AdminOpportunityCard(
                opportunity: opp,
                onTap: () => context.push('/admin/field-training/${opp.id}'),
              ),
        ],
      ),
    );
  }
}

class _SectionFilterBar extends StatelessWidget {
  const _SectionFilterBar({
    required this.selected,
    required this.counts,
    required this.onChanged,
  });

  final AdminOpportunitySection selected;
  final Map<AdminOpportunitySection, int> counts;
  final ValueChanged<AdminOpportunitySection> onChanged;

  static const _sections = [
    AdminOpportunitySection.published,
    AdminOpportunitySection.draft,
    AdminOpportunitySection.inProgress,
    AdminOpportunitySection.archived,
  ];

  static IconData _iconFor(AdminOpportunitySection s) {
    switch (s) {
      case AdminOpportunitySection.published:
        return Icons.public_outlined;
      case AdminOpportunitySection.draft:
        return Icons.edit_note_outlined;
      case AdminOpportunitySection.inProgress:
        return Icons.play_circle_outline;
      case AdminOpportunitySection.archived:
        return Icons.inventory_2_outlined;
      case AdminOpportunitySection.other:
        return Icons.more_horiz;
    }
  }

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
        children: _sections.map((s) {
          final isSelected = selected == s;
          final count = counts[s] ?? 0;
          return Expanded(
            child: Material(
              color: isSelected ? BatColors.primarySoft : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                onTap: () => onChanged(s),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _iconFor(s),
                        size: 18,
                        color: isSelected
                            ? BatColors.primary
                            : const Color(0xFF8B93A0),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        AdminLabels.sectionAr(s),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 10,
                          color: isSelected
                              ? BatColors.primary
                              : const Color(0xFF8B93A0),
                        ),
                      ),
                      Text(
                        '$count',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isSelected
                              ? BatColors.accentHover
                              : BatColors.muted,
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
