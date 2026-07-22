enum StudentTrainingSection { available, myApplications, current, completed }

class StudentTrainingLabels {
  static String sectionTitleAr(StudentTrainingSection section) {
    switch (section) {
      case StudentTrainingSection.available:
        return 'الفرص المتاحة';
      case StudentTrainingSection.myApplications:
        return 'طلباتي';
      case StudentTrainingSection.current:
        return 'التدريب الحالي';
      case StudentTrainingSection.completed:
        return 'المكتمل';
    }
  }

  static String applicationStatusAr(String? status) {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'cancelled':
        return 'ملغى';
      default:
        return 'لم يُقدَّم بعد';
    }
  }

  static bool canApply(Map<String, dynamic> opportunity) {
    final status = opportunity['my_application_status']?.toString();
    return status == null || status.isEmpty || status == 'cancelled';
  }

  static StudentTrainingSection? sectionForOpportunity(
    Map<String, dynamic> opportunity,
  ) {
    final appStatus = opportunity['my_application_status']?.toString();
    final trainingStatus =
        opportunity['my_training_status']?.toString() ??
        opportunity['training_status']?.toString();

    if (appStatus == null || appStatus.isEmpty || appStatus == 'cancelled') {
      return StudentTrainingSection.available;
    }
    if (appStatus == 'pending') return StudentTrainingSection.myApplications;
    if (appStatus == 'rejected') return StudentTrainingSection.myApplications;
    if (trainingStatus == 'completed' ||
        trainingStatus == 'eligible_for_completion') {
      return StudentTrainingSection.completed;
    }
    if (appStatus == 'approved') return StudentTrainingSection.current;
    return StudentTrainingSection.myApplications;
  }
}

class StudentTrainingListData {
  const StudentTrainingListData({
    required this.opportunities,
    required this.applications,
    this.profileIncomplete = false,
    this.message,
    this.fromCache = false,
    this.cachedAt,
  });

  final List<Map<String, dynamic>> opportunities;
  final List<Map<String, dynamic>> applications;
  final bool profileIncomplete;
  final String? message;
  final bool fromCache;
  final DateTime? cachedAt;

  List<Map<String, dynamic>> forSection(StudentTrainingSection section) {
    return opportunities
        .where((o) => StudentTrainingLabels.sectionForOpportunity(o) == section)
        .toList();
  }
}
