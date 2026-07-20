import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/instructor_models.dart';

class InstructorRepository {
  InstructorRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  Future<InstructorTrainingListData> listOpportunities({
    required String userId,
    String? search,
    String? status,
    int page = 1,
    int pageSize = 50,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.instructorFieldTraining,
        query: {
          'page': page,
          'page_size': pageSize,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      final opportunities = (data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(InstructorOpportunity.new)
          .toList();
      final meta = data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null;

      await _cache?.writeJson(
        userId: userId,
        namespace: 'instructor_trainings',
        payload: {
          'opportunities': opportunities.map((o) => o.raw).toList(),
          if (meta != null) 'meta': meta,
        },
      );

      return InstructorTrainingListData(
        opportunities: opportunities,
        meta: meta,
      );
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'instructor_trainings',
      );
      if (cached == null) rethrow;
      final list = (cached.data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(InstructorOpportunity.new)
          .toList();
      return InstructorTrainingListData(
        opportunities: list,
        fromCache: true,
        cachedAt: cached.savedAt,
        meta: cached.data['meta'] is Map<String, dynamic>
            ? cached.data['meta'] as Map<String, dynamic>
            : null,
      );
    }
  }

  Future<InstructorDashboardData> loadDashboard({
    required String userId,
    bool allowCache = true,
  }) async {
    try {
      final results = await Future.wait([
        listOpportunities(userId: userId, allowCache: false),
        _client.getJson(_client.endpoints.instructorFieldTrainingStats),
      ]);
      final list = results[0] as InstructorTrainingListData;
      final statsData = results[1] as Map<String, dynamic>;
      final stats = statsData['stats'] is Map<String, dynamic>
          ? statsData['stats'] as Map<String, dynamic>
          : statsData;

      await _cache?.writeJson(
        userId: userId,
        namespace: 'instructor_dashboard',
        payload: {
          'opportunities': list.opportunities.map((o) => o.raw).toList(),
          'stats': stats,
        },
      );

      return InstructorDashboardData(list: list, stats: stats);
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'instructor_dashboard',
      );
      if (cached == null) {
        // Fall back to trainings cache alone.
        final list = await listOpportunities(userId: userId, allowCache: true);
        return InstructorDashboardData(
          list: list,
          fromCache: list.fromCache,
          cachedAt: list.cachedAt,
        );
      }
      final opportunities = (cached.data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(InstructorOpportunity.new)
          .toList();
      return InstructorDashboardData(
        list: InstructorTrainingListData(
          opportunities: opportunities,
          fromCache: true,
          cachedAt: cached.savedAt,
        ),
        stats: cached.data['stats'] is Map<String, dynamic>
            ? cached.data['stats'] as Map<String, dynamic>
            : null,
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  Future<Map<String, dynamic>> getOpportunity(String id) async {
    return _client.getJson(_client.endpoints.instructorOpportunity(id));
  }

  Future<List<Map<String, dynamic>>> listApplications(
    String opportunityId, {
    String? status,
    String? trainingStatus,
    String? search,
    String? userId,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.instructorApplications(opportunityId),
        query: {
          if (status != null && status.isNotEmpty) 'status': status,
          if (trainingStatus != null && trainingStatus.isNotEmpty)
            'training_status': trainingStatus,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final apps = (data['applications'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'instructor_participants_$opportunityId',
          payload: {'applications': apps},
        );
      }
      return apps;
    } catch (_) {
      if (userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'instructor_participants_$opportunityId',
      );
      if (cached == null) rethrow;
      return (cached.data['applications'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  Future<Map<String, dynamic>> getProgress(String applicationId) async {
    return _client.getJson(
      _client.endpoints.instructorApplicationProgress(applicationId),
    );
  }

  Future<List<Map<String, dynamic>>> listSessions(
    String opportunityId, {
    String? userId,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.instructorSessions(opportunityId),
      );
      final sessions = (data['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'instructor_sessions_$opportunityId',
          payload: {'sessions': sessions},
        );
      }
      return sessions;
    } catch (_) {
      if (userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'instructor_sessions_$opportunityId',
      );
      if (cached == null) rethrow;
      return (cached.data['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  Future<Map<String, dynamic>> createSession({
    required String opportunityId,
    required Map<String, dynamic> body,
  }) {
    return _client.postJson(
      _client.endpoints.instructorSessions(opportunityId),
      body: body,
    );
  }

  Future<Map<String, dynamic>> updateSession({
    required String sessionId,
    required Map<String, dynamic> body,
  }) {
    return _client.patchJson(
      _client.endpoints.instructorSession(sessionId),
      body: body,
    );
  }

  Future<List<Map<String, dynamic>>> getAttendanceParticipants(
    String sessionId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.instructorSessionAttendance(sessionId),
    );
    return (data['participants'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<Map<String, dynamic>> saveAttendance({
    required String sessionId,
    required List<Map<String, dynamic>> records,
  }) {
    return _client.postJson(
      _client.endpoints.instructorSessionAttendance(sessionId),
      body: {'records': records},
    );
  }

  Future<List<Map<String, dynamic>>> listSubmissions(
    String opportunityId, {
    String? userId,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.instructorSubmissions(opportunityId),
      );
      final submissions = (data['submissions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'instructor_submissions_$opportunityId',
          payload: {'submissions': submissions},
        );
      }
      return submissions;
    } catch (_) {
      if (userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'instructor_submissions_$opportunityId',
      );
      if (cached == null) rethrow;
      return (cached.data['submissions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  Future<Map<String, dynamic>> reviewSubmission({
    required String submissionId,
    required String reviewStatus,
    String? feedback,
  }) {
    return _client.patchJson(
      _client.endpoints.instructorSubmissionReview(submissionId),
      body: {
        'review_status': reviewStatus,
        if (feedback != null && feedback.trim().isNotEmpty)
          'instructor_feedback': feedback.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> getSubmissionDownloadUrl(String submissionId) {
    return _client.getJson(
      _client.endpoints.instructorSubmissionDownloadUrl(submissionId),
    );
  }

  Future<List<Map<String, dynamic>>> listAssessments(
    String opportunityId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.instructorAssessments(opportunityId),
    );
    return (data['assessments'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<Map<String, dynamic>> getApplicationHours(String applicationId) {
    return _client.getJson(
      _client.endpoints.instructorApplicationHours(applicationId),
    );
  }

  /// Replace total completed hours (Model A). Body uses completed_hours.
  Future<Map<String, dynamic>> updateApplicationHours({
    required String applicationId,
    required int completedHours,
    String? note,
    int? expectedCompletedHours,
    bool sendExpected = true,
  }) {
    return _client.patchJson(
      _client.endpoints.instructorApplicationHours(applicationId),
      body: {
        'completed_hours': completedHours,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        if (sendExpected) 'expected_completed_hours': expectedCompletedHours,
      },
    );
  }
}

final instructorRepositoryProvider = Provider<InstructorRepository>((ref) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return InstructorRepository(ref.watch(apiClientProvider), cache);
});
