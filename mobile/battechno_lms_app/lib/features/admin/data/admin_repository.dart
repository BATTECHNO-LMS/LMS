import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/admin_models.dart';

class AdminRepository {
  AdminRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  Future<AdminOpportunityListData> listOpportunities({
    required String userId,
    String? search,
    String? status,
    int page = 1,
    int pageSize = 50,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.adminFieldTraining,
        query: {
          'page': page,
          'page_size': pageSize,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      final opportunities = (data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminOpportunity.new)
          .toList();
      final meta = data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null;

      await _cache?.writeJson(
        userId: userId,
        namespace: 'admin_opportunities',
        payload: {
          'opportunities': opportunities.map((o) => o.raw).toList(),
          if (meta != null) 'meta': meta,
        },
      );

      return AdminOpportunityListData(opportunities: opportunities, meta: meta);
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'admin_opportunities',
      );
      if (cached == null) rethrow;
      final list = (cached.data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminOpportunity.new)
          .toList();
      return AdminOpportunityListData(
        opportunities: list,
        fromCache: true,
        cachedAt: cached.savedAt,
        meta: cached.data['meta'] is Map<String, dynamic>
            ? cached.data['meta'] as Map<String, dynamic>
            : null,
      );
    }
  }

  Future<Map<String, dynamic>> _getStats() {
    return _client.getJson(_client.endpoints.adminFieldTrainingStats);
  }

  Future<Map<String, dynamic>?> _getAdminStats({required String role}) async {
    if (!AdminCapabilities.canReadAdminStats(role)) return null;
    try {
      return await _client.getJson(_client.endpoints.adminDashboardStats);
    } on ApiException catch (e) {
      if (e.statusCode == 403) return null;
      rethrow;
    }
  }

  Future<int?> _getPendingUsersCount({required String role}) async {
    if (!AdminCapabilities.canReadUsers(role)) return null;
    try {
      final data = await _client.getJson(
        _client.endpoints.adminUsers,
        query: {'page': 1, 'page_size': 1, 'status': 'inactive'},
      );
      final meta = data['meta'];
      if (meta is Map) return (meta['total'] as num?)?.toInt();
      return null;
    } on ApiException catch (e) {
      if (e.statusCode == 403) return null;
      rethrow;
    }
  }

