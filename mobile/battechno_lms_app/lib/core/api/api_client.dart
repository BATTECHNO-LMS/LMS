import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/config/app_config.dart';
import 'api_endpoints.dart';
import 'api_response.dart';

final appConfigProvider = Provider<AppConfig>(
  (ref) => AppConfig.fromEnvironment(),
);

final apiEndpointsProvider = Provider<ApiEndpoints>(
  (ref) => ApiEndpoints(ref.watch(appConfigProvider)),
);

typedef TokenReader = Future<String?> Function();
typedef UnauthorizedHandler = Future<void> Function();

class ApiClient {
  ApiClient({
    required AppConfig config,
    required ApiEndpoints endpoints,
    required TokenReader readToken,
    required UnauthorizedHandler onUnauthorized,
  }) : _config = config,
       _endpoints = endpoints,
       _readToken = readToken,
       _onUnauthorized = onUnauthorized {
    _dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final apiError = mapDioError(error);
          if (apiError.isUnauthorized) {
            await _onUnauthorized();
          }
          handler.reject(error);
        },
      ),
    );

    if (kDebugMode && _config.isDevelopment) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: false,
          logPrint: (obj) => debugPrint(obj.toString()),
        ),
      );
    }
  }

  final AppConfig _config;
  final ApiEndpoints _endpoints;
  final TokenReader _readToken;
  final UnauthorizedHandler _onUnauthorized;
  late final Dio _dio;

  ApiEndpoints get endpoints => _endpoints;
  AppConfig get config => _config;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<dynamic>(path, queryParameters: query);
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await _dio.post<dynamic>(path, data: body);
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    Map<String, String>? fields,
    String? filePath,
    String fileField = 'file',
    String? fileName,
  }) async {
    try {
      final formMap = <String, dynamic>{...?fields};
      if (filePath != null && filePath.isNotEmpty) {
        formMap[fileField] = await MultipartFile.fromFile(
          filePath,
          filename: fileName ?? filePath.split(Platform.pathSeparator).last,
        );
      }
      final form = FormData.fromMap(formMap);
      final response = await _dio.post<dynamic>(
        path,
        data: form,
        options: Options(contentType: 'multipart/form-data'),
      );
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await _dio.patch<dynamic>(path, data: body);
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> putJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await _dio.put<dynamic>(path, data: body);
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> deleteJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await _dio.delete<dynamic>(path, data: body);
      return unwrapApiData(response);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// GET for endpoints outside `apiRoot` that don't use the `{success,data}`
  /// envelope (e.g. `/health`). Returns the raw decoded body.
  Future<Map<String, dynamic>> getRawJson(String path) async {
    try {
      final response = await _dio.get<dynamic>(path);
      final body = response.data;
      return body is Map<String, dynamic> ? body : {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<int>> downloadBytes(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
  }) async {
    try {
      final response = await _dio.get<List<int>>(
        path,
        queryParameters: query,
        options: Options(
          responseType: ResponseType.bytes,
          headers: authenticated ? null : {'Authorization': ''},
        ),
      );
      return response.data ?? const [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
