// Domain helpers for instructor field-training (API-aligned).

enum InstructorTrainingSection { active, upcoming, completed, other }

enum AttendanceStatus {
  present,
  absent,
  late,
  excused,
  unrecorded;

  static AttendanceStatus fromApi(String? value) {
    switch (value) {
      case 'present':
        return AttendanceStatus.present;
      case 'absent':
        return AttendanceStatus.absent;
      case 'late':
        return AttendanceStatus.late;
      case 'excused':
        return AttendanceStatus.excused;
      default:
        return AttendanceStatus.unrecorded;
    }
  }

  String? get apiValue {
    switch (this) {
      case AttendanceStatus.present:
        return 'present';
      case AttendanceStatus.absent:
        return 'absent';
      case AttendanceStatus.late:
        return 'late';
      case AttendanceStatus.excused:
        return 'excused';
      case AttendanceStatus.unrecorded:
        return null;
    }
  }

  bool get isRecorded => this != AttendanceStatus.unrecorded;
}

enum SubmissionReviewStatus {
  approved,
  rejected,
  needsRevision,
  pending;

  static SubmissionReviewStatus fromApi(String? value) {
    switch (value) {
      case 'approved':
        return SubmissionReviewStatus.approved;
      case 'rejected':
        return SubmissionReviewStatus.rejected;
      case 'needs_revision':
        return SubmissionReviewStatus.needsRevision;
      default:
        return SubmissionReviewStatus.pending;
    }
  }

  String get apiValue {
    switch (this) {
      case SubmissionReviewStatus.approved:
        return 'approved';
      case SubmissionReviewStatus.rejected:
        return 'rejected';
      case SubmissionReviewStatus.needsRevision:
        return 'needs_revision';
      case SubmissionReviewStatus.pending:
        return 'pending';
    }
  }
}

class InstructorOpportunity {
  const InstructorOpportunity(this.raw);

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get title => raw['title']?.toString() ?? '';
  String get status => raw['status']?.toString() ?? '';
  String get trainingMode => raw['training_mode']?.toString() ?? '';
  String? get startDate => raw['start_date']?.toString();
  String? get endDate => raw['end_date']?.toString();
  int get participantsCount => _asInt(raw['participants_count']);
  int get sessionsCount => _asInt(raw['sessions_count']);
  int get pendingSubmissionsCount => _asInt(raw['pending_submissions_count']);
  int get atRiskCount => _asInt(raw['at_risk_count']);
  double? get averageAttendance {
    final v = raw['average_attendance'];
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }

  num? get requiredHours {
    final v =
        raw['required_training_hours'] ??
        raw['required_hours'] ??
        raw['requiredHours'];
    if (v is num) return v;
    return num.tryParse(v?.toString() ?? '');
  }

  Map<String, dynamic>? get nextSession {
    final n = raw['next_session'];
    return n is Map<String, dynamic> ? n : null;
  }

  String? get universityName {
    final u = raw['university'] ?? raw['university_name'];
    if (u is Map) return u['name']?.toString() ?? u['name_ar']?.toString();
    return u?.toString();
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

  InstructorTrainingSection get section {
    switch (status) {
      case 'in_progress':
      case 'published':
        return InstructorTrainingSection.active;
      case 'draft':
        return InstructorTrainingSection.upcoming;
      case 'archived':
      case 'completed':
        return InstructorTrainingSection.completed;
      default:
        // Date-based fallback when status alone is ambiguous.
        final start = DateTime.tryParse(startDate ?? '');
        final end = DateTime.tryParse(endDate ?? '');
        final now = DateTime.now();
        if (start != null && start.isAfter(now)) {
          return InstructorTrainingSection.upcoming;
        }
        if (end != null && end.isBefore(now)) {
          return InstructorTrainingSection.completed;
        }
        return InstructorTrainingSection.other;
    }
  }

  static int _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }
}

class InstructorTrainingListData {
  const InstructorTrainingListData({
    required this.opportunities,
    this.fromCache = false,
    this.cachedAt,
    this.meta,
  });

  final List<InstructorOpportunity> opportunities;
  final bool fromCache;
  final DateTime? cachedAt;
  final Map<String, dynamic>? meta;

  List<InstructorOpportunity> forSection(InstructorTrainingSection section) =>
      opportunities.where((o) => o.section == section).toList();

  int get totalPendingSubmissions =>
      opportunities.fold(0, (sum, o) => sum + o.pendingSubmissionsCount);

