import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/student_courses_repository.dart';
import '../domain/student_course_models.dart';
import 'course_design_widgets.dart';

/// Student LMS courses catalog tab (web: `/student/courses`).
class StudentCoursesListScreen extends ConsumerStatefulWidget {
  const StudentCoursesListScreen({super.key});

  @override
  ConsumerState<StudentCoursesListScreen> createState() =>
      _StudentCoursesListScreenState();
}

class _StudentCoursesListScreenState
    extends ConsumerState<StudentCoursesListScreen> {
  StudentCoursesListData? _data;
  bool _loading = true;
  String? _error;
  String _search = '';
  _CourseFilter _filter = _CourseFilter.all;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
          .read(studentCoursesRepositoryProvider)
          .loadList(userId: user.id, search: _search);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<StudentCourse> get _filtered {
    final all = _data?.courses ?? const [];
    switch (_filter) {
      case _CourseFilter.all:
        return all;
      case _CourseFilter.inProgress:
        return all
            .where(
              (c) => c.enrollmentStatus == StudentCourseEnrollmentStatus.active,
            )
            .toList();
      case _CourseFilter.notStarted:
        return all
            .where(
              (c) =>
                  c.enrollmentStatus == null ||
                  c.enrollmentStatus ==
                      StudentCourseEnrollmentStatus.notStarted,
            )
            .toList();
      case _CourseFilter.completed:
        return all.where((c) => c.isCompleted).toList();
    }
  }

  Map<_CourseFilter, int> get _filterCounts {
    final all = _data?.courses ?? const [];
    var inProgress = 0;
    var notStarted = 0;
    var completed = 0;
    for (final c in all) {
      if (c.isCompleted) {
        completed++;
      } else if (c.enrollmentStatus == StudentCourseEnrollmentStatus.active) {
        inProgress++;
      } else {
        notStarted++;
      }
    }
    return {
      _CourseFilter.all: all.length,
      _CourseFilter.inProgress: inProgress,
      _CourseFilter.notStarted: notStarted,
      _CourseFilter.completed: completed,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _data == null) {
      return const ColoredBox(
        color: kCoursePageBg,
        child: Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 5),
        ),
      );
    }
    if (_error == 'network' && _data == null) {
      return ColoredBox(
        color: kCoursePageBg,
        child: RetryView(
          title: l10n.networkErrorTitle,
          message: l10n.networkErrorBody,
          onRetry: _load,
        ),
      );
    }
    if (_error != null && _data == null) {
      return ColoredBox(
        color: kCoursePageBg,
        child: RetryView(
          title: l10n.networkErrorTitle,
          message: _error!,
          onRetry: _load,
        ),
      );
    }

    final items = _filtered;
    final counts = _filterCounts;

    return ColoredBox(
      color: kCoursePageBg,
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
          children: [
            if (_data?.fromCache == true) ...[
              InfoBanner(message: l10n.offlineCachedBanner),
              const SizedBox(height: 12),
            ],
            CoursePillSearchField(
              controller: _searchController,
              hintText: l10n.searchCourses,
              onChanged: (v) => _search = v.trim(),
              onSubmitted: (v) {
                _search = v.trim();
                _load();
              },
            ),
            const SizedBox(height: 14),
            _CourseFilterBar(
              selected: _filter,
              counts: counts,
              l10n: l10n,
              onChanged: (f) => setState(() => _filter = f),
            ),
            const SizedBox(height: 18),
            if (items.isEmpty)
              EmptyState(
                title: (_data?.courses.isEmpty ?? true)
                    ? l10n.coursesEmptyTitle
                    : l10n.coursesFilterEmpty,
                subtitle: (_data?.courses.isEmpty ?? true)
                    ? l10n.coursesEmptyBody
                    : null,
                icon: Icons.menu_book_outlined,
              )
            else
              ...items.map(
                (course) => _CourseCatalogCard(
                  course: course,
                  l10n: l10n,
                  onTap: () => context.push('/student/courses/${course.id}'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

enum _CourseFilter { all, inProgress, notStarted, completed }

/// Same segmented filter pattern as the student training list toolbar.
class _CourseFilterBar extends StatelessWidget {
  const _CourseFilterBar({
    required this.selected,
    required this.counts,
    required this.l10n,
    required this.onChanged,
  });

  final _CourseFilter selected;
  final Map<_CourseFilter, int> counts;
  final AppLocalizations l10n;
  final ValueChanged<_CourseFilter> onChanged;

  static IconData _iconFor(_CourseFilter f) {
    switch (f) {
      case _CourseFilter.all:
        return Icons.menu_book_outlined;
      case _CourseFilter.inProgress:
        return Icons.school_outlined;
      case _CourseFilter.notStarted:
        return Icons.schedule_outlined;
      case _CourseFilter.completed:
        return Icons.verified_outlined;
    }
  }

  String _labelFor(_CourseFilter f) {
    switch (f) {
      case _CourseFilter.all:
        return l10n.coursesFilterAll;
      case _CourseFilter.inProgress:
        return l10n.coursesFilterInProgress;
      case _CourseFilter.notStarted:
        return l10n.coursesFilterNotStarted;
      case _CourseFilter.completed:
        return l10n.coursesFilterCompleted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: BatColors.primarySoft,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: _CourseFilter.values.map((f) {
          final isSelected = selected == f;
          final count = counts[f] ?? 0;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(f),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? BatColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: BatColors.primary.withValues(alpha: 0.22),
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
                      _iconFor(f),
                      size: 18,
                      color: isSelected ? Colors.white : BatColors.primary,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _labelFor(f),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: isSelected ? Colors.white : BatColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '$count',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: isSelected ? BatColors.accent : BatColors.muted,
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
    );
  }
}

class _CourseCatalogCard extends StatelessWidget {
  const _CourseCatalogCard({
    required this.course,
    required this.l10n,
    required this.onTap,
  });

  final StudentCourse course;
  final AppLocalizations l10n;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final progress = (course.progressPercent.clamp(0, 100)) / 100.0;
    final duration = formatCourseTotalDuration(
      l10n,
      course.estimatedDurationMinutes,
    );
    final subtitle = (course.shortDescription?.trim().isNotEmpty == true)
        ? course.shortDescription!.trim()
        : _statusLabel(l10n, course.enrollmentStatus);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: CourseSoftCard(
        onTap: onTap,
        padding: const EdgeInsets.fromLTRB(18, 16, 10, 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.heading,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    duration.isNotEmpty ? duration : subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: BatColors.muted,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(child: CourseAccentProgressBar(value: progress)),
                      const SizedBox(width: 10),
                      Text(
                        l10n.courseProgressPercent(course.progressPercent),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: BatColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            if (course.coverImageUrl != null &&
                course.coverImageUrl!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  course.coverImageUrl!,
                  width: 88,
                  height: 88,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const CourseHeroIllustration(size: 92),
                ),
              )
            else
              const CourseHeroIllustration(size: 92),
          ],
        ),
      ),
    );
  }

  String _statusLabel(
    AppLocalizations l10n,
    StudentCourseEnrollmentStatus? status,
  ) {
    switch (status) {
      case StudentCourseEnrollmentStatus.active:
        return l10n.courseStatusInProgress;
      case StudentCourseEnrollmentStatus.completed:
        return l10n.courseStatusCompleted;
      case StudentCourseEnrollmentStatus.notStarted:
      case null:
        return l10n.courseStatusNotStarted;
      case StudentCourseEnrollmentStatus.unknown:
        return l10n.courseStatusUnknown;
    }
  }
}
