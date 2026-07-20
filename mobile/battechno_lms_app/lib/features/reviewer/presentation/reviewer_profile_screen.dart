import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/auth/lms_roles.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';

/// Profile + logout for `qa_officer` and `university_reviewer`, matching
/// the admin/instructor profile pattern.
class ReviewerProfileScreen extends ConsumerWidget {
  const ReviewerProfileScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  final AuthUser user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final roleLabel = user.primaryRole == LmsRoles.qaOfficer
        ? l10n.qaOfficerRoleLabel
        : l10n.universityReviewerRoleLabel;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: CircleAvatar(
            radius: 42,
            child: Text(
              user.fullName.isNotEmpty ? user.fullName.characters.first : '?',
              style: const TextStyle(fontSize: 28),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            user.fullName,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(height: 4),
        Center(child: Text(roleLabel)),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row(l10n.email, user.email),
                _row(l10n.university, user.universityName ?? '—'),
                _row(l10n.accountStatus, user.status),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        InfoBanner(message: l10n.profileReadOnlyNotice),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.push('/reviewer/settings'),
          child: Text(l10n.settings),
        ),
        const SizedBox(height: 24),
        PrimaryButton(label: l10n.logout, onPressed: onLogout),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
