import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/field_training_models.dart';
import '../domain/session_models.dart';
import 'widgets/field_training_widgets.dart';
import 'widgets/session_widgets.dart';

class FieldTrainingDetailScreen extends ConsumerStatefulWidget {
  const FieldTrainingDetailScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<FieldTrainingDetailScreen> createState() =>
      _FieldTrainingDetailScreenState();
}

class _FieldTrainingDetailScreenState
    extends ConsumerState<FieldTrainingDetailScreen> {
  FieldTrainingDetailBundle? _bundle;
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
          .read(fieldTrainingRepositoryProvider)
          .loadDetail(widget.opportunityId);
      setState(() => _bundle = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openTask(Map<String, dynamic> task) {
    final taskId = task['id']?.toString();
    if (taskId == null) return;
    context.push(
      '/student/tasks/$taskId?opportunityId=${Uri.encodeComponent(widget.opportunityId)}',
      extra: task,
    );
  }

  void _openAssessments(Map<String, dynamic> opp) {
    final title = Uri.encodeComponent(opp['title']?.toString() ?? '');
    final requiresPre = opp['requires_pre_assessment'] != false;
    final requiresPost = opp['requires_post_assessment'] != false;
    context.push(
      '/student/field-training/${widget.opportunityId}/assessments?title=$title&requiresPre=$requiresPre&requiresPost=$requiresPost',
    );
  }

  void _openAssessment(String type) {
    context.push(
      '/student/field-training/${widget.opportunityId}/assessments/$type',
    );
  }

  void _openSessions() {
    context.push('/student/field-training/${widget.opportunityId}/sessions');
  }

  void _openSession(TrainingSessionItem session) {
    context.push(
      '/student/field-training/${widget.opportunityId}/sessions/${session.id}',
      extra: session.raw,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: kFtPageBg,
      appBar: AppBar(
        title: Text(l10n.trainingDetails),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (_error != null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error!,
        onRetry: _load,
      );
    }

    final bundle = _bundle!;
    final opp = bundle.opportunity;
    final uni = JsonHelpers.map(opp['university']);
    final specialty = JsonHelpers.map(opp['specialty']);
    final status =
        opp['my_training_status']?.toString() ??
        opp['my_application_status']?.toString() ??
        opp['status']?.toString();
    final title = opp['title']?.toString() ?? l10n.trainingDetails;
    final statusLabel = FieldTrainingLabels.trainingStatusAr(status);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          FtSoftCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.hiking,
                    color: BatColors.primary,
                    size: 26,
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
                              height: 1.25,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: BatColors.accentSoft,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          statusLabel,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: BatColors.accentHover,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          FtSoftCard(
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: BatColors.accentSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.account_balance_outlined,
                    color: BatColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        uni?['name']?.toString() ?? '—',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                      if ((specialty?['name_ar'] ?? specialty?['name_en']) !=
                          null)
                        Text(
                          specialty?['name_ar']?.toString() ??
                              specialty?['name_en']?.toString() ??
                              '',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: BatColors.muted),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (opp['start_date'] != null || opp['end_date'] != null) ...[
            const SizedBox(height: 12),
            FtSoftCard(
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: BatColors.primarySoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.date_range_outlined,
                      color: BatColors.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.trainingDates,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${opp['start_date'] ?? '—'} → ${opp['end_date'] ?? '—'}',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: BatColors.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          TrainingProgressSection(
            progress: bundle.progress,
            opportunity: opp,
            l10n: l10n,
          ),
          const SizedBox(height: 16),
          FieldTrainingJourneySection(
            l10n: l10n,
            opportunityId: widget.opportunityId,
            opportunity: opp,
            progress: bundle.progress,
            assessments: bundle.assessments,
            sessions: bundle.sessions,
            onOpenAssessments: () => _openAssessments(opp),
            onOpenAssessment: _openAssessment,
            onOpenSessions: _openSessions,
            onOpenSession: _openSession,
          ),
          if (opp['description'] != null &&
              opp['description'].toString().isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              l10n.description,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 8),
            FtSoftCard(
              child: Text(
                opp['description'].toString(),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: BatColors.muted,
                  height: 1.45,
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            l10n.tasks,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
          const SizedBox(height: 8),
          TaskListSection(tasks: bundle.tasks, onTaskTap: _openTask),
        ],
      ),
    );
  }
}
