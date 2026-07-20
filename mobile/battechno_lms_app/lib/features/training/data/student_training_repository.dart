import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/student_training_models.dart';

class StudentTrainingRepository {
  StudentTrainingRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  Future<StudentTrainingListData> load({
    required String userId,
    String? search,
    String? trainingMode,
    bool allowCache = true,
  }) async {
    try {
      final results = await Future.wait([
        _client.getJson(
          _client.endpoints.studentFieldTraining,
          query: {
            if (search != null && search.isNotEmpty) 'search': search,
            if (trainingMode != null && trainingMode.isNotEmpty)
              'training_mode': trainingMode,
          },
        ),
        _client.getJson(_client.endpoints.studentMyApplications),
      ]);

      final oppData = results[0];
      final appData = results[1];
      final opportunities = (oppData['opportunities'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final applications = (appData['applications'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();

      await _cache?.writeJson(
        userId: userId,
        namespace: 'training_list',
        payload: {
          'opportunities': opportunities,
          'applications': applications,
          'profile_incomplete': oppData['profile_incomplete'] == true,
          'message': oppData['message'],
        },
      );

      return StudentTrainingListData(
        opportunities: opportunities,
        applications: applications,
        profileIncomplete: oppData['profile_incomplete'] == true,
        message: oppData['message']?.toString(),
      );
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(
        userId: userId,
        namespace: 'training_list',
      );
      if (cached == null) rethrow;
      final data = cached.data;
      return StudentTrainingListData(
        opportunities: (data['opportunities'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList(),
        applications: (data['applications'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList(),
        profileIncomplete: data['profile_incomplete'] == true,
        message: data['message']?.toString(),
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  Future<Map<String, dynamic>> apply({
    required String opportunityId,
    String? studentMessage,
  }) async {
    return _client.postJson(
      _client.endpoints.studentApply(opportunityId),
      body: {
        if (studentMessage != null && studentMessage.trim().isNotEmpty)
          'student_message': studentMessage.trim(),
      },
    );
  }
}

final studentTrainingRepositoryProvider = Provider<StudentTrainingRepository>((
  ref,
) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return StudentTrainingRepository(ref.watch(apiClientProvider), cache);
});
