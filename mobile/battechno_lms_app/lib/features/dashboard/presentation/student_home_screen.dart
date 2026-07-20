import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../field_training/domain/assessment_models.dart';
import '../../field_training/domain/session_models.dart';
import '../../auth/domain/auth_user.dart';
import '../data/student_dashboard_repository.dart';
import 'home_shell_screen.dart';

class StudentHomeScreen extends ConsumerStatefulWidget {
  const StudentHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends ConsumerState<StudentHomeScreen> {
  StudentDashboardData? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(studentDashboardRepositoryProvider).load();
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final data = _data;
    final activeApplication = data?.applications.isNotEmpty == true
        ? data!.applications.first
        : null;
    final progress = data?.progress;
    final metrics = _readMap(progress, ['metrics']) ?? progress;
    final completedHours = _readInt(metrics, [
      'completedHours',
      'completed_hours',
      'hoursCompleted',
      'completed_training_hours',
    ]);
    final requiredHours = _readInt(metrics, [
      'requiredHours',
      'required_hours',
      'required_training_hours',
    ]);
    final progressValue = _readDouble(metrics, [
      'progressPercent',
      'progress_percent',
      'percent',
    ], fallback: activeApplication != null ? 0.0 : 0);
    final statusLabel =
        activeApplication?['training_status']?.toString() ??
        activeApplication?['status']?.toString() ??
        l10n.noActiveTraining;
    final nextAction =
        _readMap(progress, ['next_action'])?['label_ar']?.toString() ??
        progress?['nextAction']?.toString() ??
        progress?['next_action']?.toString();
    final priority = _priorityAction(data, l10n);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '${_greeting(l10n)}، ${widget.user.fullName.split(' ').first}',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          UniversityIdentityCard(
            university: widget.user.universityName ?? '—',
            specialty: widget.user.specialtyLabel(isArabic: isArabic),
          ),
          const SizedBox(height: 16),
          TrainingProgressCard(
            title: l10n.fieldTrainingStatus,
            statusLabel: statusLabel,
            progress: progressValue,
            completedHours: completedHours,
            requiredHours: requiredHours,
            nextAction: nextAction,
          ),
          const SizedBox(height: 16),
          AcademicSectionHeader(title: l10n.quickActions),
          const SizedBox(height: 8),
          SizedBox(
            height: 108,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                QuickActionButton(
                  icon: Icons.hiking,
                  label: l10n.training,
                  onTap: () {
                    final id = data?.activeOpportunityId;
                    if (id != null) context.push('/student/field-training/$id');
                  },
                ),
                const SizedBox(width: 12),
                QuickActionButton(
                  icon: Icons.quiz_outlined,
                  label: l10n.assessmentsTitle,
                  onTap: () {
                    final id = data?.activeOpportunityId;
                    if (id != null) {
                      context.push('/student/field-training/$id/assessments');
                    }
                  },
                ),
                const SizedBox(width: 12),
                QuickActionButton(
                  icon: Icons.event_outlined,
                  label: l10n.trainingSessions,
                  onTap: () {
                    final id = data?.activeOpportunityId;
                    if (id != null) {
                      context.push('/student/field-training/$id/sessions');
                    }
                  },
                ),
                const SizedBox(width: 12),
                QuickActionButton(
                  icon: Icons.workspace_premium_outlined,
                  label: l10n.certificatesTitle,
                  onTap: () => context.push('/student/certificates'),
                ),
              ],
            ),
          ),
          if (_hasCompletionLetter(data)) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(l10n.certificateReady),
                subtitle: Text(l10n.viewCertificatesHint),
                trailing: const Icon(Icons.chevron_left),
                onTap: () => context.push('/student/certificates'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          AcademicSectionHeader(title: l10n.nextAction),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: Icon(priority.icon),
              title: Text(priority.title),
              subtitle: priority.subtitle != null
                  ? Text(priority.subtitle!)
                  : null,
              trailing: priority.onTap != null
                  ? const Icon(Icons.chevron_left)
                  : null,
              onTap: priority.onTap,
            ),
          ),
          const SizedBox(height: 16),
          AcademicSectionHeader(title: l10n.eligibleOpportunities),
          const SizedBox(height: 8),
          if (data?.opportunities.isEmpty ?? true)
            EmptyState(title: l10n.emptyDashboard)
          else
            ...data!.opportunities
                .take(4)
                .map(
                  (item) => Card(
                    child: ListTile(
                      onTap: () {
                        final id = _readOpportunityId(item);
                        if (id != null) {
                          context.push('/student/field-training/$id');
                        }
                      },
                      title: Text(
                        item['title']?.toString() ??
                            item['name']?.toString() ??
                            '—',
                      ),
                      subtitle: Text(item['university_name']?.toString() ?? ''),
                      trailing: const Icon(Icons.chevron_left),
                    ),
                  ),
                ),
          const SizedBox(height: 16),
          AcademicSectionHeader(title: l10n.recentActivity),
          const SizedBox(height: 8),
          if ((data?.tasks ?? []).isEmpty)
            EmptyState(
              title: l10n.emptyDashboard,
              icon: Icons.notifications_none_outlined,
            )
          else
            ...data!.tasks!
                .take(3)
                .map(
                  (task) => ListTile(
                    onTap: () {
                      final taskId = task['id']?.toString();
                      final opportunityId =
                          _readOpportunityId(task) ??
                          _activeOpportunityId(data);
                      if (taskId != null && opportunityId != null) {
                        context.push(
                          '/student/tasks/$taskId?opportunityId=${Uri.encodeComponent(opportunityId)}',
                          extra: task,
                        );
                      }
                    },
                    leading: const Icon(Icons.assignment_outlined),
                    title: Text(
                      task['title']?.toString() ??
                          task['name']?.toString() ??
                          '—',
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  String _greeting(AppLocalizations l10n) {
    final hour = DateTime.now().hour;
    return hour < 17 ? l10n.greetingMorning : l10n.greetingEvening;
  }

  int? _readInt(Map<String, dynamic>? map, List<String> keys) {
    if (map == null) return null;
    for (final key in keys) {
      final value = map[key];
      if (value is num) return value.toInt();
    }
    return null;
  }

  double _readDouble(
    Map<String, dynamic>? map,
    List<String> keys, {
    double fallback = 0,
  }) {
    if (map == null) return fallback;
    for (final key in keys) {
      final value = map[key];
      if (value is num) return value.toDouble() / (value > 1 ? 100 : 1);
    }
    return fallback;
  }

  bool _hasCompletionLetter(StudentDashboardData? data) {
    if (data == null) return false;
    for (final app in data.applications) {
      if (app['completion_letter_issued_at'] != null) return true;
    }
    return false;
  }

  String? _readOpportunityId(Map<String, dynamic> row) {
    return row['opportunity_id']?.toString() ??
        row['field_training_opportunity_id']?.toString() ??
        row['id']?.toString();
  }

  String? _activeOpportunityId(StudentDashboardData? data) {
    if (data?.activeOpportunityId != null) return data!.activeOpportunityId;
    if (data == null || data.applications.isEmpty) return null;
    return _readOpportunityId(data.applications.first);
  }

  Map<String, dynamic>? _readMap(Map<String, dynamic>? map, List<String> keys) {
    if (map == null) return null;
    for (final key in keys) {
      final value = map[key];
      if (value is Map<String, dynamic>) return value;
    }
    return null;
  }

  _HomePriorityAction _priorityAction(
    StudentDashboardData? data,
    AppLocalizations l10n,
  ) {
    final id = data?.activeOpportunityId;
    if (id == null) {
      return _HomePriorityAction(
        icon: Icons.flag_outlined,
        title: l10n.noActiveTraining,
      );
    }

    final pre = _assessmentByType(data!.assessments, 'pre');
    if (pre != null && pre.canTake && !pre.isSubmitted) {
      return _HomePriorityAction(
        icon: Icons.quiz_outlined,
        title: l10n.pendingPreAssessment,
        subtitle: pre.title,
        onTap: () =>
            context.push('/student/field-training/$id/assessments/pre'),
      );
    }

    final upcoming =
        data.sessions.where((s) => s.timing() != SessionTiming.past).toList()
          ..sort(
            (a, b) => (a.sessionDate ?? '').compareTo(b.sessionDate ?? ''),
          );
    if (upcoming.isNotEmpty) {
      final session = upcoming.first;
      return _HomePriorityAction(
        icon: Icons.event_outlined,
        title: l10n.upcomingSession,
        subtitle: session.title,
        onTap: () => context.push(
          '/student/field-training/$id/sessions/${session.id}',
          extra: session.raw,
        ),
      );
    }

    final post = _assessmentByType(data.assessments, 'post');
    if (post != null && post.canTake && !post.isSubmitted) {
      return _HomePriorityAction(
        icon: Icons.assignment_turned_in_outlined,
        title: l10n.pendingPostAssessment,
        subtitle: post.title,
        onTap: () =>
            context.push('/student/field-training/$id/assessments/post'),
      );
    }

    final nextAction = _readMap(data.progress, [
      'next_action',
    ])?['label_ar']?.toString();
    return _HomePriorityAction(
      icon: Icons.flag_outlined,
      title: nextAction ?? l10n.noActiveTraining,
      onTap: () => context.push('/student/field-training/$id'),
    );
  }

  StudentAssessmentSummary? _assessmentByType(
    List<StudentAssessmentSummary> items,
    String type,
  ) {
    for (final item in items) {
      if (item.type == type) return item;
    }
    return null;
  }
}

class _HomePriorityAction {
  const _HomePriorityAction({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
}
