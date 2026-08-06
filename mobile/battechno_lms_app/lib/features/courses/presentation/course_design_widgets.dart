import 'package:flutter/material.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../domain/course_url_safety.dart';
import '../domain/student_course_models.dart';

/// Page background matching the mockup light gray.
const Color kCoursePageBg = Color(0xFFF2F3F5);

/// Brand blue used where the mockup used mustard yellow.
const Color kCourseAccent = BatColors.primaryLight;

String formatCourseTotalDuration(AppLocalizations l10n, int? minutes) {
  if (minutes == null || minutes <= 0) return '';
  if (minutes < 60) {
    return l10n.courseDurationTotalMinutes(minutes);
  }
  final hours = minutes ~/ 60;
  final rem = minutes % 60;
  return l10n.courseDurationTotalHours(hours, rem);
}

IconData courseLessonTypeIcon(CourseLessonType type) {
  switch (type) {
    case CourseLessonType.video:
      return Icons.play_arrow_rounded;
    case CourseLessonType.text:
      return Icons.menu_rounded;
    case CourseLessonType.link:
      return Icons.link_rounded;
    case CourseLessonType.file:
      return Icons.description_outlined;
    case CourseLessonType.unknown:
      return Icons.menu_book_rounded;
  }
}

class CourseSoftCard extends StatelessWidget {
  const CourseSoftCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(20),
    this.radius = 26,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final radiusGeom = BorderRadius.circular(radius);
    final content = Padding(padding: padding, child: child);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: radiusGeom,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: onTap == null
          ? content
          : Material(
              color: Colors.transparent,
              borderRadius: radiusGeom,
              child: InkWell(
                onTap: onTap,
                borderRadius: radiusGeom,
                child: content,
              ),
            ),
    );
  }
}

/// Pill search — same structure as the mockup (hint left, icon right).
class CoursePillSearchField extends StatelessWidget {
  const CoursePillSearchField({
    super.key,
    required this.hintText,
    this.controller,
    this.onChanged,
    this.onSubmitted,
  });

  final String hintText;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: TextInputAction.search,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        color: BatColors.heading,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: TextStyle(color: BatColors.muted.withValues(alpha: 0.85)),
        prefixIcon: const Icon(Icons.search, color: BatColors.primary),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: BatColors.primary, width: 1.4),
        ),
      ),
    );
  }
}

class CourseAccentProgressBar extends StatelessWidget {
  const CourseAccentProgressBar({super.key, required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: value.clamp(0.0, 1.0),
        minHeight: 6,
        color: kCourseAccent,
        backgroundColor: const Color(0xFFE6E8EC),
      ),
    );
  }
}

/// Line-art style study illustration (mockup hero art, brand blue accents).
class CourseHeroIllustration extends StatelessWidget {
  const CourseHeroIllustration({super.key, this.size = 118});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _CourseHeroPainter(size: size)),
    );
  }
}

class _CourseHeroPainter extends CustomPainter {
  _CourseHeroPainter({required this.size});

  final double size;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final stroke = Paint()
      ..color = BatColors.heading
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillBlue = Paint()
      ..color = kCourseAccent
      ..style = PaintingStyle.fill;

    final fillSoft = Paint()
      ..color = BatColors.primarySoft
      ..style = PaintingStyle.fill;

    final cx = canvasSize.width * 0.52;
    final cy = canvasSize.height * 0.42;

