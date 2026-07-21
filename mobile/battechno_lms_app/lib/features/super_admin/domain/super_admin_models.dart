// Domain helpers for `super_admin` (Phase 24, API-aligned).
//
// Security model (must not regress):
// - The backend is the sole source of truth for `role` and `isGlobal`
//   (`GET /auth/me` → `AuthUser.primaryRole` / `AuthUser.isGlobal`).
// - EVERY super_admin UI surface must be gated on
//   `SuperAdminCapabilities.canAccess(user)`, i.e.
//   `role == super_admin AND isGlobal == true`. A user whose role claims
//   `super_admin` but whose `isGlobal` is false (a corrupted/legacy token,
//   or a privilege that was revoked server-side) is treated as unsupported
//   and must fail closed — never shown any super_admin screen or action.
// - `program_admin` is fail-closed everywhere and is never an assignable
//   role from this app.
// - IDENTITY-001: assigning or removing the `super_admin` role itself is
//   enforced server-side (`superAdminPrivilegeBoundary.js`); this app only
//   adds a strong client-side confirmation step before submitting such a
//   change — it must never be the only guard.

import '../../../core/auth/lms_roles.dart';
import '../../auth/domain/auth_user.dart';

abstract final class SuperAdminCapabilities {
  /// The single gate for the entire super_admin shell/feature module.
  /// True only if the backend-verified role is `super_admin` AND the
  /// backend-verified `isGlobal` flag is true.
  static bool canAccess(AuthUser user) =>
      user.primaryRole == LmsRoles.superAdmin && user.isGlobal;

  static bool canWriteUsers(AuthUser user) => canAccess(user);
  static bool canWriteUniversities(AuthUser user) => canAccess(user);
  static bool canManageFieldTraining(AuthUser user) => canAccess(user);
  static bool canReadAuditLogs(AuthUser user) => canAccess(user);
  static bool canReadGlobalReports(AuthUser user) => canAccess(user);
  static bool canReadSystemStatus(AuthUser user) => canAccess(user);

  /// Roles this app will ever let a super_admin assign to another user.
  ///
  /// - `program_admin` is NEVER included (deprecated / fail-closed).
  /// - `super_admin` IS included so a global super_admin can grant/revoke
  ///   super_admin membership for another account, but the UI must show a
  ///   strong confirmation step (see `SuperAdminUserDetailScreen`) before
  ///   submitting any change that adds or removes it — the backend
  ///   (`assertSuperAdminRoleMutationAllowed`) is the actual enforcement.
  static const List<String> assignableRoles = [
    LmsRoles.superAdmin,
    LmsRoles.universityAdmin,
    LmsRoles.academicAdmin,
    LmsRoles.qaOfficer,
    LmsRoles.instructor,
    LmsRoles.student,
    LmsRoles.universityReviewer,
  ];

  static bool isRoleAssignable(String roleCode) =>
      assignableRoles.contains(roleCode);
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

/// `GET /dashboard/admin-stats` (system-wide totals when requested by a
/// global `super_admin` — the backend does not scope this query by
/// university for `isGlobal` requesters).
class SuperAdminStats {
  const SuperAdminStats(this.raw);

  final Map<String, dynamic> raw;

  int get users => asInt(raw['users']);
  int get universities => asInt(raw['universities']);
  int get cohorts => asInt(raw['cohorts']);
  int get assessments => asInt(raw['assessments']);
  int get pendingEnrollments => asInt(raw['pending_enrollments']);
}

enum UniversityStatus { active, inactive, archived }

UniversityStatus? universityStatusFromCode(String? code) {
  switch (code) {
    case 'active':
      return UniversityStatus.active;
    case 'inactive':
      return UniversityStatus.inactive;
    case 'archived':
      return UniversityStatus.archived;
    default:
      return null;
  }
}

class UniversityItem {
  const UniversityItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get name => raw['name']?.toString() ?? '';
  String? get type => raw['type']?.toString();
  String get status => raw['status']?.toString() ?? '';
  String? get partnershipState => raw['partnership_state']?.toString();
  String? get contactPerson => raw['contact_person']?.toString();
  String? get contactEmail => raw['contact_email']?.toString();
  String? get contactPhone => raw['contact_phone']?.toString();
  String? get notes => raw['notes']?.toString();
  int? get linkedUsersCount => asIntOrNull(raw['linked_users_count']);
  int? get linkedMicroCredentialsCount =>
      asIntOrNull(raw['linked_micro_credentials_count']);
}

class UserItem {
  const UserItem(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get fullName => raw['full_name']?.toString() ?? '';
  String get email => raw['email']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String? get phone => raw['phone']?.toString();
  bool get emailVerified => raw['email_verified_at'] != null;
  String? get primaryUniversityId => raw['primary_university_id']?.toString();

  String? get universityName {
    final uni = raw['primary_university'] ?? raw['university'];
    return uni is Map ? uni['name']?.toString() : null;
  }

  List<String> get roleCodes {
    final roles = raw['roles'];
    if (roles is List) {
      return roles
          .map((r) => r is Map ? r['code']?.toString() : r?.toString())
          .whereType<String>()
          .toList();
    }
    return const [];
  }

  bool get isSuperAdmin => roleCodes.contains(LmsRoles.superAdmin);
}

abstract final class SuperAdminLabels {
  static String universityStatusAr(String? status) {
    switch (status) {
      case 'active':
        return 'نشطة';
      case 'inactive':
        return 'غير نشطة';
      case 'archived':
        return 'مؤرشفة';
      default:
        return status ?? '—';
    }
  }

  static String userStatusAr(String? status) {
    switch (status) {
      case 'active':
        return 'نشط';
      case 'inactive':
        return 'غير نشط';
      case 'suspended':
        return 'موقوف';
      default:
        return status ?? '—';
    }
  }

  static String roleAr(String? code) {
    switch (code) {
      case LmsRoles.superAdmin:
        return 'مشرف عام';
      case LmsRoles.universityAdmin:
        return 'مدير جامعة';
      case LmsRoles.academicAdmin:
        return 'مدير أكاديمي';
      case LmsRoles.qaOfficer:
        return 'مسؤول جودة';
      case LmsRoles.instructor:
        return 'مدرب';
      case LmsRoles.student:
        return 'طالب';
      case LmsRoles.universityReviewer:
        return 'مراجع الجامعة';
      case LmsRoles.programAdmin:
        return 'مدير برنامج (غير مدعوم)';
      default:
        return code ?? '—';
    }
  }
}
