import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/account_deletion_models.dart';

class AccountDeletionRepository {
  AccountDeletionRepository(this._client, this._endpoints);

  final ApiClient _client;
  final ApiEndpoints _endpoints;

  Future<AccountDeletionStatusPayload> getStatus() async {
    final data = await _client.getJson(_endpoints.accountDeletionRequest);
    return AccountDeletionStatusPayload.fromJson(data);
  }

  Future<AccountDeletionRequest> submit({
    required String currentPassword,
    String? reason,
  }) async {
    final data = await _client.postJson(
      _endpoints.accountDeletionRequest,
      body: {
        'confirmation': 'DELETE',
        'currentPassword': currentPassword,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    final request = data['request'];
    if (request is! Map<String, dynamic>) {
      throw StateError('Missing deletion request in response');
    }
    return AccountDeletionRequest.fromJson(request);
  }

  Future<AccountDeletionRequest> cancel() async {
    final data = await _client.postJson(
      _endpoints.accountDeletionRequestCancel,
    );
    final request = data['request'];
    if (request is! Map<String, dynamic>) {
      throw StateError('Missing deletion request in response');
    }
    return AccountDeletionRequest.fromJson(request);
  }
}
