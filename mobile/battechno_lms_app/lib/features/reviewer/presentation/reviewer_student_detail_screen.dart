import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import 'widgets/reviewer_widgets.dart';

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
    final trainingStatus = _s(_application(report)?['training_status']) ?? '—';
    final initial = name.isNotEmpty ? name.characters.first : '?';
    final attendancePct = _attendancePct(report);

    return Scaffold(
      backgroundColor: kReviewerPageBg,
      appBar: AppBar(
        title: Text(name),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: _loading && report == null
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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  children: [
                    ReviewerSoftCard(
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
                                    trainingStatus,
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
                    ReviewerSoftCard(
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
                          ReviewerMetaRow(
                            icon: Icons.email_outlined,
                            label: l10n.email,
                            value:
                                (student is Map
                                    ? student['email']?.toString()
                                    : null) ??
                                '—',
                          ),
                          const SizedBox(height: 12),
                          ReviewerMetaRow(
                            icon: Icons.info_outline,
                            label: l10n.accountStatus,
                            value: trainingStatus,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _hoursSection(l10n, report),
                    const SizedBox(height: 12),
                    ReviewerSoftCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.attendance,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 14),
                          ReviewerMetaRow(
                            icon: Icons.how_to_reg_outlined,
                            label: l10n.attendance,
                            value: attendancePct != null
                                ? '$attendancePct%'
                                : '—',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ReviewerSoftCard(
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
                          ReviewerMetaRow(
                            icon: Icons.quiz_outlined,
                            label: l10n.preAssessment,
                            value:
                                _s(
                                  _assessment(
                                    report,
                                    'pre_assessment',
                                  )?['score'],
                                ) ??
                                '—',
                          ),
                          const SizedBox(height: 12),
                          ReviewerMetaRow(
                            icon: Icons.assignment_turned_in_outlined,
                            label: l10n.postAssessment,
                            value:
                                _s(
                                  _assessment(
                                    report,
                                    'post_assessment',
                                  )?['score'],
                                ) ??
                                '—',
                          ),
                        ],
                      ),
                    ),
                    if (_tasks(report).isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(
                        l10n.viewSubmissions,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                      const SizedBox(height: 10),
                      for (final task in _tasks(report))
                        ReviewerSoftCard(
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
                                    if (task['due_date']
                                            ?.toString()
                                            .isNotEmpty ==
                                        true) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        task['due_date'].toString(),
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(color: BatColors.muted),
                                      ),
                                    ],
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

  Map<String, dynamic>? _application(Map<String, dynamic>? report) {
    if (report == null) return null;
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

  dynamic _attendancePct(Map<String, dynamic>? report) {
    if (report == null) return null;
    final summary = report['attendance_summary'];
    final map = summary is Map<String, dynamic> ? summary : const {};
    return map['attendance_percentage'];
  }

  Widget _hoursSection(AppLocalizations l10n, Map<String, dynamic> report) {
    final hours = report['hours'];
    final map = hours is Map<String, dynamic> ? hours : const {};
    final completed = map['completed_training_hours'];
    final required = map['required_training_hours'];
    final value = completed != null
        ? '$completed${required != null ? ' / $required' : ''}'
        : '—';

    return ReviewerSoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.hoursProgressLabel,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
          const SizedBox(height: 14),
          ReviewerMetaRow(
            icon: Icons.schedule_outlined,
            label: l10n.completedHoursLabel,
            value: value,
          ),
        ],
      ),
    );
  }
}
