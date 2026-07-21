// Domain helpers for university/academic admin field-training (API-aligned).

import '../../../core/auth/lms_roles.dart';

enum AdminOpportunitySection { draft, published, inProgress, archived, other }

class AdminOpportunity {
  const AdminOpportunity(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get title => raw['title']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String get trainingMode => raw['training_mode']?.toString() ?? '';
  String? get startDate => raw['start_date']?.toString();
  String? get endDate => raw['end_date']?.toString();
  String? get location => raw['location']?.toString();
  String? get shortDescription => raw['short_description']?.toString();
  String? get description => raw['description']?.toString();
  int get participantsCount => _asInt(raw['participants_count']);
  int get sessionsCount => _asInt(raw['sessions_count']);
  int get pendingSubmissionsCount => _asInt(raw['pending_submissions_count']);
  int get atRiskCount => _asInt(raw['at_risk_count']);
  int get activeEligibilityCount => _asInt(raw['active_eligibility_count']);
  bool get needsEligibilitySetup => raw['needs_eligibility_setup'] == true;

  num? get requiredHours {
    final v =
        raw['required_training_hours'] ??
        raw['required_hours'] ??
        raw['requiredHours'];
    if (v is num) return v;
    return num.tryParse(v?.toString() ?? '');
  }

  String? get specialtyName {
    final s = raw['specialty'];
    if (s is Map) {
      return s['name_ar']?.toString() ??
          s['name']?.toString() ??
          s['name_en']?.toString();
    }
    return raw['specialty_name']?.toString();
  }

  String? get specialtyId => raw['specialty_id']?.toString();

  Map<String, dynamic>? get assignedInstructor {
    final v = raw['assigned_instructor'];
    return v is Map<String, dynamic> ? v : null;
  }

  String? get instructorName => assignedInstructor?['full_name']?.toString();
  String? get assignedInstructorId =>
      raw['assigned_instructor_id']?.toString() ??
      assignedInstructor?['id']?.toString();

  AdminOpportunitySection get section {
    switch (status) {
      case 'draft':
        return AdminOpportunitySection.draft;
      case 'published':
        return AdminOpportunitySection.published;
      case 'in_progress':
        return AdminOpportunitySection.inProgress;
      case 'archived':
        return AdminOpportunitySection.archived;
      default:
        return AdminOpportunitySection.other;
    }
  }

  static int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }
}

class AdminOpportunityListData {
  const AdminOpportunityListData({
    required this.opportunities,
    this.fromCache = false,
    this.cachedAt,
    this.meta,
  });

  final List<AdminOpportunity> opportunities;
  final bool fromCache;
  final DateTime? cachedAt;
  final Map<String, dynamic>? meta;

  List<AdminOpportunity> forSection(AdminOpportunitySection section) =>
      opportunities.where((o) => o.section == section).toList();

  int get totalPendingSubmissions =>
      opportunities.fold(0, (sum, o) => sum + o.pendingSubmissionsCount);

  int get totalParticipants =>
      opportunities.fold(0, (sum, o) => sum + o.participantsCount);
}

/// FT aggregate stats (`/admin/field-training/stats`).
class AdminFieldTrainingStats {
  const AdminFieldTrainingStats(this.raw);

  final Map<String, dynamic> raw;

  int get totalOpportunities => _asInt(raw['totalOpportunities']);
  int get publishedOpportunities => _asInt(raw['publishedOpportunities']);
  int get draftOpportunities => _asInt(raw['draftOpportunities']);
  int get archivedOpportunities => _asInt(raw['archivedOpportunities']);
  int get totalApplications => _asInt(raw['totalApplications']);
  int get pendingApplications => _asInt(raw['pendingApplications']);
  int get approvedApplications => _asInt(raw['approvedApplications']);
  int get rejectedApplications => _asInt(raw['rejectedApplications']);
  int get totalSubmissions => _asInt(raw['totalSubmissions']);

  static int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }
}

/// `/dashboard/admin-stats` — `university_admin` only.
class AdminDashboardStats {
  const AdminDashboardStats(this.raw);

  final Map<String, dynamic> raw;

  int get users => _asInt(raw['users']);
  int get universities => _asInt(raw['universities']);
  int get cohorts => _asInt(raw['cohorts']);
  int get assessments => _asInt(raw['assessments']);
  int get pendingEnrollments => _asInt(raw['pending_enrollments']);

  static int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }
}

class AdminDashboardData {
  const AdminDashboardData({
    required this.list,
    this.ftStats,
    this.dashboardStats,
    this.pendingUsersCount,
    this.fromCache = false,
    this.cachedAt,
  });

  final AdminOpportunityListData list;
  final AdminFieldTrainingStats? ftStats;
  final AdminDashboardStats? dashboardStats;
  final int? pendingUsersCount;
  final bool fromCache;
  final DateTime? cachedAt;

