import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_hours_section.dart';

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

    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: _loading
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
                padding: const EdgeInsets.all(16),
                children: [
                  _section(l10n.opportunityInfo, [
                    _kv(
                      l10n.accountStatus,
                      InstructorLabels.statusAr(
                        _readProgressField('training_status') ??
                            _readProgressField('status'),
                      ),
                    ),
                    _kv(l10n.attendance, _formatAttendance(_data)),
                  ]),
                  const SizedBox(height: 8),
                  InstructorHoursSection(
                    applicationId: widget.applicationId,
                    hours: _hoursMap(),
                    onUpdated: _load,
                  ),
                  const SizedBox(height: 16),
                  _section(l10n.preAssessment, [
                    _kv(l10n.score, _assessmentScore('pre') ?? '—'),
                  ]),
                  _section(l10n.postAssessment, [
                    _kv(l10n.score, _assessmentScore('post') ?? '—'),
                  ]),
                  if (_tasks().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      l10n.viewSubmissions,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    for (final task in _tasks())
                      ListTile(
                        title: Text(task['title']?.toString() ?? '—'),
                        subtitle: Text(
                          InstructorLabels.reviewStatusAr(
                            SubmissionReviewStatus.fromApi(
                              task['submission_status']?.toString() ??
                                  task['review_status']?.toString(),
                            ),
                          ),
                        ),
                      ),
                  ],
                ],
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

  Widget _section(String title, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
