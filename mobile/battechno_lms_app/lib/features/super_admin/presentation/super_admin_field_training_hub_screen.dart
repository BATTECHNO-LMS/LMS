import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../admin/presentation/admin_opportunities_screen.dart';
import 'widgets/super_admin_widgets.dart';

/// Field-training oversight for `super_admin` — reuses the existing
/// university/academic admin opportunities screen and its `/admin/
/// field-training/*` detail routes unmodified. The backend already grants
/// `super_admin` (global) the same `FIELD_TRAINING_ADMIN`/`MANAGE` access as
/// `university_admin`/`academic_admin`, and `AdminCapabilities` was extended
/// (Phase 24) to recognize `super_admin` for the same client-side checks.
class SuperAdminFieldTrainingHubScreen extends StatelessWidget {
  const SuperAdminFieldTrainingHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: l10n.superAdminFieldTrainingOversight,
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: SaScopeBanner(message: l10n.superAdminGlobalScopeNotice),
            ),
            const Expanded(child: AdminOpportunitiesScreen()),
          ],
        ),
      ),
    );
  }
}
