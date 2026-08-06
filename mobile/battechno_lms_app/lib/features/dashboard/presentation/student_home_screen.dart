import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../../core/widgets/home_mosaic.dart';
import '../../courses/data/student_courses_repository.dart';
import '../../courses/domain/student_course_models.dart';
import '../../field_training/domain/assessment_models.dart';
import '../../field_training/domain/session_models.dart';
import '../../auth/domain/auth_user.dart';
import '../../notifications/data/notifications_repository.dart';
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
    final hoursSubtitle = requiredHours != null
        ? '${completedHours ?? 0} / $requiredHours'
        : (completedHours?.toString() ?? statusLabel);
    final unread =
        ref
            .watch(notificationsControllerProvider)
            .valueOrNull
            ?.notifications
            .where((n) => !n.isRead)
            .length ??
        0;

    return HomeMosaicScaffold(
      onRefresh: _load,
      header: HomeMosaicHeader(
        greeting: _greeting(l10n),
        fullName: widget.user.fullName,
        subtitle: [
          widget.user.universityName,
          widget.user.specialtyLabel(isArabic: isArabic),
        ].where((s) => s != null && s.isNotEmpty).join(' · '),
        profileActionLabel: l10n.profile,
        onProfileTap: () =>
            ref.read(shellTabIndexRequestProvider.notifier).state = 3,
        notificationsTooltip: l10n.notifications,
        unreadCount: unread,
        onNotificationsTap: () => context.push('/notifications'),
      ),
      banner: Column(
        children: [
          TrainingProgressCard(
            title: l10n.fieldTrainingStatus,
            statusLabel: statusLabel,
            progress: progressValue,
            completedHours: completedHours,
            requiredHours: requiredHours,
            nextAction: nextAction,
          ),
          if (priority.onTap != null) ...[
            const SizedBox(height: 12),
            Material(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(28),
              child: InkWell(
                onTap: priority.onTap,
                borderRadius: BorderRadius.circular(28),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          priority.icon,
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
                              priority.title,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: BatColors.heading,
                                  ),
                            ),
                            if (priority.subtitle != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                priority.subtitle!,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: BatColors.muted),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_left, color: BatColors.primary),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      tiles: [
        // Col A: tall (Balance) · Col B: short (Tickets)
        HomeMosaicTileData(
          label: l10n.training,
          icon: Icons.hiking,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: hoursSubtitle,
          onTap: () => _openTrainingRelated(
            data,
            l10n,
            (id) => '/student/field-training/$id',
          ),
        ),
        HomeMosaicTileData(
          label: l10n.assessmentsTitle,
          icon: Icons.quiz_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => _openTrainingRelated(
            data,
            l10n,
            (id) => '/student/field-training/$id/assessments',
          ),
        ),
        // Col A: short (Addresses) · Col B: tall (Saved Cards)
        HomeMosaicTileData(
          label: l10n.trainingSessions,
          icon: Icons.event_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => _openTrainingRelated(
            data,
            l10n,
            (id) => '/student/field-training/$id/sessions',
          ),
        ),
        HomeMosaicTileData(
          label: l10n.certificatesTitle,
          icon: Icons.workspace_premium_outlined,
          tone: HomeMosaicTone.accent,
          size: HomeMosaicSize.tall,
          onTap: () => context.push('/student/certificates'),
        ),
        // Col A: medium (Contact) · Col B: medium (Payout)
        HomeMosaicTileData(
          label: l10n.courses,
          icon: Icons.menu_book_outlined,
          tone: HomeMosaicTone.soft,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 2,
        ),
        HomeMosaicTileData(
          label: l10n.eligibleOpportunities,
          icon: Icons.travel_explore_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 1,
        ),
      ],
      footer: [
        _StudentCoursesHomeSummary(userId: widget.user.id),
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
      ],
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

  void _openTrainingRelated(
    StudentDashboardData? data,
    AppLocalizations l10n,
    String Function(String opportunityId) pathFor,
  ) {
    final id = _activeOpportunityId(data);
    if (id != null && id.isNotEmpty) {
      context.push(pathFor(id));
      return;
    }
    ref.read(shellTabIndexRequestProvider.notifier).state = 1;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.noActiveTraining)));
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

/// Compact academic summary on Student Home — one active course + continue.
class _StudentCoursesHomeSummary extends ConsumerStatefulWidget {
  const _StudentCoursesHomeSummary({required this.userId});

  final String userId;

  @override
  ConsumerState<_StudentCoursesHomeSummary> createState() =>
      _StudentCoursesHomeSummaryState();
}

class _StudentCoursesHomeSummaryState
    extends ConsumerState<_StudentCoursesHomeSummary> {
  StudentCourse? _course;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final data = await ref
          .read(studentCoursesRepositoryProvider)
          .loadList(userId: widget.userId);
      StudentCourse? pick;
      for (final c in data.courses) {
        if (c.enrollmentStatus == StudentCourseEnrollmentStatus.active) {
          pick = c;
          break;
        }
      }
      pick ??= data.courses.isNotEmpty ? data.courses.first : null;
      if (mounted) setState(() => _course = pick);
    } catch (_) {
      // Home remains usable without courses summary.
    }
  }

  @override
  Widget build(BuildContext context) {
    final course = _course;
    if (course == null) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    return Material(
      color: BatColors.primarySoft,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push('/student/courses/${course.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.menu_book_outlined,
                  color: BatColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.continueLearning,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: BatColors.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      course.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                    Text(
                      l10n.courseProgressPercent(course.progressPercent),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: BatColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left, color: BatColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}
