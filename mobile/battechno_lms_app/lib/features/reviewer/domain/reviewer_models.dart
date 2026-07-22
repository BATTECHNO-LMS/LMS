// Domain helpers for qa_officer / university_reviewer (API-aligned, Phase 23).
//
// Backend contract summary (audited):
// - QA reviews / corrective actions: qa_officer only (QA_OVERSIGHT_ROLE_CODES).
// - Risk / integrity cases: qa_officer only among the two roles (RISK_INTEGRITY_ROLE_CODES).
// - Recognition requests (read + status decision): university_reviewer only.
// - Enrollment decisions (approve/reject): university_reviewer only.
// - Evidence (read-only): both roles.
// - Academic field-training reports/students: both roles.
// - Certificates: qa_officer scoped; university_reviewer service returns empty.
// - Neither role writes hours, attendance, sessions, or FT applications.

import '../../../core/auth/lms_roles.dart';

/// Capability matrix for the two Phase 23 roles, plus an optional Phase 24
/// `super_admin` (`isGlobal`) bypass. Every getter fails closed for any
/// other role (including `program_admin`), and the `super_admin` bypass only
/// applies when [isGlobal] is explicitly true — callers must pass the
/// backend-verified `AuthUser.isGlobal`, never infer it from the role alone.
class ReviewerCapabilities {
  const ReviewerCapabilities(this.role, {this.isGlobal = false});

  final String role;
  final bool isGlobal;

  bool get isQaOfficer => role == LmsRoles.qaOfficer;
  bool get isUniversityReviewer => role == LmsRoles.universityReviewer;

  /// `super_admin` global bypass — backend `QA_OVERSIGHT_ROLE_CODES` /
  /// `RISK_INTEGRITY_ROLE_CODES` / `RECOGNITION_*` / `ENROLLMENT_DECISION_*`
  /// all include `super_admin` explicitly (see `backend/src/config/env.js`).
  bool get _isSuperAdmin => role == LmsRoles.superAdmin && isGlobal;

  bool get canAccessQaReviews => isQaOfficer || _isSuperAdmin;
  bool get canWriteQaStatus => isQaOfficer || _isSuperAdmin;
  bool get canAccessRiskIntegrity => isQaOfficer || _isSuperAdmin;

  bool get canAccessRecognition => isUniversityReviewer || _isSuperAdmin;
  bool get canDecideRecognition => isUniversityReviewer || _isSuperAdmin;

  bool get canDecideEnrollment => isUniversityReviewer || _isSuperAdmin;

  bool get canReadEvidence =>
      isQaOfficer || isUniversityReviewer || _isSuperAdmin;
  bool get canReadFtReports =>
      isQaOfficer || isUniversityReviewer || _isSuperAdmin;

  /// Certificate list route exists for both, but the backend service only
  /// scopes results for `qa_officer`; `university_reviewer` receives an
  /// empty list. Kept for completeness/UI messaging, not for gating reads.
  bool get canReadCertificates => isQaOfficer || _isSuperAdmin;

  /// Always false — neither role ever writes training hours.
  bool get canWriteHours => false;

  /// Always false — neither role ever writes attendance/sessions.
  bool get canWriteAttendance => false;
}

int asInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '') ?? fallback;
}

int? asIntOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

// —— QA review ——

/// Backend `qa_reviews.status` flow (qaReviews.service.js `QA_STATUS_FLOW`).
const Map<String, List<String>> _qaStatusFlow = {
  'open': ['in_progress', 'resolved', 'closed'],
  'in_progress': ['open', 'resolved', 'closed'],
  'resolved': ['closed', 'in_progress'],
  'closed': [],
};

List<String> nextQaStatuses(String? current) =>
    List.unmodifiable(_qaStatusFlow[current] ?? const []);

class QaReviewItem {
  const QaReviewItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get cohortId => raw['cohort_id']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String get reviewType => raw['review_type']?.toString() ?? '';
  String? get reviewDate => raw['review_date']?.toString();
  String? get findings => raw['findings']?.toString();
  String? get actionRequired => raw['action_required']?.toString();

  String? get cohortTitle {
    final c = raw['cohort'];
    return c is Map ? c['title']?.toString() : null;
  }

  String? get reviewerName {
    final r = raw['reviewer'];
    return r is Map ? r['full_name']?.toString() : null;
  }

  bool get isOpen => status == 'open';
}

class ReviewQueuePage {
  const ReviewQueuePage({
    required this.items,
    this.meta,
    this.fromCache = false,
    this.cachedAt,
  });

  final List<Map<String, dynamic>> items;
  final Map<String, dynamic>? meta;
  final bool fromCache;
  final DateTime? cachedAt;