  int get totalParticipants =>
      opportunities.fold(0, (sum, o) => sum + o.participantsCount);

  int get totalAtRisk => opportunities.fold(0, (sum, o) => sum + o.atRiskCount);

  InstructorOpportunity? get nextWithSession {
    for (final o in opportunities) {
      if (o.nextSession != null) return o;
    }
    return null;
  }
}

class InstructorDashboardData {
  const InstructorDashboardData({
    required this.list,
    this.stats,
    this.fromCache = false,
    this.cachedAt,
  });

  final InstructorTrainingListData list;
  final Map<String, dynamic>? stats;
  final bool fromCache;
  final DateTime? cachedAt;

  int get activeCount =>
      list.forSection(InstructorTrainingSection.active).length;

  InstructorPriorityAction? get priorityAction {
    final withPending = list.opportunities
        .where((o) => o.pendingSubmissionsCount > 0)
        .toList();
    if (withPending.isNotEmpty) {
      withPending.sort(
        (a, b) =>
            b.pendingSubmissionsCount.compareTo(a.pendingSubmissionsCount),
      );
      final top = withPending.first;
      return InstructorPriorityAction(
        type: InstructorPriorityType.reviewSubmissions,
        opportunityId: top.id,
        count: top.pendingSubmissionsCount,
        title: top.title,
      );
    }
    final next = list.nextWithSession;
    if (next != null) {
      return InstructorPriorityAction(
        type: InstructorPriorityType.upcomingSession,
        opportunityId: next.id,
        sessionId: next.nextSession?['id']?.toString(),
        title: next.title,
      );
    }
    if (list.totalAtRisk > 0) {
      final atRisk = list.opportunities.firstWhere((o) => o.atRiskCount > 0);
      return InstructorPriorityAction(
        type: InstructorPriorityType.followUpStudents,
        opportunityId: atRisk.id,
        count: atRisk.atRiskCount,
        title: atRisk.title,
      );
    }
    if (list.opportunities.isNotEmpty) {
      return InstructorPriorityAction(
        type: InstructorPriorityType.openTraining,
        opportunityId: list.opportunities.first.id,
        title: list.opportunities.first.title,
      );
    }
    return null;
  }
}

enum InstructorPriorityType {
  reviewSubmissions,
  upcomingSession,
  recordAttendance,
  followUpStudents,
  openTraining,
}

class InstructorPriorityAction {
  const InstructorPriorityAction({
    required this.type,
    required this.opportunityId,
    required this.title,
    this.sessionId,
    this.count,
  });

  final InstructorPriorityType type;
  final String opportunityId;
  final String title;
  final String? sessionId;
  final int? count;
}

class InstructorLabels {
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
      case 'completed':
        return 'مكتملة';
      default:
        return status ?? '—';
    }
  }

  static String sectionAr(InstructorTrainingSection section) {
    switch (section) {
      case InstructorTrainingSection.active:
        return 'نشطة';
      case InstructorTrainingSection.upcoming:
        return 'قادمة';
      case InstructorTrainingSection.completed:
        return 'مكتملة';
      case InstructorTrainingSection.other:
        return 'أخرى';
    }
  }

  static String attendanceAr(AttendanceStatus status) {
    switch (status) {
      case AttendanceStatus.present:
        return 'حاضر';
      case AttendanceStatus.absent:
        return 'غائب';
      case AttendanceStatus.late:
        return 'متأخر';
      case AttendanceStatus.excused:
        return 'غياب بعذر';
      case AttendanceStatus.unrecorded:
        return 'لم يسجل';
    }
  }

  static String reviewStatusAr(SubmissionReviewStatus status) {
    switch (status) {
      case SubmissionReviewStatus.approved:
        return 'معتمد';
      case SubmissionReviewStatus.rejected:
        return 'مرفوض';
      case SubmissionReviewStatus.needsRevision:
        return 'يحتاج تعديلاً';
      case SubmissionReviewStatus.pending:
        return 'بانتظار المراجعة';
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

  /// Validates session end time is after start (HH:MM).
  static bool isEndAfterStart(String start, String end) {
    final s = _minutes(start);
    final e = _minutes(end);
    if (s == null || e == null) return false;
    return e > s;
  }

  static int? _minutes(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return h * 60 + m;
  }

  static bool isSafeHttpsUrl(String? url) {
    if (url == null || url.trim().isEmpty) return true;
    final uri = Uri.tryParse(url.trim());
    if (uri == null) return false;
    return uri.scheme == 'https' || uri.scheme == 'http';
  }
}