    final desk = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx, cy + size * 0.28),
        width: size * 0.55,
        height: size * 0.12,
      ),
      const Radius.circular(6),
    );
    canvas.drawRRect(desk, fillSoft);
    canvas.drawRRect(desk, stroke);

    final screen = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        cx - size * 0.18,
        cy + size * 0.02,
        size * 0.36,
        size * 0.22,
      ),
      const Radius.circular(4),
    );
    canvas.drawRRect(screen, Paint()..color = Colors.white);
    canvas.drawRRect(screen, stroke);

    canvas.drawCircle(
      Offset(cx - size * 0.06, cy - size * 0.18),
      size * 0.09,
      stroke,
    );

    canvas.drawArc(
      Rect.fromCircle(
        center: Offset(cx - size * 0.06, cy - size * 0.18),
        radius: size * 0.09,
      ),
      3.6,
      2.4,
      false,
      stroke,
    );

    final body = Path()
      ..moveTo(cx - size * 0.18, cy + size * 0.18)
      ..quadraticBezierTo(
        cx - size * 0.16,
        cy - size * 0.02,
        cx - size * 0.08,
        cy - size * 0.06,
      )
      ..lineTo(cx + size * 0.02, cy - size * 0.06)
      ..quadraticBezierTo(
        cx + size * 0.06,
        cy + size * 0.02,
        cx + size * 0.08,
        cy + size * 0.18,
      )
      ..close();
    canvas.drawPath(body, fillBlue);
    canvas.drawPath(body, stroke);

    _bubble(canvas, Offset(cx + size * 0.28, cy - size * 0.22), size * 0.11);
    final code = TextPainter(
      text: TextSpan(
        text: '</>',
        style: TextStyle(
          color: BatColors.heading,
          fontSize: size * 0.07,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    code.paint(
      canvas,
      Offset(
        cx + size * 0.28 - code.width / 2,
        cy - size * 0.22 - code.height / 2,
      ),
    );

    _bubble(canvas, Offset(cx - size * 0.32, cy - size * 0.08), size * 0.1);
    final play = Path()
      ..moveTo(cx - size * 0.35, cy - size * 0.12)
      ..lineTo(cx - size * 0.35, cy - size * 0.04)
      ..lineTo(cx - size * 0.28, cy - size * 0.08)
      ..close();
    canvas.drawPath(play, fillBlue);
  }

  void _bubble(Canvas canvas, Offset c, double r) {
    canvas.drawCircle(c, r, Paint()..color = Colors.white);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = BatColors.heading
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8,
    );
  }

  @override
  bool shouldRepaint(covariant _CourseHeroPainter oldDelegate) =>
      oldDelegate.size != size;
}

/// Hero card: title + total duration + illustration (mockup exact).
class CourseHeroHeaderCard extends StatelessWidget {
  const CourseHeroHeaderCard({
    super.key,
    required this.title,
    required this.durationLabel,
    this.coverImageUrl,
  });

  final String title;
  final String durationLabel;
  final String? coverImageUrl;

  @override
  Widget build(BuildContext context) {
    return CourseSoftCard(
      padding: const EdgeInsets.fromLTRB(22, 22, 12, 22),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                    height: 1.15,
                    fontSize: 22,
                  ),
                ),
                if (durationLabel.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    durationLabel,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF8B93A0),
                      fontWeight: FontWeight.w400,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 4),
          if (coverImageUrl != null && coverImageUrl!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                coverImageUrl!,
                width: 110,
                height: 110,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const CourseHeroIllustration(size: 118),
              ),
            )
          else
            const CourseHeroIllustration(size: 118),
        ],
      ),
    );
  }
}

/// Expandable lesson card: mockup header + in-app YouTube / lesson body.
class CourseLessonExpandableCard extends StatelessWidget {
  const CourseLessonExpandableCard({
    super.key,
    required this.lesson,
    required this.l10n,
    required this.expanded,
    required this.onToggle,
    required this.completing,
    required this.onMarkComplete,
  });

  final CourseLesson lesson;
  final AppLocalizations l10n;
  final bool expanded;
  final VoidCallback onToggle;
  final bool completing;
  final VoidCallback onMarkComplete;