  AdminPriorityAction? get priorityAction {
    final withPending = list.opportunities
        .where((o) => o.pendingSubmissionsCount > 0)
        .toList();
    if (withPending.isNotEmpty) {
      withPending.sort(
        (a, b) =>
            b.pendingSubmissionsCount.compareTo(a.pendingSubmissionsCount),
      );
      final top = withPending.first;
      return AdminPriorityAction(
        type: AdminPriorityType.reviewSubmissions,
        opportunityId: top.id,
        count: top.pendingSubmissionsCount,
        title: top.title,
      );
    }
    final pendingApps = ftStats?.pendingApplications ?? 0;
    if (pendingApps > 0 && list.opportunities.isNotEmpty) {
      return AdminPriorityAction(
        type: AdminPriorityType.reviewApplications,
        opportunityId: list.opportunities.first.id,
        count: pendingApps,
        title: list.opportunities.first.title,
      );
    }
    final needingSetup = list.opportunities
        .where((o) => o.needsEligibilitySetup && o.status == 'draft')
        .toList();
    if (needingSetup.isNotEmpty) {
      return AdminPriorityAction(
        type: AdminPriorityType.completeSetup,
        opportunityId: needingSetup.first.id,
        title: needingSetup.first.title,
      );
    }
    return null;
  }
}

enum AdminPriorityType { reviewSubmissions, reviewApplications, completeSetup }

class AdminPriorityAction {
  const AdminPriorityAction({
    required this.type,
    required this.opportunityId,
    required this.title,
    this.count,
  });

  final AdminPriorityType type;
  final String opportunityId;
  final String title;
  final int? count;
}

class AdminLabels {
  static String statusAr(String? status) {
    switch (status) {
      case 'draft':
        return 'مسودة';
      case 'published':
        return 'منشورة';
      case 'in_progress':
        return 'قيد التنفيذ';
      case 'archived':
        return 'مؤرشفة';
      case 'pending':
        return 'قيد الانتظار';
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'cancelled':
        return 'ملغى';
      case 'needs_revision':
        return 'يحتاج تعديلاً';
      case 'not_submitted':
        return 'لم يُسلَّم بعد';
      default:
        return status ?? '—';
    }
  }

  static String sectionAr(AdminOpportunitySection section) {
    switch (section) {
      case AdminOpportunitySection.draft:
        return 'مسودة';
      case AdminOpportunitySection.published:
        return 'منشورة';
      case AdminOpportunitySection.inProgress:
        return 'قيد التنفيذ';
      case AdminOpportunitySection.archived:
        return 'مؤرشفة';
      case AdminOpportunitySection.other:
        return 'أخرى';
    }
  }

  static String modeAr(String? mode) {
    switch (mode) {
      case 'onsite':
        return 'حضوري';
      case 'remote':
        return 'عن بُعد';
      case 'hybrid':
        return 'هجين';
      default:
        return mode ?? '—';
    }
  }

  /// Positive integer or null (clears required hours target).
  static bool isValidRequiredHours(String value) {
    if (value.trim().isEmpty) return true;
    final n = int.tryParse(value.trim());
    return n != null && n > 0 && n <= 10000;
  }
}

/// Backend `FIELD_TRAINING_ADMIN`/`FIELD_TRAINING_MANAGE` grant
/// `university_admin`, `academic_admin`, and `super_admin` (global bypass)
/// full opportunity/application/hours access via `/admin/field-training/*`.
/// `ADMIN_READ` (dashboard + users) is `university_admin`/`super_admin`.
/// `program_admin` is fail-closed everywhere.
///
/// Phase 24: `super_admin` is included here so the existing admin
/// field-training screens (opportunities, applications, sessions, hours) work
/// unmodified when reached from the super_admin shell. Callers still gate
/// entry to that shell on `SuperAdminCapabilities.canAccess` (role AND
/// `isGlobal`); this class only decides per-action capability once inside.
abstract final class AdminCapabilities {
  static bool isFieldTrainingAdmin(String role) =>
      role == LmsRoles.universityAdmin ||
      role == LmsRoles.academicAdmin ||
      role == LmsRoles.superAdmin;

  static bool canReadUsers(String role) =>
      role == LmsRoles.universityAdmin || role == LmsRoles.superAdmin;

  static bool canReadAdminStats(String role) =>
      role == LmsRoles.universityAdmin || role == LmsRoles.superAdmin;

  static bool canManageOpportunities(String role) => isFieldTrainingAdmin(role);

  static bool canReviewApplications(String role) => isFieldTrainingAdmin(role);

  static bool canWriteHours(String role) => isFieldTrainingAdmin(role);
}
