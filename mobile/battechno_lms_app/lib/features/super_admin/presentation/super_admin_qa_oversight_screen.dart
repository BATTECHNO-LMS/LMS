import 'package:flutter/material.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../auth/domain/auth_user.dart';
import '../../reviewer/presentation/qa_reviews_hub_screen.dart';
import '../../reviewer/presentation/reviewer_reviews_hub_screen.dart';

enum _SuperAdminQaDomain { qa, recognition }

/// QA/recognition/enrollment oversight for `super_admin` — embeds the
/// existing Phase 23 hub widgets unmodified. Neither hub gates by role on
/// the client; both call the backend directly, and the backend's
/// `QA_OVERSIGHT_ROLE_CODES` / `RISK_INTEGRITY_ROLE_CODES` /
/// `RECOGNITION_*_ROLE_CODES` / `ENROLLMENT_DECISION_ROLE_CODES` all include
/// `super_admin` explicitly (see `backend/src/config/env.js`), so this is a
/// safe, minimal-duplication reuse.
class SuperAdminQaOversightScreen extends StatefulWidget {
  const SuperAdminQaOversightScreen({super.key, required this.user});

  final AuthUser user;

  @override
  State<SuperAdminQaOversightScreen> createState() =>
      _SuperAdminQaOversightScreenState();
}

class _SuperAdminQaOversightScreenState
    extends State<SuperAdminQaOversightScreen> {
  _SuperAdminQaDomain _domain = _SuperAdminQaDomain.qa;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.superAdminQaOversight)),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: SegmentedButton<_SuperAdminQaDomain>(
                segments: [
                  ButtonSegment(
                    value: _SuperAdminQaDomain.qa,
                    label: Text(l10n.qaReviewsTitle),
                  ),
                  ButtonSegment(
                    value: _SuperAdminQaDomain.recognition,
                    label: Text(l10n.recognitionRequestsTitle),
                  ),
                ],
                selected: {_domain},
                onSelectionChanged: (s) => setState(() => _domain = s.first),
              ),
            ),
            Expanded(
              child: _domain == _SuperAdminQaDomain.qa
                  ? const QaReviewsHubScreen()
                  : ReviewerReviewsHubScreen(user: widget.user),
            ),
          ],
        ),
      ),
    );
  }
}
