import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import 'reviewer_widgets.dart';

/// Confirms an enrollment approve/reject decision for
/// `university_reviewer` (`canDecideEnrollment`).
///
/// Returns `null` if the sheet was cancelled, an empty string if the
/// student was approved, or the (possibly empty) trimmed rejection reason
/// if the student was rejected. The backend accepts approve with no body
/// and reject with an optional `rejection_reason`.
Future<String?> showEnrollmentDecisionSheet({
  required BuildContext context,
  required String studentName,
  required bool approve,
}) async {
  final l10n = AppLocalizations.of(context);
  final confirmed = await showConfirmationSheet(
    context: context,
    title: approve
        ? l10n.confirmEnrollmentApproveTitle
        : l10n.confirmEnrollmentRejectTitle,
    body: studentName,
    withNoteField: !approve,
    noteLabel: approve ? null : l10n.enrollmentRejectReasonOptional,
  );
  if (confirmed == null) return null;
  return approve ? '' : confirmed;
}