  int get total => asInt(meta?['total'], items.length);
  bool get isEmpty => items.isEmpty;
}

// —— Corrective action ——

const Map<String, List<String>> _correctiveStatusFlow = {
  'open': ['in_progress', 'resolved', 'closed', 'overdue'],
  'overdue': ['in_progress', 'resolved', 'closed', 'open'],
  'in_progress': ['open', 'resolved', 'closed', 'overdue'],
  'resolved': ['closed', 'in_progress'],
  'closed': [],
};

List<String> nextCorrectiveStatuses(String? current) =>
    List.unmodifiable(_correctiveStatusFlow[current] ?? const []);

class CorrectiveActionItem {
  const CorrectiveActionItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get qaReviewId => raw['qa_review_id']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String? get actionText => raw['action_text']?.toString();
  String? get dueDate => raw['due_date']?.toString();
  bool get isOverdue => status == 'overdue';

  String? get assigneeName {
    final a = raw['assignee'];
    return a is Map ? a['full_name']?.toString() : null;
  }
}

// —— Risk case ——

const Map<String, List<String>> _riskStatusFlow = {
  'open': ['in_progress', 'resolved', 'closed', 'escalated'],
  'in_progress': ['open', 'resolved', 'closed', 'escalated'],
  'escalated': ['open', 'in_progress', 'resolved', 'closed'],
  'resolved': ['closed', 'in_progress'],
  'closed': [],
};

List<String> nextRiskStatuses(String? current) =>
    List.unmodifiable(_riskStatusFlow[current] ?? const []);

class RiskCaseItem {
  const RiskCaseItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String get riskType => raw['risk_type']?.toString() ?? '';
  String get riskLevel => raw['risk_level']?.toString() ?? '';
  String? get actionPlan => raw['action_plan']?.toString();
  bool get isEscalated => status == 'escalated';

  String? get studentName {
    final s = raw['student'];
    return s is Map ? s['full_name']?.toString() : null;
  }
}

// —— Integrity case ——

const Map<String, List<String>> _integrityStatusFlow = {
  'reported': ['under_investigation', 'resolved', 'closed'],
  'under_investigation': ['reported', 'resolved', 'closed'],
  'resolved': ['closed', 'under_investigation'],
  'closed': [],
};

List<String> nextIntegrityStatuses(String? current) =>
    List.unmodifiable(_integrityStatusFlow[current] ?? const []);

class IntegrityCaseItem {
  const IntegrityCaseItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String get caseType => raw['case_type']?.toString() ?? '';
  String? get evidenceNotes => raw['evidence_notes']?.toString();
  String? get decision => raw['decision']?.toString();

  String? get studentName {
    final s = raw['student'];
    return s is Map ? s['full_name']?.toString() : null;
  }
}

// —— Recognition request ——

/// Backend `recognition_requests.status` flow (recognitionRequests.service.js
/// `STATUS_FLOW`). `university_reviewer` may only PATCH from `submitted` or
/// `under_review` in practice (create/update stay staff-only), but the full
/// map is kept so the helper matches the backend exactly.
const Map<String, List<String>> _recognitionStatusFlow = {
  'draft': ['in_preparation'],
  'in_preparation': ['draft', 'ready_for_submission'],
  'ready_for_submission': ['in_preparation', 'submitted'],
  'submitted': ['under_review', 'needs_revision'],
  'under_review': ['approved', 'rejected', 'needs_revision'],
  'approved': [],
  'rejected': [],
  'needs_revision': ['in_preparation', 'ready_for_submission'],
};

List<String> nextRecognitionStatuses(String? current) =>
    List.unmodifiable(_recognitionStatusFlow[current] ?? const []);

/// Reviewer decision-relevant subset (statuses a reviewer can act on).
const Set<String> reviewerActionableRecognitionStatuses = {
  'submitted',
  'under_review',
};

class RecognitionRequestItem {
  const RecognitionRequestItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String? get decisionNotes => raw['decision_notes']?.toString();
  String? get submittedAt => raw['submitted_at']?.toString();
  String? get reviewedAt => raw['reviewed_at']?.toString();

  String? get universityName {
    final u = raw['university'];
    return u is Map ? u['name']?.toString() : null;
  }

  String? get microCredentialTitle {
    final m = raw['micro_credential'];
    return m is Map ? m['title']?.toString() : null;
  }

  String? get cohortTitle {
    final c = raw['cohort'];
    return c is Map ? c['title']?.toString() : null;
  }

  bool get isActionable =>
      reviewerActionableRecognitionStatuses.contains(status);
}

