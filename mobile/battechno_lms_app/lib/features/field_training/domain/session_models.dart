import 'field_training_models.dart';

enum SessionTiming { upcoming, ongoing, past }

enum AttendanceStatus { present, absent, late, excused, pending }

class TrainingSessionItem {
  const TrainingSessionItem({required this.raw});

  final Map<String, dynamic> raw;

  String get id => raw['id']?.toString() ?? '';
  String get title => raw['title']?.toString() ?? '';
  String? get description => raw['description']?.toString();
  String? get sessionDate => raw['session_date']?.toString();
  String? get startTime => raw['start_time']?.toString();
  String? get endTime => raw['end_time']?.toString();
  String? get zoomLink => raw['zoom_link']?.toString();
  bool get isRequired => raw['is_required'] == true;

  Map<String, dynamic>? get attendance => JsonHelpers.map(raw['attendance']);

  AttendanceStatus get attendanceStatus {
    final status = attendance?['status']?.toString();
    switch (status) {
      case 'present':
        return AttendanceStatus.present;
      case 'absent':
        return AttendanceStatus.absent;
      case 'late':
        return AttendanceStatus.late;
      case 'excused':
        return AttendanceStatus.excused;
      default:
        return AttendanceStatus.pending;
    }
  }

  SessionTiming timing([DateTime? now]) {
    final current = now ?? DateTime.now();
    final date = sessionDate;
    if (date == null) return SessionTiming.upcoming;
    final parsedDate = DateTime.tryParse(date);
    if (parsedDate == null) return SessionTiming.upcoming;

    final start = _combineDateTime(parsedDate, startTime);
    final end = _combineDateTime(parsedDate, endTime);
    if (start != null && current.isBefore(start)) return SessionTiming.upcoming;
    if (end != null && current.isAfter(end)) return SessionTiming.past;
    if (start != null &&
        end != null &&
        !current.isBefore(start) &&
        !current.isAfter(end)) {
      return SessionTiming.ongoing;
    }
    final dayOnly = DateTime(parsedDate.year, parsedDate.month, parsedDate.day);
    final today = DateTime(current.year, current.month, current.day);
    if (dayOnly.isBefore(today)) return SessionTiming.past;
    if (dayOnly.isAfter(today)) return SessionTiming.upcoming;
    return SessionTiming.ongoing;
  }

  DateTime? _combineDateTime(DateTime date, String? time) {
    if (time == null || time.isEmpty) return date;
    final parts = time.split(':');
    if (parts.length < 2) return date;
    final hour = int.tryParse(parts[0]) ?? 0;
    final minute = int.tryParse(parts[1]) ?? 0;
    return DateTime(date.year, date.month, date.day, hour, minute);
  }
}

class SessionLabels {
  static String timingAr(SessionTiming timing) {
    switch (timing) {
      case SessionTiming.upcoming:
        return 'قادمة';
      case SessionTiming.ongoing:
        return 'جارية';
      case SessionTiming.past:
        return 'مكتملة';
    }
  }

  static String attendanceAr(AttendanceStatus status) {
    switch (status) {
      case AttendanceStatus.present:
        return 'حضرت';
      case AttendanceStatus.absent:
        return 'غائب';
      case AttendanceStatus.late:
        return 'متأخر';
      case AttendanceStatus.excused:
        return 'غياب بعذر';
      case AttendanceStatus.pending:
        return 'لم يسجل الحضور بعد';
    }
  }

  static bool isSafeExternalUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final uri = Uri.tryParse(url.trim());
    if (uri == null || !uri.hasScheme) return false;
    return uri.scheme == 'http' || uri.scheme == 'https';
  }
}
