import 'package:dio/dio.dart';

import '../errors/api_exception.dart';

Map<String, dynamic> unwrapApiData(Response<dynamic> response) {
  final body = response.data;
  if (body is! Map<String, dynamic>) {
    throw ApiException(message: 'Invalid API response shape');
  }
  if (body['success'] != true) {
    throw ApiException(
      message: body['message']?.toString() ?? 'Request failed',
      code: body['code']?.toString(),
      statusCode: response.statusCode,
    );
  }
  final data = body['data'];
  if (data is Map<String, dynamic>) return data;
  if (data is List) return {'items': data};
  if (data == null) return {};
  return {'value': data};
}

ApiException mapDioError(DioException error) {
  if (error.type == DioExceptionType.connectionError ||
      error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.receiveTimeout ||
      error.type == DioExceptionType.sendTimeout) {
    return ApiException(message: 'Network unavailable', isNetwork: true);
  }

  final response = error.response;
  final body = response?.data;
  if (body is Map<String, dynamic>) {
    return ApiException(
      message: body['message']?.toString() ?? 'Request failed',
      code: body['code']?.toString(),
      statusCode: response?.statusCode,
    );
  }

  return ApiException(
    message: error.message ?? 'Request failed',
    statusCode: response?.statusCode,
  );
}
