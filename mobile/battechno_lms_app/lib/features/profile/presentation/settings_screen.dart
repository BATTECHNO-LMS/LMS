import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/app.dart';
import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../push/presentation/push_permission_settings_tile.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  static const _pageBg = Color(0xFFF2F3F5);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = ref.watch(localeProvider);

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Text(l10n.settings),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            _SoftGroupCard(
              child: Column(
                children: [
                  SettingsSoftTile(
                    icon: Icons.language_outlined,
                    title: l10n.language,
                    subtitle: locale.languageCode == 'ar'
                        ? l10n.languageArabic
                        : l10n.languageEnglish,
                    onTap: () => ref.read(localeProvider.notifier).toggle(),
                    showDivider: true,
                  ),
                  const PushPermissionSettingsTile(),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _SoftGroupCard(
              child: SettingsSoftTile(
                icon: Icons.lock_reset_outlined,
                title: l10n.changePasswordUnavailable,
                subtitle: l10n.useForgotPasswordFlow,
                onTap: () => context.push('/auth/forgot-password'),
              ),
            ),
            const SizedBox(height: 12),
            _SoftGroupCard(
              child: Column(
                children: [
                  SettingsSoftTile(
                    icon: Icons.privacy_tip_outlined,
                    title: l10n.privacyNotice,
                    subtitle: l10n.privacyNoticeBody,
                    showDivider: true,
                  ),
                  SettingsSoftTile(
                    icon: Icons.info_outline,
                    title: l10n.appVersion,
                    subtitle: '1.0.0',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _SoftGroupCard(
              padded: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: BatColors.accentSoft,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.info_outline,
                      color: BatColors.accentHover,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      l10n.logoutServerLimitation,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: BatColors.heading,
                        height: 1.4,
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

class _SoftGroupCard extends StatelessWidget {
  const _SoftGroupCard({required this.child, this.padded = false});

  final Widget child;
  final bool padded;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: padded
            ? const EdgeInsets.all(14)
            : const EdgeInsets.symmetric(vertical: 4),
        child: child,
      ),
    );
  }
}
