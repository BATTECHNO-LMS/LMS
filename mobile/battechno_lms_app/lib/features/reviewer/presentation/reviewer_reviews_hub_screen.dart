import 'package:flutter/material.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../auth/domain/auth_user.dart';
import 'widgets/pending_enrollments_section.dart';
import 'widgets/recognition_requests_section.dart';
import 'widgets/reviewer_widgets.dart';

enum _ReviewerDomain { recognition, enrollments }

/// `university_reviewer` reviews hub — Recognition | Enrollments segments,
/// reusing the same embeddable section widgets as the standalone
/// `/reviewer/recognition` and `/reviewer/enrollments` routes.
class ReviewerReviewsHubScreen extends StatefulWidget {
  const ReviewerReviewsHubScreen({super.key, required this.user});

  final AuthUser user;

  @override
  State<ReviewerReviewsHubScreen> createState() =>
      _ReviewerReviewsHubScreenState();
}

class _ReviewerReviewsHubScreenState extends State<ReviewerReviewsHubScreen> {
  _ReviewerDomain _domain = _ReviewerDomain.recognition;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: DomainFilterChips(
            labels: [
              l10n.recognitionRequestsTitle,
              l10n.pendingEnrollmentsTitle,
            ],
            selectedIndex: _ReviewerDomain.values.indexOf(_domain),
            onSelected: (i) =>
                setState(() => _domain = _ReviewerDomain.values[i]),
          ),
        ),
        Expanded(
          child: _domain == _ReviewerDomain.recognition
              ? RecognitionRequestsSection(user: widget.user)
              : PendingEnrollmentsSection(user: widget.user),
        ),
      ],
    );
  }
}