class RecognitionDocumentItem {
  const RecognitionDocumentItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get documentType => raw['document_type']?.toString() ?? '';
  String? get title => raw['title']?.toString();
  String? get fileUrl => raw['file_url']?.toString();
}

// —— Pending enrollment ——

class PendingEnrollmentItem {
  const PendingEnrollmentItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get status => raw['enrollment_status']?.toString() ?? '';

  String? get studentName {
    final s = raw['student'];
    return s is Map ? s['full_name']?.toString() : null;
  }

  String? get studentEmail {
    final s = raw['student'];
    return s is Map ? s['email']?.toString() : null;
  }

  String? get cohortTitle {
    final c = raw['cohort'];
    return c is Map ? c['title']?.toString() : null;
  }

  String? get microCredentialTitle {
    final c = raw['cohort'];
    if (c is Map && c['micro_credential'] is Map) {
      return (c['micro_credential'] as Map)['title']?.toString();
    }
    return null;
  }
}

// —— Evidence ——

class EvidenceItem {
  const EvidenceItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get title => raw['title']?.toString() ?? '';
  String get evidenceType => raw['evidence_type']?.toString() ?? '';
  String? get fileUrl => raw['file_url']?.toString();

  String? get cohortTitle {
    final c = raw['cohort'];
    return c is Map ? c['title']?.toString() : null;
  }

  String? get studentName {
    final s = raw['student'];
    return s is Map ? s['full_name']?.toString() : null;
  }
}

// —— Dashboard aggregates ——

class ReviewerDashboardData {
  const ReviewerDashboardData({
    this.openQaReviewsCount = 0,
    this.openCorrectiveCount = 0,
    this.openRiskCount = 0,
    this.pendingRecognitionCount = 0,
    this.pendingEnrollmentsCount = 0,
    this.firstOpenQaReviewId,
    this.firstOpenQaReviewTitle,
    this.firstPendingRecognitionId,
    this.firstPendingRecognitionTitle,
    this.fromCache = false,
    this.cachedAt,
  });

  final int openQaReviewsCount;
  final int openCorrectiveCount;
  final int openRiskCount;
  final int pendingRecognitionCount;
  final int pendingEnrollmentsCount;
  final String? firstOpenQaReviewId;
  final String? firstOpenQaReviewTitle;
  final String? firstPendingRecognitionId;
  final String? firstPendingRecognitionTitle;
  final bool fromCache;
  final DateTime? cachedAt;

  /// QA priority: first open QA review needing action, else null.
  ReviewerPriorityAction? get qaPriorityAction {
    if (firstOpenQaReviewId == null) return null;
    return ReviewerPriorityAction(
      type: ReviewerPriorityType.openQaReview,
      targetId: firstOpenQaReviewId!,
      title: firstOpenQaReviewTitle ?? '',
      count: openQaReviewsCount,
    );
  }

  /// Reviewer priority: pending recognition first, else pending enrollments.
  ReviewerPriorityAction? get reviewerPriorityAction {
    if (firstPendingRecognitionId != null) {
      return ReviewerPriorityAction(
        type: ReviewerPriorityType.decideRecognition,
        targetId: firstPendingRecognitionId!,
        title: firstPendingRecognitionTitle ?? '',
        count: pendingRecognitionCount,
      );
    }
    if (pendingEnrollmentsCount > 0) {
      return const ReviewerPriorityAction(
        type: ReviewerPriorityType.decideEnrollment,
        targetId: '',
        title: '',
      );
    }
    return null;
  }
}

enum ReviewerPriorityType { openQaReview, decideRecognition, decideEnrollment }

class ReviewerPriorityAction {
  const ReviewerPriorityAction({
    required this.type,
    required this.targetId,
    required this.title,
    this.count,
  });

  final ReviewerPriorityType type;
  final String targetId;
  final String title;
  final int? count;
}

/// Raw backend enum value lists for each domain's status filter — the UI
/// resolves display labels through `AppLocalizations` via `ReviewerLabels`
/// (see `reviewer_labels.dart`); this class only lists the valid raw values.
abstract final class ReviewerStatusOptions {
  static const qaStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  static const correctiveStatuses = [
    'open',
    'in_progress',
    'resolved',
    'closed',
    'overdue',
  ];
  static const riskStatuses = [
    'open',
    'in_progress',
    'resolved',
    'closed',
    'escalated',
  ];
  static const integrityStatuses = [
    'reported',
    'under_investigation',
    'resolved',
    'closed',
  ];
  static const recognitionStatuses = [
    'draft',
    'in_preparation',
    'ready_for_submission',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'needs_revision',
  ];
  static const reviewTypes = [
    'scheduled',
    'periodic',
    'pre_closure',
    'special',
  ];
}
