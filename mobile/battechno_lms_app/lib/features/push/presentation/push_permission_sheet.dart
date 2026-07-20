import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../providers/push_permission_controller.dart';

/// Educational bottom sheet shown once (per device) before the OS permission
/// prompt — explains *why* the app wants to send notifications instead of
/// surprising the user with a bare system dialog.
///
/// Always marks the device as "prompted" on dismissal (enable or skip) so it
/// is never shown again automatically; the settings screen still lets the
/// user retry from there.
Future<void> showPushPermissionSheet(
  BuildContext context,
  WidgetRef ref, {
  String? locale,
  String? appVersion,
}) async {
  final l10n = AppLocalizations.of(context);
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(
                Icons.notifications_active_outlined,
                size: 48,
                color: Theme.of(sheetContext).colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                l10n.pushPermissionSheetTitle,
                textAlign: TextAlign.center,
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.pushPermissionSheetBody,
                textAlign: TextAlign.center,
                style: Theme.of(sheetContext).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: l10n.pushPermissionEnableAction,
                onPressed: () async {
                  Navigator.of(sheetContext).pop();
                  await ref
                      .read(pushPermissionControllerProvider.notifier)
                      .markPrompted();
                  await ref
                      .read(pushPermissionControllerProvider.notifier)
                      .requestAndSync(locale: locale, appVersion: appVersion);
                },
              ),
              const SizedBox(height: 8),
              SecondaryButton(
                label: l10n.pushPermissionSkipAction,
                onPressed: () async {
                  Navigator.of(sheetContext).pop();
                  await ref
                      .read(pushPermissionControllerProvider.notifier)
                      .markPrompted();
                },
              ),
            ],
          ),
        ),
      );
    },
  );
}
