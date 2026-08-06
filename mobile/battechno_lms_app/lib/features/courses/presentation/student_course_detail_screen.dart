import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/student_courses_repository.dart';
import '../domain/course_url_safety.dart';
import '../domain/student_course_models.dart';
import 'course_design_widgets.dart';

class StudentCourseDetailScreen extends ConsumerStatefulWidget {
  const StudentCourseDetailScreen({super.key, required this.courseId});

  final String courseId;

  @override
  ConsumerState<StudentCourseDetailScreen> createState() =>
      _StudentCourseDetailScreenState();
}

class _StudentCourseDetailScreenState
    extends ConsumerState<StudentCourseDetailScreen> {
  StudentCourseDetail? _detail;
  bool _loading = true;
  bool _starting = false;
  bool _completing = false;
  String? _error;
  String? _expandedLessonId;
  String _lessonQuery = '';
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

  Future<void> _load({bool keepExpanded = true}) async {
    final user = ref.read(authControllerProvider).user;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await ref
          .read(studentCoursesRepositoryProvider)
          .loadDetail(userId: user.id, courseId: widget.courseId);
      setState(() {
        _detail = detail;
        if (!keepExpanded) _expandedLessonId = null;
      });
    } on ApiException catch (e) {
      if (e.isForbidden) {
        setState(() => _error = 'forbidden');
      } else if (e.isNotFound) {
        setState(() => _error = 'not_found');
      } else {
        setState(() => _error = e.isNetwork ? 'network' : e.message);
      }
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _ensureStarted() async {
    final detail = _detail;
    if (detail == null || detail.course.hasStarted) return;
    try {
      await ref
          .read(studentCoursesRepositoryProvider)
          .startCourse(widget.courseId);
      await _load();
    } on ApiException catch (e) {
      if (e.isConflict) {
        await _load();
        return;
      }
      rethrow;
    }
  }

  Future<void> _startOrContinue() async {
    final detail = _detail;
    if (detail == null || _starting) return;
    final l10n = AppLocalizations.of(context);

    if (detail.course.isCompleted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.courseCompletedLabel)));
      return;
    }

    setState(() => _starting = true);
    try {
      await _ensureStarted();
      final next = _detail?.nextLesson;
      if (next != null && mounted) {
        setState(() => _expandedLessonId = next.id);
      } else if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.courseNoNextLesson)));
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.isNetwork ? l10n.courseOfflineWriteBlocked : e.message,
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _markLessonComplete(CourseLesson lesson) async {
    if (_completing || lesson.isCompleted) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _completing = true);
    try {
      await _ensureStarted();
      await ref
          .read(studentCoursesRepositoryProvider)
          .completeLesson(courseId: widget.courseId, lessonId: lesson.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.lessonMarkedComplete)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.isNetwork ? l10n.courseOfflineWriteBlocked : e.message,
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  List<(CourseSection?, CourseLesson)> _visibleLessons(StudentCourseDetail d) {
    final q = _lessonQuery.trim().toLowerCase();
    final out = <(CourseSection?, CourseLesson)>[];
    for (final section in d.sections) {
      for (final lesson in section.lessons) {
        if (q.isEmpty ||
            lesson.title.toLowerCase().contains(q) ||
            (lesson.description?.toLowerCase().contains(q) ?? false)) {
          out.add((section, lesson));
        }
      }
    }
    return out;
  }

  int? _totalDurationMinutes(StudentCourseDetail d) {
    if (d.course.estimatedDurationMinutes != null &&
        d.course.estimatedDurationMinutes! > 0) {
      return d.course.estimatedDurationMinutes;
    }
    var sum = 0;
    var any = false;
    for (final s in d.sections) {
      for (final l in s.lessons) {
        if (l.durationMinutes != null) {
          sum += l.durationMinutes!;
          any = true;
        }
      }
    }
    return any ? sum : null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading && _detail == null) {
      return Scaffold(
        backgroundColor: kCoursePageBg,
        appBar: AppBar(
          title: Text(l10n.courses),
          backgroundColor: kCoursePageBg,
          surfaceTintColor: Colors.transparent,
        ),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 6),
        ),
      );
    }
    if (_error != null && _detail == null) {
      return Scaffold(
        backgroundColor: kCoursePageBg,
        appBar: AppBar(
          title: Text(l10n.courses),
          backgroundColor: kCoursePageBg,
          surfaceTintColor: Colors.transparent,
        ),
        body: RetryView(
          title: l10n.networkErrorTitle,
          message: switch (_error) {
            'network' => l10n.networkErrorBody,
            'forbidden' => l10n.courseAccessDenied,
            'not_found' => l10n.courseNotFound,
            _ => _error!,
          },
          onRetry: _load,
        ),
      );
    }

    final detail = _detail!;
    final course = detail.course;
    final durationLabel = formatCourseTotalDuration(
      l10n,
      _totalDurationMinutes(detail),
    );
    final lessons = _visibleLessons(detail);
    final showSectionLabels = detail.sections.length > 1;

    return Scaffold(
      backgroundColor: kCoursePageBg,
      appBar: AppBar(
        backgroundColor: kCoursePageBg,
        surfaceTintColor: Colors.transparent,
        title: Text(course.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(keepExpanded: false),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 36),
          children: [
            CoursePillSearchField(
              controller: _searchController,
              hintText: l10n.searchLessons,
              onChanged: (v) => setState(() => _lessonQuery = v),
            ),
            const SizedBox(height: 18),
            CourseHeroHeaderCard(
              title: course.title,
              durationLabel: durationLabel,
              coverImageUrl: course.coverImageUrl,
            ),
            if (!course.isCompleted) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _starting ? null : _startOrContinue,
                  style: TextButton.styleFrom(
                    foregroundColor: kCourseAccent,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: _starting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          course.hasStarted
                              ? l10n.continueLearning
                              : l10n.startCourse,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ),
            ] else ...[
              const SizedBox(height: 12),
              Center(
                child: StatusChip(
                  label: l10n.courseCompletedLabel,
                  color: BatColors.success,
                ),
              ),
            ],
            const SizedBox(height: 18),
            Text(
              l10n.courseLessons,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 14),
            if (detail.sections.isEmpty)
              InfoBanner(message: l10n.courseNoSections)
            else if (lessons.isEmpty)
              InfoBanner(message: l10n.courseNoLessonsMatch)
            else
              ..._buildLessonCards(
                context: context,
                l10n: l10n,
                lessons: lessons,
                showSectionLabels: showSectionLabels,
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildLessonCards({
    required BuildContext context,
    required AppLocalizations l10n,
    required List<(CourseSection?, CourseLesson)> lessons,
    required bool showSectionLabels,
  }) {
    final widgets = <Widget>[];
    String? lastSectionId;
    for (final entry in lessons) {
      final section = entry.$1;
      final lesson = entry.$2;
      if (showSectionLabels && section != null && section.id != lastSectionId) {
        lastSectionId = section.id;
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Text(
              section.title,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: BatColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        );
      }
      final isExpanded = _expandedLessonId == lesson.id;
      widgets.add(
        CourseLessonExpandableCard(
          lesson: lesson,
          l10n: l10n,
          expanded: isExpanded,
          completing: _completing && isExpanded,
          onToggle: () {
            setState(() {
              _expandedLessonId = isExpanded ? null : lesson.id;
            });
          },
          onMarkComplete: () => _markLessonComplete(lesson),
        ),
      );
    }
    return widgets;
  }
}

/// Deep-link / notification fallback lesson screen (also embeds YouTube in-app).
class StudentCourseLessonScreen extends ConsumerStatefulWidget {
  const StudentCourseLessonScreen({
    super.key,
    required this.courseId,
    required this.lessonId,
  });

  final String courseId;
  final String lessonId;

  @override
  ConsumerState<StudentCourseLessonScreen> createState() =>
      _StudentCourseLessonScreenState();
}

class _StudentCourseLessonScreenState
    extends ConsumerState<StudentCourseLessonScreen> {
  StudentCourseDetail? _detail;
  CourseLesson? _lesson;
  bool _loading = true;
  bool _completing = false;
  String? _error;

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
      final detail = await ref
          .read(studentCoursesRepositoryProvider)
          .loadDetail(userId: user.id, courseId: widget.courseId);
      CourseLesson? found;
      for (final s in detail.sections) {
        for (final l in s.lessons) {
          if (l.id == widget.lessonId) {
            found = l;
            break;
          }
        }
      }
      setState(() {
        _detail = detail;
        _lesson = found;
        if (found == null) _error = 'not_found';
      });
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markComplete() async {
    if (_completing || _lesson?.isCompleted == true) return;
    setState(() => _completing = true);
    final l10n = AppLocalizations.of(context);
    try {
      if (_detail?.course.hasStarted != true) {
        try {
          await ref
              .read(studentCoursesRepositoryProvider)
              .startCourse(widget.courseId);
        } on ApiException catch (e) {
          if (!e.isConflict) rethrow;
        }
      }
      await ref
          .read(studentCoursesRepositoryProvider)
          .completeLesson(courseId: widget.courseId, lessonId: widget.lessonId);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.lessonMarkedComplete)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.isNetwork ? l10n.courseOfflineWriteBlocked : e.message,
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  Future<void> _openExternal(String? url) async {
    final l10n = AppLocalizations.of(context);
    if (url == null || url.trim().isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.courseLinkMissing)));
      return;
    }
    if (!isSafeLessonUrl(url)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.courseLinkUnsafe)));
      return;
    }
    final uri = Uri.parse(url.trim());
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _lesson == null) {
      return Scaffold(
        backgroundColor: kCoursePageBg,
        appBar: AppBar(
          title: Text(l10n.courseLesson),
          backgroundColor: kCoursePageBg,
          surfaceTintColor: Colors.transparent,
        ),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 5),
        ),
      );
    }
    if (_error != null && _lesson == null) {
      return Scaffold(
        backgroundColor: kCoursePageBg,
        appBar: AppBar(
          title: Text(l10n.courseLesson),
          backgroundColor: kCoursePageBg,
          surfaceTintColor: Colors.transparent,
        ),
        body: RetryView(
          title: l10n.networkErrorTitle,
          message: _error == 'not_found' ? l10n.lessonNotFound : _error!,
          onRetry: _load,
        ),
      );
    }

    final lesson = _lesson!;
    final youtubeId = extractYoutubeVideoId(lesson.videoUrl);
    final percent = lesson.isCompleted ? 100 : 0;

    return Scaffold(
      backgroundColor: kCoursePageBg,
      appBar: AppBar(
        title: Text(lesson.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: kCoursePageBg,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 36),
        children: [
          CourseSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: lesson.isCompleted
                            ? BatColors.success
                            : kCourseAccent,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        lesson.isCompleted
                            ? Icons.check_rounded
                            : courseLessonTypeIcon(lesson.type),
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lesson.title,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          if (lesson.durationMinutes != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              l10n.courseLessonDuration(
                                lesson.durationMinutes!,
                              ),
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: BatColors.muted),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: CourseAccentProgressBar(
                                  value: percent / 100,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                l10n.courseProgressPercent(percent),
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: BatColors.muted,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (youtubeId != null) ...[
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: InAppYoutubePlayer(videoId: youtubeId),
                    ),
                  ),
                ] else if (lesson.videoUrl != null &&
                    lesson.videoUrl!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    isSafeLessonUrl(lesson.videoUrl)
                        ? l10n.courseVideoNotYoutube
                        : l10n.courseLinkUnsafe,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                  ),
                ],
              ],
            ),
          ),
          if (lesson.description != null && lesson.description!.isNotEmpty) ...[
            const SizedBox(height: 14),
            CourseSoftCard(
              child: Text(
                lesson.description!,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
              ),
            ),
          ],
          if (lesson.content != null && lesson.content!.isNotEmpty) ...[
            const SizedBox(height: 14),
            CourseSoftCard(
              child: Text(
                lesson.content!,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
          ],
          if (lesson.resourceUrl != null && lesson.resourceUrl!.isNotEmpty) ...[
            const SizedBox(height: 12),
            CourseSoftCard(
              onTap: () => _openExternal(lesson.resourceUrl),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: kCourseAccent,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.menu_rounded, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      l10n.openLessonResource,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                  ),
                  const Icon(Icons.open_in_new, color: BatColors.muted),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          InfoBanner(message: l10n.lessonTrainingWebOnlyHint),
          const SizedBox(height: 20),
          if (!lesson.isCompleted)
            PrimaryButton(
              label: l10n.markLessonComplete,
              isLoading: _completing,
              onPressed: _markComplete,
            )
          else
            StatusChip(label: l10n.lessonCompleted, color: BatColors.success),
        ],
      ),
    );
  }
}
