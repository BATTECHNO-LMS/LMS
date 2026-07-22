import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../providers/auth_controller.dart';
import '../domain/auth_user.dart';

class AuthRepository {
  AuthRepository(this._client);

  final ApiClient _client;

  Future<String> login({
    required String email,
    required String password,
  }) async {
    final data = await _client.postJson(
      _client.endpoints.login,
      body: {'email': email.trim().toLowerCase(), 'password': password},
    );
    final token = data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw ApiException(message: 'Missing authentication token');
    }
    return token;
  }

  Future<Map<String, dynamic>> register({
    required String fullName,
    required String email,
    required String password,
    required String universityId,
    required String universitySpecialtyId,
    String? phone,
  }) async {
    return _client.postJson(
      _client.endpoints.register,
      body: {
        'full_name': fullName.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
        'university_id': universityId,
        'university_specialty_id': universitySpecialtyId,
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> verifyEmailOtp({
    required String email,
    required String otp,
  }) {
    return _client.postJson(
      _client.endpoints.verifyEmailOtp,
      body: {'email': email.trim().toLowerCase(), 'otp': otp.trim()},
    );
  }

  Future<void> resendEmailOtp(String email) async {
    await _client.postJson(
      _client.endpoints.resendEmailOtp,
      body: {'email': email.trim().toLowerCase()},
    );
  }

  Future<void> forgotPassword(String email) async {
    await _client.postJson(
      _client.endpoints.forgotPassword,
      body: {'email': email.trim().toLowerCase()},
    );
  }

  Future<String> verifyPasswordResetOtp({
    required String email,
    required String otp,
  }) async {
    final data = await _client.postJson(
      _client.endpoints.verifyPasswordResetOtp,
      body: {'email': email.trim().toLowerCase(), 'otp': otp.trim()},
    );
    final token = data['resetToken']?.toString();
    if (token == null || token.isEmpty) {
      throw ApiException(message: 'Missing reset token');
    }
    return token;
  }

  Future<void> resetPassword({
    required String email,
    required String resetToken,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _client.postJson(
      _client.endpoints.resetPassword,
      body: {
        'email': email.trim().toLowerCase(),
        'resetToken': resetToken,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<AuthUser> fetchCurrentUser() async {
    final data = await _client.getJson(_client.endpoints.me);
    final userJson = data['user'];
    if (userJson is! Map<String, dynamic>) {
      throw ApiException(message: 'Invalid profile response');
    }
    return AuthUser.fromJson(userJson);
  }

  Future<void> logout() async {
    try {
      await _client.postJson(_client.endpoints.logout);
    } on ApiException {
      // Client-side session clear still proceeds (QA-AUTH-001).
    }
  }

  Future<List<Map<String, dynamic>>> fetchRegisterUniversities() async {
    final data = await _client.getJson(_client.endpoints.registerUniversities);
    final list = data['universities'];
    if (list is! List) {
      throw ApiException(message: 'Invalid universities response');
    }
    return list.whereType<Map<String, dynamic>>().toList();
  }

  Future<List<Map<String, dynamic>>> fetchRegisterSpecialties(
    String universityId,
  ) async {
    final data = await _client.getJson(
      _client.endpoints.registerUniversitySpecialties(universityId),
    );
    if (data['items'] is List) {
      return (data['items'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);
