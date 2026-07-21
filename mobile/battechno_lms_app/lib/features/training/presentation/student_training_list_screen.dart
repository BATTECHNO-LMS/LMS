import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../../field_training/domain/field_training_models.dart';
import '../data/student_training_repository.dart';
import '../domain/student_training_models.dart';

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

  Future<void> _apply(Map<String, dynamic> opportunity) async {
    final l10n = AppLocalizations.of(context);
    final id = opportunity['id']?.toString();
    if (id == null || _applying) return;

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

    final data = _data;
    final items = data?.forSection(_section) ?? const [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (data?.fromCache == true && data?.cachedAt != null)
            InfoBanner(
              message: l10n.lastUpdatedAt(_formatCacheTime(data!.cachedAt!)),
            ),
          if (data?.profileIncomplete == true)
            InfoBanner(message: l10n.profileIncompleteForTraining),
          TextField(
            decoration: InputDecoration(
              labelText: l10n.searchTraining,
              prefixIcon: const Icon(Icons.search),
            ),
            onSubmitted: (value) {
              _search = value.trim();
              _load();
            },
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: StudentTrainingSection.values.map((section) {
                final selected = _section == section;
                return Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: FilterChip(
                    label: Text(StudentTrainingLabels.sectionTitleAr(section)),
                    selected: selected,
                    onSelected: (_) => setState(() => _section = section),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            EmptyState(
              title: l10n.noTrainingInSection,
              icon: Icons.hiking_outlined,
            )
          else
            ...items.map(
              (item) => _TrainingCard(
                opportunity: item,
                l10n: l10n,
                onOpen: () {
                  final id = item['id']?.toString();
                  if (id != null) context.push('/student/field-training/$id');
                },
                onApply: StudentTrainingLabels.canApply(item)
                    ? () => _apply(item)
                    : null,
              ),
            ),
        ],
      ),
    );
  }

  String _formatCacheTime(DateTime time) {
    return '${time.year}-${time.month.toString().padLeft(2, '0')}-${time.day.toString().padLeft(2, '0')} '
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}

class _TrainingCard extends StatelessWidget {
  const _TrainingCard({
    required this.opportunity,
    required this.l10n,
    required this.onOpen,
    this.onApply,
  });

  final Map<String, dynamic> opportunity;
  final AppLocalizations l10n;
  final VoidCallback onOpen;
  final VoidCallback? onApply;

  @override
  Widget build(BuildContext context) {
    final uni = JsonHelpers.map(opportunity['university']);
    final specialty = JsonHelpers.map(opportunity['specialty']);
    final appStatus = opportunity['my_application_status']?.toString();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(BatRadii.lg),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                opportunity['title']?.toString() ?? l10n.trainingDetails,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(uni?['name']?.toString() ?? '—'),
              Text(
                specialty?['name_ar']?.toString() ??
                    specialty?['name_en']?.toString() ??
                    '',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
              ),
              const SizedBox(height: 8),
              StatusChip(
                label: StudentTrainingLabels.applicationStatusAr(appStatus),
                color: BatColors.info,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onOpen,
                      child: Text(l10n.viewTrainingDetails),
                    ),
                  ),
                  if (onApply != null) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: PrimaryButton(
                        label: l10n.applyNow,
                        onPressed: onApply,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
