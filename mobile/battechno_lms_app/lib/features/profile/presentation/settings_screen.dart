import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/app.dart';
import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../push/presentation/push_permission_settings_tile.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = ref.watch(localeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.settings),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.language_outlined),
            title: Text(l10n.language),
            subtitle: Text(
              locale.languageCode == 'ar'
                  ? l10n.languageArabic
                  : l10n.languageEnglish,
            ),
            onTap: () => ref.read(localeProvider.notifier).toggle(),
          ),
          const PushPermissionSettingsTile(),
          ListTile(
            leading: const Icon(Icons.lock_reset_outlined),
            title: Text(l10n.changePasswordUnavailable),
            subtitle: Text(l10n.useForgotPasswordFlow),
            onTap: () => context.push('/auth/forgot-password'),
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: Text(l10n.privacyNotice),
            subtitle: Text(l10n.privacyNoticeBody),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: Text(l10n.appVersion),
            subtitle: const Text('1.0.0'),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: InfoBanner(message: l10n.logoutServerLimitation),
          ),
        ],
      ),
    );
  }
}
