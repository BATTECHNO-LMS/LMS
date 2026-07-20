import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/push/push_config.dart';
import '../../../core/push/push_message.dart';
import '../providers/push_permission_controller.dart';

/// Settings-screen row showing the current OS notification permission
/// status. When push isn't configured (the default in this repo) it shows
/// an "unsupported" label rather than a misleading toggle.
class PushPermissionSettingsTile extends ConsumerStatefulWidget {
  const PushPermissionSettingsTile({super.key});

  @override
  ConsumerState<PushPermissionSettingsTile> createState() =>
      _PushPermissionSettingsTileState();
}

class _PushPermissionSettingsTileState
    extends ConsumerState<PushPermissionSettingsTile> {
  @override
  void initState() {
    super.initState();
    if (PushConfig.isConfigured) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(pushPermissionControllerProvider.notifier).refreshStatus();
      });
    }
  }

  String _statusLabel(AppLocalizations l10n, PushPermissionStatus status) {
    switch (status) {
      case PushPermissionStatus.granted:
        return l10n.pushPermissionStatusGranted;
      case PushPermissionStatus.provisional:
        return l10n.pushPermissionStatusProvisional;
      case PushPermissionStatus.denied:
        return l10n.pushPermissionStatusDenied;
      case PushPermissionStatus.notDetermined:
        return l10n.pushPermissionStatusNotDetermined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(pushPermissionControllerProvider);

    if (!PushConfig.isConfigured) {
      return ListTile(
        leading: const Icon(Icons.notifications_outlined),
        title: Text(l10n.pushPermissionSettingsTitle),
        subtitle: Text(l10n.pushPermissionStatusUnsupported),
      );
    }

    final canRequest = state.status != PushPermissionStatus.granted;
    return ListTile(
      leading: const Icon(Icons.notifications_outlined),
      title: Text(l10n.pushPermissionSettingsTitle),
      subtitle: Text(_statusLabel(l10n, state.status)),
      trailing: !canRequest
          ? null
          : TextButton(
              onPressed: state.isSyncing
                  ? null
                  : () => ref
                        .read(pushPermissionControllerProvider.notifier)
                        .requestAndSync(),
              child: Text(l10n.pushPermissionSettingsAction),
            ),
    );
  }
}
