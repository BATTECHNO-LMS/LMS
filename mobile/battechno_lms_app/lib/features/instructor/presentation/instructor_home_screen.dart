import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorHomeScreen extends ConsumerStatefulWidget {
  const InstructorHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<InstructorHomeScreen> createState() =>
      _InstructorHomeScreenState();
}

class _InstructorHomeScreenState extends ConsumerState<InstructorHomeScreen> {
  InstructorDashboardData? _data;
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
      final data = await ref
          .read(instructorRepositoryProvider)
          .loadDashboard(userId: widget.user.id);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPriority(InstructorPriorityAction action) {
    switch (action.type) {
      case InstructorPriorityType.reviewSubmissions:
        context.push(
          '/instructor/field-training/${action.opportunityId}/submissions',
        );
      case InstructorPriorityType.upcomingSession:
      case InstructorPriorityType.recordAttendance:
        context.push(
          '/instructor/field-training/${action.opportunityId}/sessions',
        );
      case InstructorPriorityType.followUpStudents:
        context.push(
          '/instructor/field-training/${action.opportunityId}/participants',
        );
      case InstructorPriorityType.openTraining:
        context.push('/instructor/field-training/${action.opportunityId}');
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
    final priority = data?.priorityAction;
    final firstOpp = data?.list.opportunities.isNotEmpty == true
        ? data!.list.opportunities.first
        : null;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.instructorGreeting(widget.user.fullName),
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (data?.fromCache == true) ...[
            const SizedBox(height: 8),
            InfoBanner(
              message:
                  '${l10n.offlineCachedBanner}'
                  '${data?.cachedAt != null ? ' · ${l10n.lastUpdatedAt(data!.cachedAt!.toLocal().toString().split('.').first)}' : ''}',
            ),
          ],
          const SizedBox(height: 16),
          if (priority != null) ...[
            InstructorPriorityCard(
              action: priority,
              onTap: () => _openPriority(priority),
            ),
            const SizedBox(height: 16),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _summaryChip(
                l10n.activeTrainingsCount(data?.activeCount ?? 0),
                Icons.hiking_outlined,
              ),
              _summaryChip(
                l10n.activeStudentsCount(data?.list.totalParticipants ?? 0),
                Icons.groups_outlined,
              ),
              if ((data?.list.totalPendingSubmissions ?? 0) > 0)
                _summaryChip(
                  l10n.pendingSubmissionsCount(
                    data!.list.totalPendingSubmissions,
                  ),
                  Icons.assignment_late_outlined,
                ),
              if ((data?.list.totalAtRisk ?? 0) > 0)
                _summaryChip(
                  l10n.atRiskStudentsCount(data!.list.totalAtRisk),
                  Icons.warning_amber_outlined,
                ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            l10n.quickActions,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/instructor/field-training'),
            icon: const Icon(Icons.work_outline),
            label: Text(l10n.myTrainings),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: firstOpp == null
                ? null
                : () => context.push(
                    '/instructor/field-training/${firstOpp.id}/participants',
                  ),
            icon: const Icon(Icons.groups_outlined),
            label: Text(l10n.students),
          ),
        ],
      ),
    );
  }

  Widget _summaryChip(String label, IconData icon) {
    return Chip(avatar: Icon(icon, size: 18), label: Text(label));
  }
}
