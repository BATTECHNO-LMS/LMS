import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../../core/widgets/training_page_background.dart';
import '../../auth/providers/auth_controller.dart';
import '../../field_training/domain/field_training_models.dart';
import '../data/student_training_repository.dart';
import '../domain/student_training_models.dart';

/// Local preview-only opportunity — not backed by the API.
const _qaPreviewOpportunityId = '__qa_preview_training__';

const _qaPreviewOpportunity = <String, dynamic>{
  'id': _qaPreviewOpportunityId,
  'title': 'هذا التدريب الميداني للفحص فقط لكي اذا رأه احد من المستخدمين',
  'university': {'name': 'BATUNI'},
  'specialty': {'name_ar': 'فحص واجهة · غير حقيقي'},
  'my_application_status': null,
};

class StudentTrainingListScreen extends ConsumerStatefulWidget {
  const StudentTrainingListScreen({super.key});

  @override
  ConsumerState<StudentTrainingListScreen> createState() =>
      _StudentTrainingListScreenState();
}

class _StudentTrainingListScreenState
    extends ConsumerState<StudentTrainingListScreen> {
  StudentTrainingListData? _data;
  bool _loading = true;
  String? _error;
  String _search = '';
  StudentTrainingSection _section = StudentTrainingSection.available;
  bool _applying = false;

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
          .read(studentTrainingRepositoryProvider)
          .load(userId: user.id, search: _search);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _itemsForSection() {
    final items = List<Map<String, dynamic>>.from(
      _data?.forSection(_section) ?? const [],
    );
    if (_section == StudentTrainingSection.available) {
      final already = items.any(
        (o) => o['id']?.toString() == _qaPreviewOpportunityId,
      );
      if (!already) items.insert(0, _qaPreviewOpportunity);
    }
    return items;
  }

  int _countFor(StudentTrainingSection section) {
    if (section == StudentTrainingSection.available) {
      return (_data?.forSection(section).length ?? 0) + 1; // + QA preview
    }
    return _data?.forSection(section).length ?? 0;
  }

  void _showQaPreviewNotice() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('هذا التدريب للفحص فقط — غير مربوط بالخادم'),
      ),
    );
  }

  Future<void> _apply(Map<String, dynamic> opportunity) async {
    final l10n = AppLocalizations.of(context);
    final id = opportunity['id']?.toString();
    if (id == null || _applying) return;
    if (id == _qaPreviewOpportunityId) {
      _showQaPreviewNotice();
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.applyToTrainingTitle),
        content: Text(l10n.applyToTrainingBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.continueAction),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.applyNow),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _applying = true);
    try {
      await ref
          .read(studentTrainingRepositoryProvider)
          .apply(opportunityId: id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.applicationSubmitted)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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

    final items = _itemsForSection();

    return Stack(
      fit: StackFit.expand,
      children: [
        const TrainingPageBackground(),
        RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              if (_data?.fromCache == true && _data?.cachedAt != null) ...[
                InfoBanner(
                  message: l10n.lastUpdatedAt(
                    _formatCacheTime(_data!.cachedAt!),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_data?.profileIncomplete == true) ...[
                InfoBanner(message: l10n.profileIncompleteForTraining),
                const SizedBox(height: 12),
              ],
              _TrainingToolbar(
                title: l10n.training,
                section: _section,
                onSectionChanged: (s) => setState(() => _section = s),
                counts: {
                  for (final s in StudentTrainingSection.values)
                    s: _countFor(s),
                },
                searchHint: l10n.searchTraining,
                onSearchSubmitted: (value) {
                  _search = value.trim();
                  _load();
                },
                onSearchChanged: (value) => _search = value.trim(),
              ),
              const SizedBox(height: 20),
              if (items.isEmpty)
                EmptyState(
                  title: l10n.noTrainingInSection,
                  icon: Icons.hiking_outlined,
                )
              else
                ...items.asMap().entries.map((entry) {
                  final index = entry.key;
                  final item = entry.value;
                  final isQa =
                      item['id']?.toString() == _qaPreviewOpportunityId;
                  return _TrainingHeroCard(
                    opportunity: item,
                    l10n: l10n,
                    isQaPreview: isQa,
                    visualIndex: index,
                    onOpen: () {
                      final id = item['id']?.toString();
                      if (id == null) return;
                      if (id == _qaPreviewOpportunityId) {
                        _showQaPreviewNotice();
                        return;
                      }
                      context.push('/student/field-training/$id');
                    },
                    onApply: StudentTrainingLabels.canApply(item)
                        ? () => _apply(item)
                        : null,
                  );
                }),
            ],
          ),
        ),
      ],
    );
  }

  String _formatCacheTime(DateTime time) {
    return '${time.year}-${time.month.toString().padLeft(2, '0')}-${time.day.toString().padLeft(2, '0')} '
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}