  Future<AdminDashboardData> loadDashboard({
    required String userId,
    required String role,
    bool allowCache = true,
  }) async {
    try {
      final results = await Future.wait([
        listOpportunities(userId: userId, allowCache: false),
        _getStats(),
        _getAdminStats(role: role),
        _getPendingUsersCount(role: role),
      ]);
      final list = results[0] as AdminOpportunityListData;
      final statsData = results[1] as Map<String, dynamic>;
      final stats = statsData['stats'] is Map<String, dynamic>
          ? statsData['stats'] as Map<String, dynamic>
          : statsData;
      final dashboardMap = results[2] as Map<String, dynamic>?;
      final pendingUsers = results[3] as int?;

      await _cache?.writeJson(
        userId: userId,
        namespace: 'admin_dashboard',
        payload: {
          'opportunities': list.opportunities.map((o) => o.raw).toList(),
          'stats': stats,
          if (dashboardMap != null) 'dashboard_stats': dashboardMap,
          if (pendingUsers != null) 'pending_users': pendingUsers,
        },
      );

      return AdminDashboardData(
        list: list,
        ftStats: AdminFieldTrainingStats(stats),
        dashboardStats: dashboardMap != null
            ? AdminDashboardStats(dashboardMap)
            : null,
        pendingUsersCount: pendingUsers,
      );
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'admin_dashboard',
      );
      if (cached == null) {
        final list = await listOpportunities(userId: userId, allowCache: true);
        return AdminDashboardData(
          list: list,
          fromCache: list.fromCache,
          cachedAt: list.cachedAt,
        );
      }
      final opportunities = (cached.data['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminOpportunity.new)
          .toList();
      return AdminDashboardData(
        list: AdminOpportunityListData(
          opportunities: opportunities,
          fromCache: true,
          cachedAt: cached.savedAt,
        ),
        ftStats: cached.data['stats'] is Map<String, dynamic>
            ? AdminFieldTrainingStats(
                cached.data['stats'] as Map<String, dynamic>,
              )
            : null,
        dashboardStats: cached.data['dashboard_stats'] is Map<String, dynamic>
            ? AdminDashboardStats(
                cached.data['dashboard_stats'] as Map<String, dynamic>,
              )
            : null,
        pendingUsersCount: (cached.data['pending_users'] as num?)?.toInt(),
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  Future<Map<String, dynamic>> getOpportunity(String id) async {
    return _client.getJson(_client.endpoints.adminOpportunity(id));
  }

  Future<Map<String, dynamic>> createOpportunity(Map<String, dynamic> body) {
    return _client.postJson(_client.endpoints.adminFieldTraining, body: body);
  }

  Future<Map<String, dynamic>> updateOpportunity({
    required String id,
    required Map<String, dynamic> body,
  }) {
    return _client.patchJson(
      _client.endpoints.adminOpportunity(id),
      body: body,
    );
  }

  Future<Map<String, dynamic>> publish(String id) {
    return _client.postJson(_client.endpoints.adminOpportunityPublish(id));
  }

  Future<Map<String, dynamic>> archive(String id) {
    return _client.postJson(_client.endpoints.adminOpportunityArchive(id));
  }

  Future<List<Map<String, dynamic>>> listInstructors() async {
    final data = await _client.getJson(_client.endpoints.adminInstructors);
    return (data['instructors'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<Map<String, dynamic>> getEligibilityCatalog() {
    return _client.getJson(_client.endpoints.adminEligibilityCatalog);
  }

  Future<List<Map<String, dynamic>>> listApplications(
    String opportunityId, {
    String? status,
    String? search,
    String? userId,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.adminApplications(opportunityId),
        query: {
          if (status != null && status.isNotEmpty) 'status': status,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final apps = (data['applications'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'admin_applications_$opportunityId',
          payload: {'applications': apps},
        );
      }
      return apps;
    } catch (_) {
      if (userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'admin_applications_$opportunityId',
      );
      if (cached == null) rethrow;
      return (cached.data['applications'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  Future<Map<String, dynamic>> reviewApplication({
    required String applicationId,
    required String status,
    String? adminNote,
  }) {
    return _client.patchJson(
      _client.endpoints.adminApplicationStatus(applicationId),
      body: {
        'status': status,
        if (adminNote != null && adminNote.trim().isNotEmpty)
          'admin_note': adminNote.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> getProgress(String applicationId) async {
    return _client.getJson(
      _client.endpoints.adminApplicationProgress(applicationId),
    );
  }

  Future<Map<String, dynamic>> getApplicationHours(String applicationId) {
    return _client.getJson(
      _client.endpoints.adminApplicationHours(applicationId),
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
      _client.endpoints.adminApplicationHours(applicationId),
      body: {
        'completed_hours': completedHours,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        if (sendExpected) 'expected_completed_hours': expectedCompletedHours,
      },
    );
  }

  Future<List<Map<String, dynamic>>> listSessions(
    String opportunityId, {
    String? userId,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.adminSessions(opportunityId),
      );
      final sessions = (data['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'admin_sessions_$opportunityId',
          payload: {'sessions': sessions},
        );
      }
      return sessions;
    } catch (_) {
      if (userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'admin_sessions_$opportunityId',
      );
      if (cached == null) rethrow;
      return (cached.data['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  Future<List<Map<String, dynamic>>> getAttendance(String sessionId) async {
    final data = await _client.getJson(
      _client.endpoints.adminSessionAttendance(sessionId),
    );
    return (data['participants'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<List<Map<String, dynamic>>> listSubmissions(
    String opportunityId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.adminSubmissions(opportunityId),
    );
    return (data['submissions'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<List<Map<String, dynamic>>> listAssessments(
    String opportunityId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.adminAssessments(opportunityId),
    );
    return (data['assessments'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<Map<String, dynamic>> universityReport() {
    return _client.getJson(
      _client.endpoints.adminFieldTrainingReportsUniversity,
    );
  }

  Future<Map<String, dynamic>> studentsReport({String? search}) {
    return _client.getJson(
      _client.endpoints.adminFieldTrainingReportsStudents,
      query: {if (search != null && search.isNotEmpty) 'search': search},
    );
  }

  Future<Map<String, dynamic>> studentReport(String applicationId) {
    return _client.getJson(
      _client.endpoints.adminFieldTrainingReportStudent(applicationId),
    );
  }
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return AdminRepository(ref.watch(apiClientProvider), cache);
});
