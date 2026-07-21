import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/reviewer_models.dart';

/// Data access for `qa_officer` / `university_reviewer` (Phase 23).
///
/// Both roles are university-scoped and read-mostly. Writes are online-only
/// (no offline queue) and every list read has a read-only offline fallback
/// under its own cache namespace. Any 403 from a capability the current role
/// doesn't hold is treated as an empty/soft result rather than an error, so
/// screens never crash when the backend denies a specific sub-resource.
class ReviewerRepository {
  ReviewerRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  bool _isForbidden(Object e) => e is ApiException && e.statusCode == 403;

  Future<ReviewQueuePage> _listWithCache({
    required String path,
    required String listKey,
    required String namespace,
    required String? userId,
    Map<String, dynamic>? query,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(path, query: query);
      final items = (data[listKey] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final meta = data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null;
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: namespace,
          payload: {listKey: items, if (meta != null) 'meta': meta},
        );
      }
      return ReviewQueuePage(items: items, meta: meta);
    } catch (e) {
      if (_isForbidden(e)) return const ReviewQueuePage(items: []);
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: namespace);
      if (cached == null) rethrow;
      final items = (cached.data[listKey] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      return ReviewQueuePage(
        items: items,
        meta: cached.data['meta'] is Map<String, dynamic>
            ? cached.data['meta'] as Map<String, dynamic>
            : null,
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  // —— QA reviews (qa_officer only) ——

  Future<ReviewQueuePage> listQaReviews({
    String? userId,
    String? status,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.qaReviews,
      listKey: 'qa_reviews',
      namespace: 'reviewer_qa_queue',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getQaReview(
    String id, {
    bool includeCorrective = true,
  }) async {
    try {
      return await _client.getJson(
        _client.endpoints.qaReview(id),
        query: {'include_corrective': includeCorrective ? 'true' : 'false'},
      );
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> patchQaReviewStatus(String id, String status) {
    return _client.patchJson(
      _client.endpoints.qaReviewStatus(id),
      body: {'status': status},
    );
  }

  // —— Corrective actions (qa_officer only) ——

  Future<ReviewQueuePage> listCorrectiveActions({
    String? userId,
    String? qaReviewId,
    String? status,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.correctiveActions,
      listKey: 'corrective_actions',
      namespace: 'reviewer_qa_queue_corrective',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (qaReviewId != null) 'qa_review_id': qaReviewId,
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getCorrectiveAction(String id) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.correctiveAction(id),
      );
      return data['corrective_action'] is Map<String, dynamic>
          ? data['corrective_action'] as Map<String, dynamic>
          : data;
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> patchCorrectiveStatus(String id, String status) {
    return _client.patchJson(
      _client.endpoints.correctiveActionStatus(id),
      body: {'status': status},
    );
  }

  // —— Risk cases (qa_officer only) ——

  Future<ReviewQueuePage> listRiskCases({
    String? userId,
    String? status,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.riskCases,
      listKey: 'risk_cases',
      namespace: 'reviewer_qa_queue_risk',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getRiskCase(String id) async {
    try {
      final data = await _client.getJson(_client.endpoints.riskCase(id));
      return data['risk_case'] is Map<String, dynamic>
          ? data['risk_case'] as Map<String, dynamic>
          : data;
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> patchRiskCaseStatus(String id, String status) {
    return _client.patchJson(
      _client.endpoints.riskCaseStatus(id),
      body: {'status': status},
    );
  }

  // —— Integrity cases (qa_officer only) ——

  Future<ReviewQueuePage> listIntegrityCases({
    String? userId,
    String? status,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.integrityCases,
      listKey: 'integrity_cases',
      namespace: 'reviewer_qa_queue_integrity',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getIntegrityCase(String id) async {
    try {
      final data = await _client.getJson(_client.endpoints.integrityCase(id));
      return data['integrity_case'] is Map<String, dynamic>
          ? data['integrity_case'] as Map<String, dynamic>
          : data;
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> patchIntegrityCaseStatus(
    String id,
    String status,
  ) {
    return _client.patchJson(
      _client.endpoints.integrityCaseStatus(id),
      body: {'status': status},
    );
  }

  // —— Evidence (read-only, both roles) ——

  Future<ReviewQueuePage> listEvidence({
    String? userId,
    String? cohortId,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.evidence,
      listKey: 'evidence',
      namespace: 'reviewer_evidence',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (cohortId != null) 'cohort_id': cohortId,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getEvidence(String id) async {
    try {
      final data = await _client.getJson(_client.endpoints.evidenceDetail(id));
      return data['evidence'] is Map<String, dynamic>
          ? data['evidence'] as Map<String, dynamic>
          : data;
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  // —— Recognition requests (university_reviewer only) ——

  Future<ReviewQueuePage> listRecognitionRequests({
    String? userId,
    String? status,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.recognitionRequests,
      listKey: 'recognition_requests',
      namespace: 'reviewer_recognition',
      userId: userId,
      allowCache: allowCache,
      query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
  }

  Future<Map<String, dynamic>?> getRecognitionRequest(String id) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.recognitionRequest(id),
      );
      return data['recognition_request'] is Map<String, dynamic>
          ? data['recognition_request'] as Map<String, dynamic>
          : data;
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> listRecognitionDocuments(String id) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.recognitionRequestDocuments(id),
      );
      return (data['recognition_documents'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    } on ApiException catch (e) {
      if (_isForbidden(e)) return const [];
      rethrow;
    }
  }

  Future<Map<String, dynamic>> patchRecognitionStatus(
    String id,
    String status,
  ) {
    return _client.patchJson(
      _client.endpoints.recognitionRequestStatus(id),
      body: {'status': status},
    );
  }

  // —— Enrollment decisions (university_reviewer only) ——

  Future<ReviewQueuePage> listPendingEnrollments({
    String? userId,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.enrollmentsPending,
      listKey: 'enrollments',
      namespace: 'reviewer_enrollments',
      userId: userId,
      allowCache: allowCache,
    );
  }

  Future<Map<String, dynamic>> approveEnrollment(String id) {
    return _client.patchJson(_client.endpoints.enrollmentApprove(id));
  }

  Future<Map<String, dynamic>> rejectEnrollment(String id, {String? reason}) {
    return _client.patchJson(
      _client.endpoints.enrollmentReject(id),
      body: {
        if (reason != null && reason.trim().isNotEmpty)
          'rejection_reason': reason.trim(),
      },
    );
  }

  // —— Academic field-training reports/students (both roles) ——

  Future<Map<String, dynamic>?> academicUniversityReport({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.academicFieldTrainingReportsUniversity,
      );
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'reviewer_reports',
          payload: data,
        );
      }
      return data;
    } catch (e) {
      if (_isForbidden(e)) return null;
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'reviewer_reports',
      );
      return cached?.data;
    }
  }

  Future<ReviewQueuePage> academicStudentsReport({
    String? userId,
    String? search,
    bool allowCache = true,
  }) {
    return _listWithCache(
      path: _client.endpoints.academicFieldTrainingStudents,
      listKey: 'students',
      namespace: 'reviewer_students',
      userId: userId,
      allowCache: allowCache,
      query: {if (search != null && search.isNotEmpty) 'search': search},
    );
  }

  Future<Map<String, dynamic>?> academicStudentReport(
    String applicationId,
  ) async {
    try {
      return await _client.getJson(
        _client.endpoints.academicFieldTrainingReportStudent(applicationId),
      );
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<String?> taskInstructionDownloadUrl(String taskId) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.academicTaskInstructionDownloadUrl(taskId),
      );
      return data['url']?.toString();
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  // —— Dashboards ——

  Future<ReviewerDashboardData> loadQaDashboard({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final results = await Future.wait([
        listQaReviews(userId: userId, status: 'open', allowCache: false),
        listCorrectiveActions(
          userId: userId,
          status: 'open',
          allowCache: false,
        ),
        listRiskCases(userId: userId, status: 'open', allowCache: false),
      ]);
      final qaOpen = results[0];
      final correctiveOpen = results[1];
      final riskOpen = results[2];
      final firstQa = qaOpen.items.isNotEmpty ? qaOpen.items.first : null;
      final data = ReviewerDashboardData(
        openQaReviewsCount: qaOpen.total,
        openCorrectiveCount: correctiveOpen.total,
        openRiskCount: riskOpen.total,
        firstOpenQaReviewId: firstQa?['id']?.toString(),
        firstOpenQaReviewTitle: firstQa != null
            ? (QaReviewItem(firstQa).cohortTitle ?? '')
            : null,
      );
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'reviewer_dashboard',
          payload: {
            'open_qa_reviews_count': data.openQaReviewsCount,
            'open_corrective_count': data.openCorrectiveCount,
            'open_risk_count': data.openRiskCount,
            'first_open_qa_review_id': data.firstOpenQaReviewId,
            'first_open_qa_review_title': data.firstOpenQaReviewTitle,
          },
        );
      }
      return data;
    } catch (e) {
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'reviewer_dashboard',
      );
      if (cached == null) rethrow;
      return ReviewerDashboardData(
        openQaReviewsCount: asInt(cached.data['open_qa_reviews_count']),
        openCorrectiveCount: asInt(cached.data['open_corrective_count']),
        openRiskCount: asInt(cached.data['open_risk_count']),
        firstOpenQaReviewId: cached.data['first_open_qa_review_id']?.toString(),
        firstOpenQaReviewTitle: cached.data['first_open_qa_review_title']
            ?.toString(),
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  Future<ReviewerDashboardData> loadReviewerDashboard({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final results = await Future.wait([
        listRecognitionRequests(
          userId: userId,
          status: 'submitted',
          allowCache: false,
        ),
        listRecognitionRequests(
          userId: userId,
          status: 'under_review',
          allowCache: false,
        ),
        listPendingEnrollments(userId: userId, allowCache: false),
      ]);
      final submitted = results[0];
      final underReview = results[1];
      final pendingEnrollments = results[2];
      final recognitionPendingCount = submitted.total + underReview.total;
      final firstPending = underReview.items.isNotEmpty
          ? underReview.items.first
          : (submitted.items.isNotEmpty ? submitted.items.first : null);
      final data = ReviewerDashboardData(
        pendingRecognitionCount: recognitionPendingCount,
        pendingEnrollmentsCount: pendingEnrollments.total,
        firstPendingRecognitionId: firstPending?['id']?.toString(),
        firstPendingRecognitionTitle: firstPending != null
            ? (RecognitionRequestItem(firstPending).microCredentialTitle ?? '')
            : null,
      );
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'reviewer_dashboard',
          payload: {
            'pending_recognition_count': data.pendingRecognitionCount,
            'pending_enrollments_count': data.pendingEnrollmentsCount,
            'first_pending_recognition_id': data.firstPendingRecognitionId,
            'first_pending_recognition_title':
                data.firstPendingRecognitionTitle,
          },
        );
      }
      return data;
    } catch (e) {
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'reviewer_dashboard',
      );
      if (cached == null) rethrow;
      return ReviewerDashboardData(
        pendingRecognitionCount: asInt(
          cached.data['pending_recognition_count'],
        ),
        pendingEnrollmentsCount: asInt(
          cached.data['pending_enrollments_count'],
        ),
        firstPendingRecognitionId: cached.data['first_pending_recognition_id']
            ?.toString(),
        firstPendingRecognitionTitle: cached
            .data['first_pending_recognition_title']
            ?.toString(),
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }
}

final reviewerRepositoryProvider = Provider<ReviewerRepository>((ref) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return ReviewerRepository(ref.watch(apiClientProvider), cache);
});
