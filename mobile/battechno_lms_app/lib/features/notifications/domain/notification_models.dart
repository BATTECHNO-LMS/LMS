class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.actionUrl,
  });

  final String id;
  final String title;
  final String body;
  final String type;
  final bool isRead;
  final String createdAt;
  final String? actionUrl;

  factory AppNotification.fromMap(Map<String, dynamic> map) {
    return AppNotification(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      body: map['body']?.toString() ?? '',
      type: map['type']?.toString() ?? 'info',
      isRead: map['is_read'] == true,
      createdAt: map['created_at']?.toString() ?? '',
      actionUrl: map['action_url']?.toString(),
    );
  }
}

class NotificationPage {
  const NotificationPage({
    required this.notifications,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final List<AppNotification> notifications;
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  int get unreadCount => notifications.where((n) => !n.isRead).length;
}

class NotificationLabels {
  static String typeLabelAr(String? type) {
    switch (type) {
      case 'action_required':
        return 'إجراء مطلوب';
      case 'success':
        return 'إشعار ناجح';
      case 'warning':
        return 'تنبيه';
      case 'danger':
        return 'تنبيه مهم';
      case 'system':
        return 'إشعار النظام';
      case 'user_pending_activation':
        return 'تفعيل الحساب';
      default:
        return 'إشعار';
    }
  }
}

/// Maps web-style action URLs to mobile go_router paths.
class NotificationNavigator {
  static String? mobileRouteFromActionUrl(String? actionUrl) {
    if (actionUrl == null || actionUrl.isEmpty) return null;
    final uri = Uri.tryParse(
      actionUrl.startsWith('/') ? actionUrl : '/$actionUrl',
    );
    if (uri == null) return null;

    final segments = uri.pathSegments;
    if (segments.length >= 3 &&
        segments[0] == 'student' &&
        segments[1] == 'field-training') {
      final id = segments[2];
      final tab = uri.queryParameters['tab'];
      switch (tab) {
        case 'tasks':
          return '/student/field-training/$id';
        case 'assessments':
          return '/student/field-training/$id/assessments';
        case 'sessions':
        case 'attendance':
          return '/student/field-training/$id/sessions';
        case 'completion':
          return '/student/certificates';
        default:
          return '/student/field-training/$id';
      }
    }

    if (segments.length >= 3 &&
        segments[0] == 'instructor' &&
        segments[1] == 'field-training') {
      final id = segments[2];
      if (segments.length >= 4) {
        final leaf = segments[3];
        switch (leaf) {
          case 'tasks':
          case 'submissions':
            return '/instructor/field-training/$id/submissions';
          case 'participants':
          case 'students':
            return '/instructor/field-training/$id/participants';
          case 'sessions':
          case 'attendance':
            return '/instructor/field-training/$id/sessions';
          case 'results':
          case 'assessments':
            return '/instructor/field-training/$id/assessments';
          case 'manage':
            return '/instructor/field-training/$id';
        }
      }
      final tab = uri.queryParameters['tab'];
      switch (tab) {
        case 'tasks':
        case 'submissions':
          return '/instructor/field-training/$id/submissions';
        case 'participants':
          return '/instructor/field-training/$id/participants';
        case 'sessions':
        case 'attendance':
          return '/instructor/field-training/$id/sessions';
        case 'results':
          return '/instructor/field-training/$id/assessments';
        default:
          return '/instructor/field-training/$id';
      }
    }

    if (segments.length >= 3 &&
        segments[0] == 'admin' &&
        segments[1] == 'field-training') {
      final id = segments[2];
      if (segments.length >= 4) {
        final leaf = segments[3];
        switch (leaf) {
          case 'applications':
            return '/admin/field-training/$id/applications';
          case 'sessions':
          case 'attendance':
            return '/admin/field-training/$id/sessions';
          case 'submissions':
          case 'tasks':
            return '/admin/field-training/$id/submissions';
          case 'results':
          case 'assessments':
            return '/admin/field-training/$id/assessments';
          case 'manage':
            return '/admin/field-training/$id';
        }
      }
      final tab = uri.queryParameters['tab'];
      switch (tab) {
        case 'applications':
          return '/admin/field-training/$id/applications';
        case 'sessions':
        case 'attendance':
          return '/admin/field-training/$id/sessions';
        case 'submissions':
        case 'tasks':
          return '/admin/field-training/$id/submissions';
        case 'results':
          return '/admin/field-training/$id/assessments';
        default:
          return '/admin/field-training/$id';
      }
    }

    if (segments.length >= 3 &&
        segments[0] == 'admin' &&
        segments[1] == 'applications') {
      return '/admin/applications/${segments[2]}';
    }

    // —— Phase 23 (`qa_officer` / `university_reviewer`) — action URLs may
    // arrive either bare (`/qa-reviews/:id`) or admin-prefixed
    // (`/admin/qa-reviews/:id`); both map to the same mobile QA routes.
    final qaIndex = segments.indexOf('qa-reviews');
    if (qaIndex != -1 && segments.length > qaIndex + 1) {
      return '/qa/reviews/${segments[qaIndex + 1]}';
    }
    if (qaIndex != -1 && segments.length == qaIndex + 1) {
      return '/qa/reviews';
    }

    final correctiveIndex = segments.indexOf('corrective-actions');
    if (correctiveIndex != -1 && segments.length > correctiveIndex + 1) {
      return '/qa/corrective/${segments[correctiveIndex + 1]}';
    }

    final riskIndex = segments.indexOf('risk-cases');
    if (riskIndex != -1 && segments.length > riskIndex + 1) {
      return '/qa/risk/${segments[riskIndex + 1]}';
    }

    final integrityIndex = segments.indexOf('integrity-cases');
    if (integrityIndex != -1 && segments.length > integrityIndex + 1) {
      return '/qa/integrity/${segments[integrityIndex + 1]}';
    }

    final recognitionIndex = segments.indexOf('recognition-requests');
    if (recognitionIndex != -1) {
      if (segments.length > recognitionIndex + 1 &&
          segments[recognitionIndex + 1] != 'create' &&
          segments[recognitionIndex + 1] != 'edit') {
        return '/reviewer/recognition/${segments[recognitionIndex + 1]}';
      }
      return '/reviewer/recognition';
    }

    if (segments.any((s) => s == 'enrollments' || s == 'enrollment-requests')) {
      return '/reviewer/enrollments';
    }

    if (segments.length >= 2 &&
        segments[0] == 'academic' &&
        segments[1] == 'field-training') {
      if (segments.length >= 4 &&
          segments[2] == 'reports' &&
          segments[3] == 'student' &&
          segments.length >= 5) {
        return '/reviewer/students/${segments[4]}';
      }
      if (segments.length >= 3 && segments[2] == 'students') {
        return '/reviewer/students';
      }
      return '/reviewer/reports';
    }

    // —— Phase 24 (`super_admin`) ——
    if (segments.length >= 2 && segments[0] == 'users') {
      return '/super/users/${segments[1]}';
    }
    if (segments.length >= 2 && segments[0] == 'universities') {
      return '/super/universities/${segments[1]}';
    }
    if (segments.isNotEmpty && segments.first == 'audit-logs') {
      return '/super/audit';
    }
    if (segments.isNotEmpty &&
        (segments.first == 'health' || segments.first == 'system-status')) {
      return '/super/system-status';
    }

    if (segments.isNotEmpty && segments.first == 'student') {
      return null;
    }
    return null;
  }
}
