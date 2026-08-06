import '../../../core/api/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../field_training/domain/assessment_models.dart';
import '../../field_training/domain/field_training_models.dart';
import '../../field_training/domain/session_models.dart';

class StudentDashboardData {
  const StudentDashboardData({
    required this.applications,
    required this.opportunities,
    this.progress,
    this.tasks,
    this.assessments = const [],
    this.sessions = const [],
    this.activeOpportunityId,
    this.activeOpportunityTitle,
  });

  final List<Map<String, dynamic>> applications;
  final List<Map<String, dynamic>> opportunities;
  final Map<String, dynamic>? progress;
  final List<Map<String, dynamic>>? tasks;
  final List<StudentAssessmentSummary> assessments;
  final List<TrainingSessionItem> sessions;
  final String? activeOpportunityId;
  final String? activeOpportunityTitle;
}

class StudentDashboardRepository {
  StudentDashboardRepository(this._client);

  final ApiClient _client;

  Future<StudentDashboardData> load() async {
    final applicationsData = await _client.getJson(
      _client.endpoints.studentMyApplications,
    );
    final applications = _extractList(
      applicationsData,
      keys: ['applications', 'items'],
    );

    final opportunitiesData = await _client.getJson(
      _client.endpoints.studentFieldTraining,
      query: {'limit': 6},
    );
    final opportunities = _extractList(
      opportunitiesData,
      keys: ['opportunities', 'items', 'data'],
    );

    Map<String, dynamic>? progress;
    List<Map<String, dynamic>>? tasks;
    List<StudentAssessmentSummary> assessments = const [];
    List<TrainingSessionItem> sessions = const [];
    String? activeOpportunityId;
    String? activeOpportunityTitle;

    if (applications.isNotEmpty) {
      activeOpportunityId = _readId(applications.first);
      activeOpportunityTitle = applications.first['opportunity_title']
          ?.toString();
      if (activeOpportunityId != null) {
        try {
          final progressData = await _client.getJson(
            _client.endpoints.studentFieldTrainingProgress(activeOpportunityId),
          );
          progress = JsonHelpers.map(progressData['progress']);
        } on ApiException {
          progress = null;
        }
        try {
          final tasksData = await _client.getJson(
            _client.endpoints.studentFieldTrainingTasks(activeOpportunityId),
          );
          tasks = _extractList(tasksData, keys: ['tasks', 'items']);
        } on ApiException {
          tasks = null;
        }
        try {
          final assessmentsData = await _client.getJson(
            _client.endpoints.studentFieldTrainingAssessments(
              activeOpportunityId,
            ),
          );
          assessments = JsonHelpers.listOfMaps(
            assessmentsData,
            keys: ['assessments'],
          ).map(StudentAssessmentSummary.fromMap).toList();
        } on ApiException {
          assessments = const [];
        }
        try {
          final sessionsData = await _client.getJson(
            _client.endpoints.studentFieldTrainingSessions(activeOpportunityId),
          );
          sessions = JsonHelpers.listOfMaps(
            sessionsData,
            keys: ['sessions'],
          ).map((map) => TrainingSessionItem(raw: map)).toList();
        } on ApiException {
          sessions = const [];
        }
      }
    }

    return StudentDashboardData(
      applications: applications,
      opportunities: opportunities,
      progress: progress,
      tasks: tasks,
      assessments: assessments,
      sessions: sessions,
      activeOpportunityId: activeOpportunityId,
      activeOpportunityTitle: activeOpportunityTitle,
    );
  }

  List<Map<String, dynamic>> _extractList(
    Map<String, dynamic> data, {
    required List<String> keys,
  }) {
    for (final key in keys) {
      final value = data[key];
      if (value is List) {
        return value.whereType<Map<String, dynamic>>().toList();
      }
    }
    if (data['items'] is List) {
      return (data['items'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  String? _readId(Map<String, dynamic> row) {
    final nested = row['opportunity'];
    if (nested is Map && nested['id'] != null) {
      return nested['id'].toString();
    }
    return row['opportunity_id']?.toString() ??
        row['field_training_opportunity_id']?.toString() ??
        row['id']?.toString();
  }
}
