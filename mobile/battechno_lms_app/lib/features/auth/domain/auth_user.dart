import '../../../core/auth/lms_roles.dart';

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.status,
    required this.roles,
    required this.primaryRole,
    required this.permissions,
    required this.isGlobal,
    this.phone,
    this.universityId,
    this.universityName,
    this.specialtyNameAr,
    this.specialtyNameEn,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList();
    final specialty = json['specialty'] ?? json['university_specialty'];
    String? specialtyAr;
    String? specialtyEn;
    if (specialty is Map<String, dynamic>) {
      specialtyAr = specialty['name_ar']?.toString();
      specialtyEn = specialty['name_en']?.toString();
    }
    final university = json['university'] ?? json['primary_university'];
    String? universityName;
    String? universityId;
    if (university is Map<String, dynamic>) {
      universityName = university['name']?.toString();
      universityId = university['id']?.toString();
    }
    universityId ??= json['primary_university_id']?.toString();

    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? '',
      status: json['status']?.toString() ?? 'inactive',
      roles: roles,
      primaryRole: LmsRoles.pickPrimaryRole(roles) ?? '',
      permissions: (json['permissions'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
      isGlobal: json['isGlobal'] == true,
      phone: json['phone']?.toString(),
      universityId: universityId,
      universityName: universityName,
      specialtyNameAr: specialtyAr,
      specialtyNameEn: specialtyEn,
    );
  }

  final String id;
  final String email;
  final String fullName;
  final String status;
  final List<String> roles;
  final String primaryRole;
  final List<String> permissions;
  final bool isGlobal;
  final String? phone;
  final String? universityId;
  final String? universityName;
  final String? specialtyNameAr;
  final String? specialtyNameEn;

  bool get isActive => status == 'active';
  bool get isSupported => LmsRoles.isSupported(roles);
  bool get hasProgramAdmin => roles.contains(LmsRoles.programAdmin);

  String specialtyLabel({required bool isArabic}) {
    if (isArabic && (specialtyNameAr?.isNotEmpty ?? false)) {
      return specialtyNameAr!;
    }
    if (specialtyNameEn?.isNotEmpty ?? false) return specialtyNameEn!;
    return specialtyNameAr ?? '';
  }
}
