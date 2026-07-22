/// Active LMS roles supported by the mobile app.
abstract final class LmsRoles {
  static const superAdmin = 'super_admin';
  static const universityAdmin = 'university_admin';
  static const academicAdmin = 'academic_admin';
  static const qaOfficer = 'qa_officer';
  static const instructor = 'instructor';
  static const student = 'student';
  static const universityReviewer = 'university_reviewer';

  /// Deprecated — fail closed in mobile shell.
  static const programAdmin = 'program_admin';

  static const activeRoles = {
    superAdmin,
    universityAdmin,
    academicAdmin,
    qaOfficer,
    instructor,
    student,
    universityReviewer,
  };

  static const adminPriority = [
    superAdmin,
    universityAdmin,
    academicAdmin,
    qaOfficer,
    universityReviewer,
    instructor,
    student,
  ];

  static String? pickPrimaryRole(List<String> roles) {
    for (final code in adminPriority) {
      if (roles.contains(code)) return code;
    }
    return roles.isNotEmpty ? roles.first : null;
  }

  static bool isSupported(List<String> roles) {
    if (roles.contains(programAdmin)) return false;
    return roles.any(activeRoles.contains);
  }
}
