import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/super_admin_models.dart';

/// Data access for the `super_admin` (Phase 24) shell.
///
/// All access is gated by the backend (`isGlobal` / role-code lists in
/// `backend/src/config/env.js`) — this class never re-implements those
/// checks. Any 403 is treated as a soft/empty result so screens never crash
/// when a specific sub-resource is denied. List reads have a read-only
/// offline fallback under their own `sa_*` cache namespace; writes are
/// online-only (no offline queue).
class SuperAdminRepository {
  SuperAdminRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  bool _isForbidden(Object e) => e is ApiException && e.statusCode == 403;

  // —— Dashboard ——

  Future<SuperAdminStats?> loadDashboardStats({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(_client.endpoints.adminDashboardStats);
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_dashboard',
          payload: data,
        );
      }
      return SuperAdminStats(data);
    } catch (e) {
      if (_isForbidden(e)) return null;
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: 'sa_dashboard');
      if (cached == null) return null;
      return SuperAdminStats(cached.data);
    }
  }

  // —— Universities ——

  Future<List<UniversityItem>> listUniversities({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(_client.endpoints.universities);
      final items = (data['universities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_universities',
          payload: {'universities': items},
        );
      }
      return items.map(UniversityItem.new).toList();
    } catch (e) {
      if (_isForbidden(e)) return const [];
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'sa_universities',
      );
      if (cached == null) rethrow;
      return (cached.data['universities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(UniversityItem.new)
          .toList();
    }
  }

  Future<UniversityItem?> getUniversity(
    String id, {
    bool includeCounts = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.university(id),
        query: {'include_counts': includeCounts ? 'true' : 'false'},
      );
      return UniversityItem(data);
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  /// Minimal create — name is required; other fields optional. University
  /// CREATE is `super_admin`-only server-side.
  Future<UniversityItem> createUniversity({
    required String name,
    String? nameEn,
    String? contactPerson,
    String? contactEmail,
    String? contactPhone,
    String? status,
  }) async {
    final data = await _client.postJson(
      _client.endpoints.universities,
      body: {
        'name': name.trim(),
        if (contactPerson != null && contactPerson.trim().isNotEmpty)
          'contact_person': contactPerson.trim(),
        if (contactEmail != null && contactEmail.trim().isNotEmpty)
          'contact_email': contactEmail.trim(),
        if (contactPhone != null && contactPhone.trim().isNotEmpty)
          'contact_phone': contactPhone.trim(),
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    return UniversityItem(data);
  }

  Future<UniversityItem> updateUniversity({
    required String id,
    required Map<String, dynamic> body,
  }) async {
    final data = await _client.putJson(
      _client.endpoints.university(id),
      body: body,
    );
    return UniversityItem(data);
  }

  // —— Users ——

  Future<({List<UserItem> items, Map<String, dynamic>? meta})> listUsers({
    String? userId,
    String? search,
    String? status,
    String? universityId,
    int page = 1,
    int pageSize = 20,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.users,
        query: {
          'page': page,
          'page_size': pageSize,
          if (search != null && search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty) 'status': status,
          if (universityId != null && universityId.isNotEmpty)
            'university_id': universityId,
        },
      );
      final items = (data['items'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final meta = data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null;
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_users',
          payload: {'items': items, if (meta != null) 'meta': meta},
        );
      }
      return (items: items.map(UserItem.new).toList(), meta: meta);
    } catch (e) {
      if (_isForbidden(e)) return (items: <UserItem>[], meta: null);
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: 'sa_users');
      if (cached == null) rethrow;
      final items = (cached.data['items'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(UserItem.new)
          .toList();
      return (
        items: items,
        meta: cached.data['meta'] is Map<String, dynamic>
            ? cached.data['meta'] as Map<String, dynamic>
            : null,
      );
    }
  }

  Future<UserItem?> getUser(String id) async {
    try {
      final data = await _client.getJson(_client.endpoints.userDetail(id));
      return UserItem(data);
    } on ApiException catch (e) {
      if (_isForbidden(e)) return null;
      rethrow;
    }
  }

  Future<UserItem> activateUser(String id) async {
    final data = await _client.patchJson(_client.endpoints.userActivate(id));
    return UserItem(data);
  }

  Future<UserItem> updateUserStatus({
    required String id,
    required String status,
  }) async {
    final data = await _client.patchJson(
      _client.endpoints.userStatus(id),
      body: {'status': status},
    );
    return UserItem(data);
  }

  /// `role_codes` / `primary_university_id` etc. IDENTITY-001: the backend
  /// (`assertSuperAdminRoleMutationAllowed`) enforces `super_admin`
  /// add/remove rules; the caller must have already shown a strong
  /// confirmation step before invoking this when `role_codes` touches
  /// `super_admin`.
  Future<UserItem> updateUser({
    required String id,
    required Map<String, dynamic> body,
  }) async {
    final data = await _client.putJson(
      _client.endpoints.userDetail(id),
      body: body,
    );
    return UserItem(data);
  }

  // —— Audit logs (read-only, safe fields only) ——

  Future<({List<Map<String, dynamic>> items, Map<String, dynamic>? meta})>
  listAuditLogs({
    String? userId,
    String? search,
    int page = 1,
    int pageSize = 20,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.auditLogs,
        query: {
          'page': page,
          'page_size': pageSize,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final items = (data['audit_logs'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_stripSensitiveAuditFields)
          .toList();
      final meta = data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null;
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_audit',
          payload: {'audit_logs': items, if (meta != null) 'meta': meta},
        );
      }
      return (items: items, meta: meta);
    } catch (e) {
      if (_isForbidden(e)) return (items: <Map<String, dynamic>>[], meta: null);
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: 'sa_audit');
      if (cached == null) rethrow;
      return (
        items: (cached.data['audit_logs'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList(),
        meta: cached.data['meta'] is Map<String, dynamic>
            ? cached.data['meta'] as Map<String, dynamic>
            : null,
      );
    }
  }

  /// Only safe display fields — never `old_values`/`new_values`/`ip_address`
  /// or any raw JSON/tokens.
  Map<String, dynamic> _stripSensitiveAuditFields(Map<String, dynamic> row) {
    return {
      'id': row['id'],
      'action_type': row['action_type'],
      'entity_type': row['entity_type'],
      'entity_id': row['entity_id'],
      'created_at': row['created_at'],
      'user': row['user'] is Map
          ? {'full_name': (row['user'] as Map)['full_name']}
          : null,
      'university': row['university'] is Map
          ? {'name': (row['university'] as Map)['name']}
          : null,
    };
  }

  // —— System status (health probe only — no DB URL/env details) ——

  Future<Map<String, dynamic>?> getHealth() async {
    try {
      return await _client.getRawJson(_client.config.healthUrl);
    } catch (_) {
      return null;
    }
  }

  // —— Certificates (read-only) ——

  Future<List<Map<String, dynamic>>> listCertificates({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(_client.endpoints.certificates);
      final items = (data['certificates'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_certificates',
          payload: {'certificates': items},
        );
      }
      return items;
    } catch (e) {
      if (_isForbidden(e)) return const [];
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'sa_certificates',
      );
      if (cached == null) rethrow;
      return (cached.data['certificates'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
  }

  // —— Global field-training report (`super_admin`-only) ——

  Future<Map<String, dynamic>?> globalFtReport({
    String? userId,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.adminFieldTrainingReportsGlobal,
      );
      if (userId != null) {
        await _cache?.writeJson(
          userId: userId,
          namespace: 'sa_reports',
          payload: data,
        );
      }
      return data;
    } catch (e) {
      if (_isForbidden(e)) return null;
      if (!allowCache || userId == null || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: 'sa_reports');
      return cached?.data;
    }
  }
}

final superAdminRepositoryProvider = Provider<SuperAdminRepository>((ref) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return SuperAdminRepository(ref.watch(apiClientProvider), cache);
});