/// Mosaic-aligned toolbar: title banner, search, section segments.
class _TrainingToolbar extends StatelessWidget {
  const _TrainingToolbar({
    required this.title,
    required this.section,
    required this.onSectionChanged,
    required this.counts,
    required this.searchHint,
    required this.onSearchSubmitted,
    required this.onSearchChanged,
  });

  final String title;
  final StudentTrainingSection section;
  final ValueChanged<StudentTrainingSection> onSectionChanged;
  final Map<StudentTrainingSection, int> counts;
  final String searchHint;
  final ValueChanged<String> onSearchSubmitted;
  final ValueChanged<String> onSearchChanged;

  static IconData _iconFor(StudentTrainingSection s) {
    switch (s) {
      case StudentTrainingSection.available:
        return Icons.hiking;
      case StudentTrainingSection.myApplications:
        return Icons.assignment_outlined;
      case StudentTrainingSection.current:
        return Icons.school_outlined;
      case StudentTrainingSection.completed:
        return Icons.verified_outlined;
    }
  }

  static String _shortLabel(StudentTrainingSection s) {
    switch (s) {
      case StudentTrainingSection.available:
        return 'فرص';
      case StudentTrainingSection.myApplications:
        return 'طلباتي';
      case StudentTrainingSection.current:
        return 'حالي';
      case StudentTrainingSection.completed:
        return 'مكتمل';
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = counts[section] ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: BatColors.cream,
          borderRadius: BorderRadius.circular(28),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.hiking,
                        color: BatColors.accentHover,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            StudentTrainingLabels.sectionTitleAr(section),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: BatColors.muted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: BatColors.accent,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        '$activeCount',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: BatColors.secondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  decoration: InputDecoration(
                    hintText: searchHint,
                    hintStyle: TextStyle(
                      color: BatColors.muted.withValues(alpha: 0.85),
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: BatColors.primary,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: const BorderSide(
                        color: BatColors.primary,
                        width: 1.4,
                      ),
                    ),
                  ),
                  onChanged: onSearchChanged,
                  onSubmitted: onSearchSubmitted,
                  textInputAction: TextInputAction.search,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: BatColors.primarySoft,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Row(
            children: StudentTrainingSection.values.map((s) {
              final selected = section == s;
              final count = counts[s] ?? 0;
              return Expanded(
                child: GestureDetector(
                  onTap: () => onSectionChanged(s),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? BatColors.primary : Colors.transparent,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: selected
                          ? [
                              BoxShadow(
                                color: BatColors.primary.withValues(
                                  alpha: 0.22,
                                ),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ]
                          : null,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _iconFor(s),
                          size: 18,
                          color: selected ? Colors.white : BatColors.primary,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _shortLabel(s),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: selected
                                    ? Colors.white
                                    : BatColors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        Text(
                          '$count',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: selected
                                    ? BatColors.accent
                                    : BatColors.muted,
                                fontWeight: FontWeight.w700,
                                fontSize: 10,
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

/// Large hero card matching the room-card reference, Bat palette.
class _TrainingHeroCard extends StatelessWidget {
  const _TrainingHeroCard({
    required this.opportunity,
    required this.l10n,
    required this.onOpen,
    required this.visualIndex,
    this.onApply,
    this.isQaPreview = false,
  });

  final Map<String, dynamic> opportunity;
  final AppLocalizations l10n;
  final VoidCallback onOpen;
  final VoidCallback? onApply;
  final bool isQaPreview;
  final int visualIndex;

  @override
  Widget build(BuildContext context) {
    final uni = JsonHelpers.map(opportunity['university']);
    final specialty = JsonHelpers.map(opportunity['specialty']);
    final appStatus = opportunity['my_application_status']?.toString();
    final title = opportunity['title']?.toString() ?? l10n.trainingDetails;
    final uniName = uni?['name']?.toString() ?? '—';
    final specialtyName =
        specialty?['name_ar']?.toString() ??
        specialty?['name_en']?.toString() ??
        '';
    final statusLabel = isQaPreview
        ? 'فحص فقط'
        : StudentTrainingLabels.applicationStatusAr(appStatus);
    final canApply = onApply != null;

    final palette = _paletteFor(visualIndex, isQaPreview);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(32),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: SizedBox(
            height: 260,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Atmospheric background
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: palette.gradient,
                    ),
                  ),
                ),
                Positioned(
                  top: -20,
                  left: -10,
                  child: Icon(
                    isQaPreview ? Icons.science_outlined : Icons.hiking,
                    size: 160,
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                Positioned(
                  bottom: 80,
                  right: -30,
                  child: Icon(
                    Icons.account_balance_outlined,
                    size: 120,
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                ),

                // Gold category badge
                PositionedDirectional(
                  top: 16,
                  start: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: BatColors.accent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      statusLabel,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: BatColors.secondary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),

                // Circular action (bookmark / open)
                PositionedDirectional(
                  top: 14,
                  end: 14,
                  child: Material(
                    color: Colors.white.withValues(alpha: 0.22),
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: onOpen,
                      child: const SizedBox(
                        width: 40,
                        height: 40,
                        child: Icon(
                          Icons.arrow_outward,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ),
                ),

                // Frosted info overlay
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
                    decoration: BoxDecoration(
                      color: palette.overlay,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                height: 1.25,
                              ),
                        ),
                        if (specialtyName.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            specialtyName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Flexible(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  uniName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelMedium
                                      ?.copyWith(
                                        color: BatColors.heading,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              canApply
                                  ? l10n.applyNow
                                  : l10n.viewTrainingDetails,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.9),
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            const SizedBox(width: 8),
                            Material(
                              color: BatColors.secondary,
                              shape: const CircleBorder(),
                              child: InkWell(
                                customBorder: const CircleBorder(),
                                onTap: canApply ? onApply : onOpen,
                                child: SizedBox(
                                  width: 40,
                                  height: 40,
                                  child: Icon(
                                    canApply ? Icons.add : Icons.chevron_left,
                                    color: Colors.white,
                                    size: 22,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _CardPalette _paletteFor(int index, bool qa) {
    if (qa) {
      return const _CardPalette(
        gradient: [Color(0xFF3A5F8A), Color(0xFF132D4A), Color(0xFF0C1F35)],
        overlay: Color(0xCC3A5F8A),
      );
    }
    switch (index % 3) {
      case 0:
        return const _CardPalette(
          gradient: [Color(0xFF1A3A5C), Color(0xFF132D4A), Color(0xFF0C1F35)],
          overlay: Color(0xCC243241),
        );
      case 1:
        return const _CardPalette(
          gradient: [Color(0xFF2A4A6A), Color(0xFF1A3550), Color(0xFF132D4A)],
          overlay: Color(0xCC3A5F8A),
        );
      default:
        return const _CardPalette(
          gradient: [Color(0xFF4A6A4A), Color(0xFF2D4A3A), Color(0xFF132D4A)],
          overlay: Color(0xCC2D4A3A),
        );
    }
  }
}

class _CardPalette {
  const _CardPalette({required this.gradient, required this.overlay});

  final List<Color> gradient;
  final Color overlay;
}
