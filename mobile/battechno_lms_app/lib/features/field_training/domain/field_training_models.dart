/// Safe JSON field readers for nullable backend payloads.
class JsonHelpers {
  static String? string(Map<String, dynamic>? map, List<String> keys) {
    if (map == null) return null;
    for (final key in keys) {
      final value = map[key];
      if (value != null && value.toString().isNotEmpty) return value.toString();
    }
    return null;
  }

  static int? integer(Map<String, dynamic>? map, List<String> keys) {
    if (map == null) return null;
    for (final key in keys) {
      final value = map[key];
      if (value is num) return value.toInt();
      if (value is String) {
        final parsed = int.tryParse(value);
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  static double? percent(Map<String, dynamic>? map, List<String> keys) {
    if (map == null) return null;
    for (final key in keys) {
      final value = map[key];
      if (value is num) {
        final n = value.toDouble();
        return n > 1 ? n / 100 : n;
      }
    }
    return null;
  }

  static Map<String, dynamic>? map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    return null;
  }

  static List<Map<String, dynamic>> listOfMaps(
    dynamic value, {
    List<String> keys = const [],
  }) {
    if (value is List) {
      return value.whereType<Map<String, dynamic>>().toList();
    }
    if (value is Map<String, dynamic>) {
      for (final key in keys) {
        final nested = value[key];
        if (nested is List) {
          return nested.whereType<Map<String, dynamic>>().toList();
        }
      }
    }
    return const [];
  }
}

/// Maps backend review/training statuses to Arabic student-friendly labels.
class FieldTrainingLabels {
  static String trainingStatusAr(String? status) {
    switch (status) {
      case 'pending':
        return 'قيد المراجعة';
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'cancelled':
        return 'ملغى';
      case 'in_training':
        return 'جاري التدريب';
      case 'task_pending':
        return 'مهمة مطلوبة';
      case 'task_submitted':
        return 'تم تسليم المهمة';
      case 'completed':
        return 'مكتمل';
      case 'expelled':
        return 'مستبعد';
      default:
        return status?.isNotEmpty == true ? status! : 'غير محدد';
    }
  }

  static String reviewStatusAr(String? status) {
    switch (status) {
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'يحتاج تعديل';
      case 'pending':
        return 'بانتظار التقييم';
      default:
        return 'لم يُسلَّم بعد';
    }
  }
}

class TaskSubmissionValidator {
  static String? validate({
    required String? notes,
    required String? projectUrl,
    required bool requiresAi,
    required bool hasFile,
  }) {
    final url = projectUrl?.trim() ?? '';
    final text = notes?.trim() ?? '';
    if (requiresAi) {
      return 'هذه المهمة تتطلب التقييم الذاتي بالذكاء الاصطناعي. أكملها من منصة الويب حاليًا.';
    }
    if (url.isEmpty && !hasFile) {
      return 'أدخل رابط المشروع أو أرفق ملف الحل.';
    }
    if (url.isNotEmpty &&
        !RegExp(r'^https?://', caseSensitive: false).hasMatch(url)) {
      return 'الرابط يجب أن يبدأ بـ http:// أو https://';
    }
    if (url.isEmpty && text.isEmpty && !hasFile) {
      return 'لا يمكن إرسال تسليم فارغ.';
    }
    return null;
  }
}
