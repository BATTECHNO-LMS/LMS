import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/assessment_models.dart';
import '../domain/field_training_models.dart';
import '../domain/session_models.dart';

class FieldTrainingDetailBundle {
  const FieldTrainingDetailBundle({
    required this.opportunity,
    this.application,
    this.progress,
    required this.tasks,
    this.assessments = const [],
    this.sessions = const [],
  });

  final Map<String, dynamic> opportunity;
  final Map<String, dynamic>? application;
  final Map<String, dynamic>? progress;
  final List<Map<String, dynamic>> tasks;
  final List<StudentAssessmentSummary> assessments;
  final List<TrainingSessionItem> sessions;
}

class FieldTrainingRepository {
  FieldTrainingRepository(this._client);

  final ApiClient _client;

  Future<FieldTrainingDetailBundle> loadDetail(String opportunityId) async {
    final detail = await _client.getJson(
      _client.endpoints.studentFieldTrainingDetail(opportunityId),
    );
    final progressData = await _client.getJson(
      _client.endpoints.studentFieldTrainingProgress(opportunityId),
    );
    final tasksData = await _client.getJson(
      _client.endpoints.studentFieldTrainingTasks(opportunityId),
    );

    List<StudentAssessmentSummary> assessments = const [];
    List<TrainingSessionItem> sessions = const [];
    try {
      assessments = await loadAssessments(opportunityId);
    } catch (_) {
      assessments = const [];
    }
    try {
      sessions = await loadSessions(opportunityId);
    } catch (_) {
      sessions = const [];
    }

    final opp = JsonHelpers.map(detail['opportunity']) ?? detail;
    return FieldTrainingDetailBundle(
      opportunity: opp,
      application: JsonHelpers.map(detail['application']),
      progress: JsonHelpers.map(progressData['progress']),
      tasks: JsonHelpers.listOfMaps(tasksData, keys: ['tasks']),
      assessments: assessments,
      sessions: sessions,
    );
  }

  Future<Map<String, dynamic>?> loadProgress(String opportunityId) async {
    final data = await _client.getJson(
      _client.endpoints.studentFieldTrainingProgress(opportunityId),
    );
    return JsonHelpers.map(data['progress']);
  }

  Future<List<StudentAssessmentSummary>> loadAssessments(
    String opportunityId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.studentFieldTrainingAssessments(opportunityId),
    );
    return JsonHelpers.listOfMaps(
      data,
      keys: ['assessments'],
    ).map(StudentAssessmentSummary.fromMap).toList();
  }

  Future<AssessmentDetailBundle> loadAssessmentDetail({
    required String opportunityId,
    required String type,
  }) async {
    final data = await _client.getJson(
      _client.endpoints.studentFieldTrainingAssessment(opportunityId, type),
    );
    return AssessmentDetailBundle(
      assessment: JsonHelpers.map(data['assessment']) ?? {},
      attempt: JsonHelpers.map(data['attempt']),
    );
  }

  Future<AssessmentSubmitResult> submitAssessment({
    required String opportunityId,
    required String type,
    required Map<String, dynamic> answers,
  }) async {
    final data = await _client.postJson(
      _client.endpoints.studentFieldTrainingAssessmentSubmit(
        opportunityId,
        type,
      ),
      body: {'answers': answers},
    );
    return AssessmentSubmitResult.fromMap(data);
  }

  Future<List<TrainingSessionItem>> loadSessions(String opportunityId) async {
    final data = await _client.getJson(
      _client.endpoints.studentFieldTrainingSessions(opportunityId),
    );
    return JsonHelpers.listOfMaps(
      data,
      keys: ['sessions'],
    ).map((map) => TrainingSessionItem(raw: map)).toList();
  }

  Future<Map<String, dynamic>> submitTask({
    required String taskId,
    String? projectUrl,
    String? finalNotes,
  }) async {
    return _client.postJson(
      _client.endpoints.studentSubmitTask(taskId),
      body: {
        if (projectUrl != null && projectUrl.trim().isNotEmpty)
          'project_url': projectUrl.trim(),
        if (finalNotes != null && finalNotes.trim().isNotEmpty)
          'final_student_notes': finalNotes.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> submitTaskWithFile({
    required String taskId,
    required String filePath,
    required String fileName,
    String? projectUrl,
    String? finalNotes,
  }) async {
    return _client.postMultipart(
      _client.endpoints.studentSubmitTask(taskId),
      fields: {
        if (projectUrl != null && projectUrl.trim().isNotEmpty)
          'project_url': projectUrl.trim(),
        if (finalNotes != null && finalNotes.trim().isNotEmpty)
          'final_student_notes': finalNotes.trim(),
      },
      filePath: filePath,
      fileField: 'file',
      fileName: fileName,
    );
  }
}

final fieldTrainingRepositoryProvider = Provider<FieldTrainingRepository>(
  (ref) => FieldTrainingRepository(ref.watch(apiClientProvider)),
);
