import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../../dashboard/presentation/home_shell_screen.dart';
import '../../field_training/domain/field_training_models.dart';
import '../../notifications/data/notifications_repository.dart';

class StudentProfileScreen extends ConsumerWidget {
  const StudentProfileScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final AuthUser user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final unread =
        ref
            .watch(notificationsControllerProvider)
            .valueOrNull
            ?.notifications
            .where((n) => !n.isRead)
            .length ??
        0;

    final specialty = user.specialtyLabel(isArabic: isArabic);
    final university = user.universityName?.trim() ?? '';
    final phone = user.phone?.trim() ?? '';
    final hasUniversity = university.isNotEmpty;
    final hasSpecialty = specialty.isNotEmpty;
    final hasPhone = phone.isNotEmpty;

    final filled = [
      true, // email always present for authenticated users
      hasUniversity,
      hasSpecialty,
      hasPhone,
    ].where((e) => e).length;
    final completeness = ((filled / 4) * 100).round();

    final slices = <_DonutSlice>[
      _DonutSlice(value: hasUniversity ? 0.42 : 0.06, color: BatColors.accent),
      _DonutSlice(value: hasSpecialty ? 0.28 : 0.06, color: BatColors.primary),
      _DonutSlice(
        value: hasPhone ? 0.18 : 0.06,
        color: const Color(0xFFD5D8DE),
      ),
    ];
    final used = slices.fold<double>(0, (a, s) => a + s.value);
    slices.add(
      _DonutSlice(
        value: math.max(0.08, 1 - used),
        color: const Color(0xFFEEF0F3),
      ),
    );

    final subtitle = university.isNotEmpty
        ? university
        : (specialty.isNotEmpty
              ? specialty
              : FieldTrainingLabels.trainingStatusAr(user.status));

