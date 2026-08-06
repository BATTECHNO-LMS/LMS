import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_hours_section.dart';
import 'widgets/instructor_widgets.dart';

class InstructorParticipantDetailScreen extends ConsumerStatefulWidget {
  const InstructorParticipantDetailScreen({
    super.key,
    required this.opportunityId,
    required this.applicationId,
  });

  final String opportunityId;
  final String applicationId;

  @override
  ConsumerState<InstructorParticipantDetailScreen> createState() =>
      _InstructorParticipantDetailScreenState();
}

class _InstructorParticipantDetailScreenState
    extends ConsumerState<InstructorParticipantDetailScreen> {
  Map<String, dynamic>? _data;
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
          .getProgress(widget.applicationId);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() {
        if (e.statusCode == 403) {
          _error = 'forbidden';
        } else if (e.statusCode == 404) {
          _error = 'not_found';
        } else {
          _error = e.isNetwork ? 'network' : e.message;
        }
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
    final name =
        _data?['student_name']?.toString() ??
        (_data?['student'] is Map
            ? (_data!['student'] as Map)['full_name']?.toString()
            : null) ??
        l10n.students;
    final status = InstructorLabels.statusAr(
      _readProgressField('training_status') ?? _readProgressField('status'),
    );
    final attendance = _formatAttendance(_data);
    final initial = name.isNotEmpty ? name.characters.first : '?';

    return Scaffold(
      backgroundColor: kInstructorPageBg,
      appBar: AppBar(
        title: Text(name),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: LoadingSkeleton(lines: 6),
              )
            : _error != null
            ? RetryView(
                title: l10n.networkErrorTitle,
                message: _error == 'forbidden'
                    ? l10n.forbiddenAccess
                    : _error == 'not_found'
                    ? l10n.resourceNotFound
                    : l10n.networkErrorBody,
                onRetry: _load,
              )
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  children: [
                    InstSoftCard(
                      child: Row(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: BatColors.primarySoft,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                initial,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 22,
                                  color: BatColors.primary,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
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
                                    color: BatColors.primarySoft,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    status,
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall
                                        ?.copyWith(
                                          color: BatColors.primary,
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
                    InstSoftCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.opportunityInfo,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 14),
                          _MetaRow(
                            icon: Icons.info_outline,
                            label: l10n.accountStatus,
                            value: status,
                          ),
                          const SizedBox(height: 12),
                          _MetaRow(
                            icon: Icons.how_to_reg_outlined,
                            label: l10n.attendance,
                            value: attendance,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    InstructorHoursSection(
                      applicationId: widget.applicationId,
                      hours: _hoursMap(),
                      onUpdated: _load,
                    ),
                    const SizedBox(height: 12),
                    InstSoftCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.assessmentsTitle,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 14),
                          _MetaRow(
                            icon: Icons.quiz_outlined,
                            label: l10n.preAssessment,
                            value: _assessmentScore('pre') ?? '—',
                          ),
                          const SizedBox(height: 12),
                          _MetaRow(
                            icon: Icons.assignment_turned_in_outlined,
                            label: l10n.postAssessment,
                            value: _assessmentScore('post') ?? '—',
                          ),
                        ],
                      ),
                    ),
                    if (_tasks().isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(
                        l10n.viewSubmissions,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                      const SizedBox(height: 10),
                      for (final task in _tasks())
                        InstSoftCard(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: BatColors.primarySoft,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.task_outlined,
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
                                      task['title']?.toString() ?? '—',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            color: BatColors.heading,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      InstructorLabels.reviewStatusAr(
                                        SubmissionReviewStatus.fromApi(
                                          task['submission_status']
                                                  ?.toString() ??
                                              task['review_status']?.toString(),
                                        ),
                                      ),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: BatColors.muted),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }

  String? _readProgressField(String key) {
    final progress = _data?['progress'];
    if (progress is Map) {
      final app = progress['application'];
      if (app is Map && app[key] != null) return app[key].toString();
      if (progress[key] != null) return progress[key].toString();
    }
    return _data?[key]?.toString();
  }

  String _formatAttendance(Map<String, dynamic>? data) {
    final progress = data?['progress'];
    dynamic pct;
    if (progress is Map) {
      final metrics = progress['metrics'];
      if (metrics is Map) pct = metrics['attendance_percentage'];
      pct ??= progress['attendance_percentage'];
    }
    pct ??= data?['attendance'] is Map
        ? (data!['attendance'] as Map)['percentage']
        : null;
    pct ??= data?['attendance_percentage'];
    if (pct == null) return '—';
    if (pct is num) return '${pct.toStringAsFixed(0)}%';
    return '$pct%';
  }

  Map<String, dynamic> _hoursMap() {
    final top = _data?['hours'];
    if (top is Map<String, dynamic>) return top;
    final progress = _data?['progress'];
    if (progress is Map && progress['metrics'] is Map) {
      return Map<String, dynamic>.from(progress['metrics'] as Map);
    }
    return {};
  }

  String? _assessmentScore(String type) {
    final assessments = _data?['assessments'];
    if (assessments is Map && assessments[type] is Map) {
      final a = assessments[type] as Map;
      final score = a['score'] ?? a['attempt_score'];
      if (score != null) return score.toString();
    }
    final key = type == 'pre'
        ? 'pre_assessment_score'
        : 'post_assessment_score';
    return _readProgressField(key) ?? _data?[key]?.toString();
  }

  List<Map<String, dynamic>> _tasks() {
    final tasks = _data?['tasks'];
    if (tasks is List) {
      return tasks.whereType<Map<String, dynamic>>().toList();
    }
    return const [];
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BatColors.primaryLight),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
        ),
      ],
    );
  }
}
