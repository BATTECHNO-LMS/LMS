import 'package:flutter/material.dart';

import '../../app/localization/l10n/app_localizations.dart';
import '../../app/theme/bat_colors.dart';
import '../../core/auth/lms_roles.dart';

class ShellNavItem {
  const ShellNavItem({
    required this.label,
    required this.icon,
    required this.route,
  });

  final String label;
  final IconData icon;
  final String route;
}

List<ShellNavItem> shellNavForRole(String role, AppLocalizations l10n) {
  switch (role) {
    case LmsRoles.student:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.training,
          icon: Icons.hiking_outlined,
          route: '/home/training',
        ),
        ShellNavItem(
          label: l10n.courses,
          icon: Icons.menu_book_outlined,
          route: '/home/courses',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.instructor:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.myTrainings,
          icon: Icons.hiking_outlined,
          route: '/home/trainings',
        ),
        ShellNavItem(
          label: l10n.students,
          icon: Icons.groups_outlined,
          route: '/home/students',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.universityAdmin:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.opportunities,
          icon: Icons.work_outline,
          route: '/home/opportunities',
        ),
        ShellNavItem(
          label: l10n.trainees,
          icon: Icons.groups_outlined,
          route: '/home/trainees',
        ),
        ShellNavItem(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          route: '/home/reports',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.academicAdmin:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.training,
          icon: Icons.work_outline,
          route: '/home/opportunities',
        ),
        ShellNavItem(
          label: l10n.trainees,
          icon: Icons.groups_outlined,
          route: '/home/trainees',
        ),
        ShellNavItem(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          route: '/home/reports',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.qaOfficer:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.reviews,
          icon: Icons.rate_review_outlined,
          route: '/home/reviews',
        ),
        ShellNavItem(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          route: '/home/reports',
        ),
        ShellNavItem(
          label: l10n.notifications,
          icon: Icons.notifications_outlined,
          route: '/home/notifications',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.universityReviewer:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.reviews,
          icon: Icons.rate_review_outlined,
          route: '/home/reviews',
        ),
        ShellNavItem(
          label: l10n.trainees,
          icon: Icons.groups_outlined,
          route: '/home/trainees',
        ),
        ShellNavItem(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          route: '/home/reports',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    case LmsRoles.superAdmin:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.universities,
          icon: Icons.account_balance_outlined,
          route: '/home/universities',
        ),
        ShellNavItem(
          label: l10n.users,
          icon: Icons.group_outlined,
          route: '/home/users',
        ),
        ShellNavItem(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          route: '/home/reports',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
    default:
      return [
        ShellNavItem(
          label: l10n.home,
          icon: Icons.home_outlined,
          route: '/home',
        ),
        ShellNavItem(
          label: l10n.profile,
          icon: Icons.person_outline,
          route: '/home/profile',
        ),
      ];
  }
}

class AppBottomNavigation extends StatelessWidget {
  const AppBottomNavigation({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
  });

  final List<ShellNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Material(
        elevation: 10,
        shadowColor: BatColors.primary.withValues(alpha: 0.25),
        color: BatColors.cream,
        borderRadius: BorderRadius.circular(36),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _PillNavItem(
                    item: items[i],
                    selected: i == currentIndex,
                    onTap: () => onTap(i),
                    compact: items.length >= 5,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PillNavItem extends StatelessWidget {
  const _PillNavItem({
    required this.item,
    required this.selected,
    required this.onTap,
    required this.compact,
  });

  final ShellNavItem item;
  final bool selected;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: EdgeInsets.symmetric(
            vertical: compact ? 8 : 6,
            horizontal: 4,
          ),
          decoration: BoxDecoration(
            color: selected ? BatColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                item.icon,
                size: compact ? 20 : 22,
                color: selected ? Colors.white : BatColors.primary,
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: compact ? 9 : 10,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : BatColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
