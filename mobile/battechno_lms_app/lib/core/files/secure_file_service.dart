import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../api/api_client.dart';
import '../../features/auth/providers/auth_controller.dart';

/// Validates and downloads private files without logging tokens or URLs with secrets.
class SecureFileService {
  SecureFileService(this._client);

  final ApiClient _client;

  static bool isSafeHttpsUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final uri = Uri.tryParse(url.trim());
    if (uri == null || !uri.hasScheme) return false;
    return uri.scheme == 'https' || uri.scheme == 'http';
  }

  Future<File> downloadAuthenticated({
    required String path,
    required String fileName,
  }) async {
    final bytes = await _client.downloadBytes(path);
    return _writeTemp(bytes, fileName);
  }

  Future<File> downloadSignedUrl({
    required String url,
    required String fileName,
  }) async {
    if (!isSafeHttpsUrl(url)) {
      throw ArgumentError('Unsafe download URL');
    }
    final dio = Dio();
    final response = await dio.get<List<int>>(
      url,
      options: Options(responseType: ResponseType.bytes),
    );
    return _writeTemp(response.data ?? const [], fileName);
  }

  Future<File> downloadViaFileId(String fileId, {String? fileName}) async {
    final data = await _client.getJson(
      _client.endpoints.fileDownloadUrl(fileId),
    );
    final url = data['url']?.toString();
    if (url == null || url.isEmpty) {
      throw StateError('Download URL unavailable');
    }
    if (isSafeHttpsUrl(url)) {
      return downloadSignedUrl(url: url, fileName: fileName ?? 'document.pdf');
    }
    return downloadAuthenticated(
      path: url,
      fileName: fileName ?? 'document.pdf',
    );
  }

  Future<OpenResult> openFile(File file) => OpenFilex.open(file.path);

  Future<File> _writeTemp(List<int> bytes, String fileName) async {
    final dir = await getTemporaryDirectory();
    final safeName = fileName.replaceAll(RegExp(r'[^\w.\-]+'), '_');
    final file = File(
      '${dir.path}/bat_${DateTime.now().millisecondsSinceEpoch}_$safeName',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}

final secureFileServiceProvider = Provider<SecureFileService>((ref) {
  return SecureFileService(ref.watch(apiClientProvider));
});