    return ColoredBox(
      color: const Color(0xFFF3F4F6),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          _ProfileHeroHeader(
            title: l10n.yourProfile,
            name: user.fullName,
            subtitle: subtitle,
            unreadCount: unread,
            onNotifications: () => context.push('/notifications'),
            onBack: () =>
                ref.read(shellTabIndexRequestProvider.notifier).state = 0,
          ),
          Transform.translate(
            offset: const Offset(0, -22),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
              child: _OverviewCard(
                title: l10n.profileOverviewTitle,
                subtitle: l10n.profileOverviewSubtitle,
                centerValue: '$completeness',
                slices: slices,
                legend: [
                  _LegendItem(
                    color: BatColors.accent,
                    label: l10n.profileFieldUniversity,
                  ),
                  _LegendItem(
                    color: BatColors.primary,
                    label: l10n.profileFieldSpecialty,
                  ),
                  _LegendItem(
                    color: const Color(0xFFD5D8DE),
                    label: l10n.profileFieldPhone,
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
            child: Column(
              children: [
                Text(
                  l10n.profileShortcutsTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.profileShortcutsSubtitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: BatColors.muted,
                    height: 1.3,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 10),
                _ShortcutsPill(
                  l10n: l10n,
                  onSettings: () => context.push('/student/settings'),
                  onCertificates: () => context.push('/student/certificates'),
                  onCourses: () =>
                      ref.read(shellTabIndexRequestProvider.notifier).state = 2,
                  onViewAll: () => context.push('/student/settings'),
                ),
                const SizedBox(height: 12),
                _InfoCard(
                  rows: [
                    (l10n.email, user.email),
                    (
                      l10n.phoneOptional.split('(').first.trim(),
                      phone.isEmpty ? '—' : phone,
                    ),
                    (l10n.university, university.isEmpty ? '—' : university),
                    (l10n.specialty, specialty.isEmpty ? '—' : specialty),
                    (
                      l10n.accountStatus,
                      FieldTrainingLabels.trainingStatusAr(user.status),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                InfoBanner(message: l10n.profileReadOnlyNotice),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onLogout,
                    style: FilledButton.styleFrom(
                      backgroundColor: BatColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      l10n.logout,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(height: 110),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileHeroHeader extends StatelessWidget {
  const _ProfileHeroHeader({
    required this.title,
    required this.name,
    required this.subtitle,
    required this.unreadCount,
    required this.onNotifications,
    required this.onBack,
  });

  final String title;
  final String name;
  final String subtitle;
  final int unreadCount;
  final VoidCallback onNotifications;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;

    return SizedBox(
      height: top + 200,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: BatColors.primary),
          CustomPaint(painter: _ProfileWavePainter()),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 0),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: onBack,
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          IconButton(
                            onPressed: onNotifications,
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(
                              Icons.notifications_none_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                          ),
                          if (unreadCount > 0)
                            Positioned(
                              right: 10,
                              top: 10,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: BatColors.accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: BatColors.accent.withValues(alpha: 0.85),
                        width: 1.6,
                      ),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: BatColors.accent.withValues(alpha: 0.45),
                          width: 1.2,
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 34,
                        backgroundColor: BatColors.accent,
                        child: const Icon(
                          Icons.person_rounded,
                          size: 36,
                          color: BatColors.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    name,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.82),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileWavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BatColors.primaryLight.withValues(alpha: 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;

    for (var i = 0; i < 5; i++) {
      final path = Path();
      final yBase = size.height * (0.35 + i * 0.1);
      path.moveTo(0, yBase);
      for (double x = 0; x <= size.width; x += 8) {
        final y =
            yBase +
            math.sin((x / size.width) * math.pi * 2 + i) * (8 + i * 2.5);
        path.lineTo(x, y);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _DonutSlice {
  const _DonutSlice({required this.value, required this.color});
  final double value;
  final Color color;
}

class _LegendItem {
  const _LegendItem({required this.color, required this.label});
  final Color color;
  final String label;
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({
    required this.title,
    required this.subtitle,
    required this.centerValue,
    required this.slices,
    required this.legend,
  });

  final String title;
  final String subtitle;
  final String centerValue;
  final List<_DonutSlice> slices;
  final List<_LegendItem> legend;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: BatColors.primary.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
        child: Column(
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: BatColors.muted,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: 118,
              height: 118,
              child: CustomPaint(
                painter: _DonutPainter(slices: slices),
                child: Center(
                  child: Text(
                    centerValue,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: BatColors.heading,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 6,
              children: legend
                  .map(
                    (item) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: item.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          item.label,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: BatColors.muted),
                        ),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices});

  final List<_DonutSlice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius - 8);
    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = (slice.value.clamp(0.0, 1.0)) * math.pi * 2;
      final paint = Paint()
        ..color = slice.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 12
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.slices != slices;
}

class _ShortcutsPill extends StatelessWidget {
  const _ShortcutsPill({
    required this.l10n,
    required this.onSettings,
    required this.onCertificates,
    required this.onCourses,
    required this.onViewAll,
  });

  final AppLocalizations l10n;
  final VoidCallback onSettings;
  final VoidCallback onCertificates;
  final VoidCallback onCourses;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: BatColors.primary.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
        child: Row(
          children: [
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _ShortcutAvatar(
                    icon: Icons.settings_outlined,
                    label: l10n.settings,
                    onTap: onSettings,
                  ),
                  _ShortcutAvatar(
                    icon: Icons.workspace_premium_outlined,
                    label: l10n.certificatesAndDocuments.split(' ').first,
                    onTap: onCertificates,
                  ),
                  _ShortcutAvatar(
                    icon: Icons.menu_book_outlined,
                    label: l10n.courses,
                    onTap: onCourses,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            Material(
              color: BatColors.accent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                onTap: onViewAll,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Text(
                    l10n.profileViewAll,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShortcutAvatar extends StatelessWidget {
  const _ShortcutAvatar({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: BatColors.primarySoft,
              child: Icon(icon, size: 16, color: BatColors.primary),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: BatColors.muted,
                fontWeight: FontWeight.w600,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.rows});

  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: BatColors.primary.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
        child: Column(
          children: [
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        row.$1,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.muted,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        row.$2,
                        textAlign: TextAlign.end,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: BatColors.heading,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