  @override
  Widget build(BuildContext context) {
    final percent = lesson.isCompleted ? 100 : 0;
    final progress = percent / 100.0;
    final desc = (lesson.description?.trim().isNotEmpty == true)
        ? lesson.description!.trim()
        : null;
    final youtubeId = extractYoutubeVideoId(lesson.videoUrl);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: CourseSoftCard(
        onTap: onToggle,
        padding: const EdgeInsets.fromLTRB(16, 18, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: lesson.isCompleted
                        ? BatColors.success
                        : kCourseAccent,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    lesson.isCompleted
                        ? Icons.check_rounded
                        : (expanded
                              ? Icons.expand_less_rounded
                              : courseLessonTypeIcon(lesson.type)),
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
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                              height: 1.2,
                              fontSize: 17,
                            ),
                      ),
                      if (desc != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          desc,
                          maxLines: expanded ? 6 : 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: const Color(0xFF8B93A0),
                                height: 1.4,
                                fontSize: 13,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                SizedBox(
                  width: 52,
                  child: Text(
                    lesson.durationMinutes != null
                        ? l10n.courseLessonDuration(lesson.durationMinutes!)
                        : '',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: const Color(0xFF8B93A0),
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: CourseAccentProgressBar(value: progress)),
                const SizedBox(width: 10),
                Text(
                  l10n.courseProgressPercent(percent),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF8B93A0),
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeInOut,
              alignment: Alignment.topCenter,
              child: expanded
                  ? _LessonExpandedBody(
                      lesson: lesson,
                      l10n: l10n,
                      youtubeId: youtubeId,
                      completing: completing,
                      onMarkComplete: onMarkComplete,
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

class _LessonExpandedBody extends StatelessWidget {
  const _LessonExpandedBody({
    required this.lesson,
    required this.l10n,
    required this.youtubeId,
    required this.completing,
    required this.onMarkComplete,
  });

  final CourseLesson lesson;
  final AppLocalizations l10n;
  final String? youtubeId;
  final bool completing;
  final VoidCallback onMarkComplete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (youtubeId != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: InAppYoutubePlayer(videoId: youtubeId!),
              ),
            ),
            const SizedBox(height: 12),
          ] else if (lesson.videoUrl != null &&
              lesson.videoUrl!.trim().isNotEmpty) ...[
            Text(
              isSafeLessonUrl(lesson.videoUrl)
                  ? l10n.courseVideoNotYoutube
                  : l10n.courseLinkUnsafe,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
            const SizedBox(height: 12),
          ],
          if (lesson.content != null && lesson.content!.trim().isNotEmpty) ...[
            Text(
              lesson.content!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: BatColors.onSurface,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (youtubeId == null &&
              (lesson.content == null || lesson.content!.trim().isEmpty) &&
              (lesson.videoUrl == null || lesson.videoUrl!.trim().isEmpty) &&
              (lesson.resourceUrl == null ||
                  lesson.resourceUrl!.trim().isEmpty))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                l10n.courseLinkMissing,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
              ),
            ),
          if (!lesson.isCompleted)
            FilledButton(
              onPressed: completing ? null : onMarkComplete,
              style: FilledButton.styleFrom(
                backgroundColor: BatColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: completing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      l10n.markLessonComplete,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
            )
          else
            Text(
              l10n.lessonCompleted,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: BatColors.success,
                fontWeight: FontWeight.w800,
              ),
            ),
        ],
      ),
    );
  }
}

/// Embedded YouTube player — stays inside the app (no external YouTube app).
class InAppYoutubePlayer extends StatefulWidget {
  const InAppYoutubePlayer({super.key, required this.videoId});

  final String videoId;

  @override
  State<InAppYoutubePlayer> createState() => _InAppYoutubePlayerState();
}

class _InAppYoutubePlayerState extends State<InAppYoutubePlayer> {
  late final YoutubePlayerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = YoutubePlayerController.fromVideoId(
      videoId: widget.videoId,
      autoPlay: false,
      params: const YoutubePlayerParams(
        showFullscreenButton: true,
        showControls: true,
        strictRelatedVideos: true,
        playsInline: true,
        enableCaption: true,
        origin: 'https://www.youtube-nocookie.com',
      ),
    );
  }

  @override
  void dispose() {
    _controller.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return YoutubePlayer(controller: _controller, aspectRatio: 16 / 9);
  }
}
