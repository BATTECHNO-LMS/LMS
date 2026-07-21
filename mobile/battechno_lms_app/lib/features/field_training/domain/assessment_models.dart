import 'field_training_models.dart';

/// Summary row from `GET /:id/assessments`.
class StudentAssessmentSummary {
  const StudentAssessmentSummary({
    required this.id,
    required this.type,
    required this.title,
    required this.status,
    required this.canTake,
    this.attempt,
    this.passingScore,
    this.questionCount,
  });

  final String id;
  final String type;
  final String title;
  final String status;
  final bool canTake;
  final Map<String, dynamic>? attempt;
  final int? passingScore;
  final int? questionCount;

  bool get isSubmitted => attempt?['submitted_at'] != null;
  int? get score => JsonHelpers.integer(attempt, ['score']);

  factory StudentAssessmentSummary.fromMap(Map<String, dynamic> map) {
    return StudentAssessmentSummary(
      id: map['id']?.toString() ?? '',
      type: map['type']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      status: map['status']?.toString() ?? '',
      canTake: map['can_take'] == true,
      attempt: JsonHelpers.map(map['attempt']),
      passingScore: JsonHelpers.integer(map, ['passing_score']),
      questionCount: JsonHelpers.integer(map, [
        'questions_count',
        'question_count',
      ]),
    );
  }
}

/// Full assessment payload from `GET /:id/assessments/:type`.
class AssessmentDetailBundle {
  const AssessmentDetailBundle({required this.assessment, this.attempt});

  final Map<String, dynamic> assessment;
  final Map<String, dynamic>? attempt;

  List<Map<String, dynamic>> get questions =>
      JsonHelpers.listOfMaps(assessment['questions']);

  bool get hasSubmittedAttempt => attempt?['submitted_at'] != null;
}

/// Submit response from `POST /:id/assessments/:type/submit`.
class AssessmentSubmitResult {
  const AssessmentSubmitResult({required this.attempt});

  final Map<String, dynamic> attempt;

  factory AssessmentSubmitResult.fromMap(Map<String, dynamic> data) {
    return AssessmentSubmitResult(
      attempt: JsonHelpers.map(data['attempt']) ?? data,
    );
  }
}

/// Availability helper derived from list + progress gating.
class AssessmentAvailability {
  const AssessmentAvailability({
    required this.summary,
    required this.isRequired,
    required this.isLocked,
    required this.primaryAction,
  });

  final StudentAssessmentSummary? summary;
  final bool isRequired;
  final bool isLocked;
  final AssessmentPrimaryAction primaryAction;
}

enum AssessmentPrimaryAction { start, viewResult, unavailable, notPublished }

enum AssessmentQuestionType {
  multipleChoice,
  multiSelect,
  trueFalse,
  shortText,
  longText,
  unsupported,
}

class AssessmentLabels {
  static String typeTitleAr(String? type) {
    switch (type) {
      case 'pre':
        return 'الاختبار القبلي';
      case 'post':
        return 'الاختبار البعدي';
      default:
        return 'الاختبار';
    }
  }

  static String knowledgeLevelAr(String? level) {
    switch (level) {
      case 'beginner':
        return 'مبتدئ';
      case 'intermediate':
        return 'متوسط';
      case 'advanced':
        return 'متقدم';
      default:
        return level?.isNotEmpty == true ? level! : '—';
    }
  }

  static AssessmentQuestionType parseQuestionType(String? raw) {
    switch (raw) {
      case 'multiple_choice':
        return AssessmentQuestionType.multipleChoice;
      case 'multi_select':
        return AssessmentQuestionType.multiSelect;
      case 'true_false':
        return AssessmentQuestionType.trueFalse;
      case 'short_text':
      case 'short_answer':
        return AssessmentQuestionType.shortText;
      case 'long_text':
        return AssessmentQuestionType.longText;
      default:
        return AssessmentQuestionType.unsupported;
    }
  }

  static AssessmentPrimaryAction resolveAction({
    required StudentAssessmentSummary? summary,
    required bool isRequired,
  }) {
    if (!isRequired) return AssessmentPrimaryAction.unavailable;
    if (summary == null) return AssessmentPrimaryAction.notPublished;
    if (summary.isSubmitted) return AssessmentPrimaryAction.viewResult;
    if (summary.canTake) return AssessmentPrimaryAction.start;
    return AssessmentPrimaryAction.unavailable;
  }
}

class AssessmentAnswerValidator {
  static String? validateRequired({
    required List<Map<String, dynamic>> questions,
    required Map<String, dynamic> answers,
  }) {
    for (final question in questions) {
      if (question['is_required'] == false) continue;
      final id = question['id']?.toString();
      if (id == null) continue;
      final value = answers[id];
      if (value == null) {
        return 'يرجى الإجابة على جميع الأسئلة الإلزامية.';
      }
      if (value is String && value.trim().isEmpty) {
        return 'يرجى الإجابة على جميع الأسئلة الإلزامية.';
      }
      if (value is List && value.isEmpty) {
        return 'يرجى الإجابة على جميع الأسئلة الإلزامية.';
      }
    }
    return null;
  }
}
