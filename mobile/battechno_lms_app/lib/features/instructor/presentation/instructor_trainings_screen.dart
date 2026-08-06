import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorTrainingsScreen extends ConsumerStatefulWidget {
  const InstructorTrainingsScreen({super.key});

  @override
  ConsumerState<InstructorTrainingsScreen> createState() =>
      _InstructorTrainingsScreenState();
}

class _InstructorTrainingsScreenState
    extends ConsumerState<InstructorTrainingsScreen> {
  InstructorTrainingListData? _data;
  bool _loading = true;
  String? _error;
  String _search = '';
  InstructorTrainingSection _section = InstructorTrainingSection.active;

  static const _sections = [
    InstructorTrainingSection.active,
    InstructorTrainingSection.upcoming,
    InstructorTrainingSection.completed,
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
          .read(instructorRepositoryProvider)
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

  Map<InstructorTrainingSection, int> get _counts {
    final data = _data;
    if (data == null) {
      return {for (final s in _sections) s: 0};
    }
    return {for (final s in _sections) s: data.forSection(s).length};
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _data == null) {
      return const ColoredBox(
        color: kInstructorPageBg,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 5),
        ),
      );
    }
    if (_error == 'network' && _data == null) {
      return ColoredBox(
        color: kInstructorPageBg,
        child: RetryView(
          title: l10n.networkErrorTitle,
          message: l10n.networkErrorBody,
          onRetry: _load,
        ),
      );
    }

    final items = _data?.forSection(_section) ?? const [];

    return ColoredBox(
      color: kInstructorPageBg,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
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
              InstSoftCard(
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
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: BatColors.heading,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 14),
            if (items.isEmpty)
              EmptyState(
                title: l10n.noAssignedTrainings,
                subtitle: l10n.noTrainingInSection,
                icon: Icons.hiking_outlined,
              )
            else
              for (final opp in items)
                AssignedTrainingCard(
                  opportunity: opp,
                  onTap: () =>
                      context.push('/instructor/field-training/${opp.id}'),
                ),
          ],
        ),
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

  final InstructorTrainingSection selected;
  final Map<InstructorTrainingSection, int> counts;
  final ValueChanged<InstructorTrainingSection> onChanged;

  static IconData _iconFor(InstructorTrainingSection s) {
    switch (s) {
      case InstructorTrainingSection.active:
        return Icons.play_circle_outline;
      case InstructorTrainingSection.upcoming:
        return Icons.schedule_outlined;
      case InstructorTrainingSection.completed:
        return Icons.verified_outlined;
      case InstructorTrainingSection.other:
        return Icons.more_horiz;
    }
  }

  @override
  Widget build(BuildContext context) {
    const sections = [
      InstructorTrainingSection.active,
      InstructorTrainingSection.upcoming,
      InstructorTrainingSection.completed,
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6E8EC)),
      ),
      child: Row(
        children: sections.map((s) {
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
                  padding: const EdgeInsets.symmetric(vertical: 10),
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
                        InstructorLabels.sectionAr(s),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w800,
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
