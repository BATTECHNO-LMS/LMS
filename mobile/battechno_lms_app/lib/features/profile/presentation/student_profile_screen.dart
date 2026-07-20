import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../../field_training/domain/field_training_models.dart';

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
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row(l10n.email, user.email),
                _row(
                  l10n.phoneOptional.split('(').first.trim(),
                  user.phone ?? '—',
                ),
                _row(l10n.university, user.universityName ?? '—'),
                _row(l10n.specialty, user.specialtyLabel(isArabic: isArabic)),
                _row(l10n.accountStatus, _statusLabel(user.status, l10n)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        InfoBanner(message: l10n.profileReadOnlyNotice),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.push('/student/settings'),
          child: Text(l10n.settings),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => context.push('/student/certificates'),
          child: Text(l10n.certificatesAndDocuments),
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

  String _statusLabel(String status, AppLocalizations l10n) {
    return FieldTrainingLabels.trainingStatusAr(status);
  }
}
