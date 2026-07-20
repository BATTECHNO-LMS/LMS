import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';

/// Read-only academic student report — hours, attendance, tasks, and
/// assessments. `qa_officer` / `university_reviewer` never write hours or
/// attendance, so there is intentionally no `AdminHoursSection` here.
class ReviewerStudentDetailScreen extends ConsumerStatefulWidget {
  const ReviewerStudentDetailScreen({super.key, required this.applicationId});

  final String applicationId;

  @override
  ConsumerState<ReviewerStudentDetailScreen> createState() =>
      _ReviewerStudentDetailScreenState();
}

class _ReviewerStudentDetailScreenState
    extends ConsumerState<ReviewerStudentDetailScreen> {
  Map<String, dynamic>? _report;
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
          .read(reviewerRepositoryProvider)
          .academicStudentReport(widget.applicationId);
      if (data == null) {
        setState(() => _error = 'forbidden');
        return;
      }
      setState(() => _report = data);
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 404
            ? 'not_found'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _s(dynamic v) => v?.toString();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final report = _report;
    final student = report?['student'];
    final name =
        (student is Map ? student['full_name']?.toString() : null) ??
        l10n.students;

    return Scaffold(
      appBar: AppBar(title: Text(name)),
      body: _loading && report == null
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 6),
            )
          : _error != null && report == null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : _error == 'not_found'
                  ? l10n.resourceNotFound
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : report == null
          ? EmptyState(title: l10n.resourceNotFound)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _section(l10n.opportunityInfo, [
                    _kv(
                      l10n.email,
                      (student is Map ? student['email']?.toString() : null) ??
                          '—',
                    ),
                    _kv(
                      l10n.accountStatus,
                      _s(_application(report)?['training_status']) ?? '—',
                    ),
                  ]),
                  const SizedBox(height: 8),
                  _hoursSection(l10n, report),
                  const SizedBox(height: 8),
                  _attendanceSection(l10n, report),
                  const SizedBox(height: 8),
                  _section(l10n.preAssessment, [
                    _kv(
                      l10n.score,
                      _s(_assessment(report, 'pre_assessment')?['score']) ??
                          '—',
                    ),
                  ]),
                  _section(l10n.postAssessment, [
                    _kv(
                      l10n.score,
                      _s(_assessment(report, 'post_assessment')?['score']) ??
                          '—',
                    ),
                  ]),
                  if (_tasks(report).isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      l10n.viewSubmissions,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    for (final task in _tasks(report))
                      Card(
                        child: ListTile(
                          title: Text(task['title']?.toString() ?? '—'),
                          subtitle: Text(task['due_date']?.toString() ?? ''),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }

  Map<String, dynamic>? _application(Map<String, dynamic> report) {
    final app = report['application'];
    return app is Map<String, dynamic> ? app : null;
  }

  Map<String, dynamic>? _assessment(Map<String, dynamic> report, String key) {
    final a = report[key];
    return a is Map<String, dynamic> ? a : null;
  }

  List<Map<String, dynamic>> _tasks(Map<String, dynamic> report) {
    final tasks = report['tasks'];
    if (tasks is List) return tasks.whereType<Map<String, dynamic>>().toList();
    return const [];
  }

  Widget _hoursSection(AppLocalizations l10n, Map<String, dynamic> report) {
    final hours = report['hours'];
    final map = hours is Map<String, dynamic> ? hours : const {};
    return _section(l10n.hoursProgressLabel, [
      _kv(
        l10n.completedHoursLabel,
        '${map['completed_training_hours'] ?? '—'}'
        '${map['required_training_hours'] != null ? ' / ${map['required_training_hours']}' : ''}',
      ),
    ]);
  }

  Widget _attendanceSection(
    AppLocalizations l10n,
    Map<String, dynamic> report,
  ) {
    final summary = report['attendance_summary'];
    final map = summary is Map<String, dynamic> ? summary : const {};
    final pct = map['attendance_percentage'];
    return _section(l10n.attendance, [
      _kv(l10n.attendance, pct != null ? '$pct%' : '—'),
    ]);
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
