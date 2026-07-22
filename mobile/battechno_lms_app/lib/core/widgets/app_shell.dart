import 'package:flutter/material.dart';

import '../../app/localization/l10n/app_localizations.dart';
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
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: [
        for (final item in items)
          NavigationDestination(icon: Icon(item.icon), label: item.label),
      ],
    );
  }
}
