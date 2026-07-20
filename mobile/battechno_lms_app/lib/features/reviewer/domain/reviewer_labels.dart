// Status/type label lookups resolved through AppLocalizations (Arabic
// template, English-ready) rather than hardcoded strings in widgets.

import '../../../app/localization/l10n/app_localizations.dart';

abstract final class ReviewerLabels {
  static String qaStatus(AppLocalizations l10n, String? status) {
    switch (status) {
      case 'open':
        return l10n.qaStatusOpen;
      case 'in_progress':
        return l10n.qaStatusInProgress;
      case 'resolved':
        return l10n.qaStatusResolved;
      case 'closed':
        return l10n.qaStatusClosed;
      default:
        return status ?? '—';
    }
  }

  static String correctiveStatus(AppLocalizations l10n, String? status) {
    if (status == 'overdue') return l10n.statusOverdueLabel;
    return qaStatus(l10n, status);
  }

  static String riskStatus(AppLocalizations l10n, String? status) {
    if (status == 'escalated') return l10n.statusEscalatedLabel;
    return qaStatus(l10n, status);
  }

  static String integrityStatus(AppLocalizations l10n, String? status) {
    switch (status) {
      case 'reported':
        return l10n.statusReportedLabel;
      case 'under_investigation':
        return l10n.statusUnderInvestigationLabel;
      case 'resolved':
        return l10n.qaStatusResolved;
      case 'closed':
        return l10n.qaStatusClosed;
      default:
        return status ?? '—';
    }
  }

  static String recognitionStatus(AppLocalizations l10n, String? status) {
    switch (status) {
      case 'draft':
        return l10n.recognitionStatusDraft;
      case 'in_preparation':
        return l10n.recognitionStatusInPreparation;
      case 'ready_for_submission':
        return l10n.recognitionStatusReadyForSubmission;
      case 'submitted':
        return l10n.recognitionStatusSubmitted;
      case 'under_review':
        return l10n.recognitionStatusUnderReview;
      case 'approved':
        return l10n.recognitionStatusApproved;
      case 'rejected':
        return l10n.recognitionStatusRejected;
      case 'needs_revision':
        return l10n.recognitionStatusNeedsRevision;
      default:
        return status ?? '—';
    }
  }

  static String reviewType(AppLocalizations l10n, String? type) {
    switch (type) {
      case 'scheduled':
        return l10n.reviewTypeScheduled;
      case 'periodic':
        return l10n.reviewTypePeriodic;
      case 'pre_closure':
        return l10n.reviewTypePreClosure;
      case 'special':
        return l10n.reviewTypeSpecial;
      default:
        return type ?? '—';
    }
  }

  /// Humanizes a raw snake_case backend enum for fields without dedicated
  /// translations (e.g. `risk_type`, `case_type`).
  static String humanizeSnakeCase(String? value) {
    if (value == null || value.isEmpty) return '—';
    return value
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1))
        .join(' ');
  }
}
