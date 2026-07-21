import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/certificate_models.dart';

class CertificatesRepository {
  CertificatesRepository(this._client);

  final ApiClient _client;

  Future<List<StudentCertificate>> loadCertificates({
    int page = 1,
    int pageSize = 20,
  }) async {
    final data = await _client.getJson(
      _client.endpoints.certificates,
      query: {'page': page, 'page_size': pageSize},
    );
    return (data['certificates'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(StudentCertificate.fromMap)
        .toList();
  }

  Future<StudentCertificate> loadCertificate(String id) async {
    final data = await _client.getJson(_client.endpoints.certificateDetail(id));
    final cert = data['certificate'];
    if (cert is Map<String, dynamic>) {
      return StudentCertificate.fromMap(cert);
    }
    return StudentCertificate.fromMap(data);
  }

  List<CompletionLetterItem> completionLettersFromApplications(
    List<Map<String, dynamic>> applications,
  ) {
    return applications
        .where((app) => app['completion_letter_issued_at'] != null)
        .map(
          (app) => CompletionLetterItem(
            applicationId: app['id']?.toString() ?? '',
            opportunityTitle: _oppTitle(app),
            issuedAt: app['completion_letter_issued_at']?.toString(),
          ),
        )
        .toList();
  }

  Future<File> downloadCompletionLetter(String applicationId) async {
    final bytes = await _client.downloadBytes(
      _client.endpoints.studentCompletionLetterDownload(applicationId),
    );
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/completion_$applicationId.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  String _oppTitle(Map<String, dynamic> app) {
    final opp = app['opportunity'];
    if (opp is Map<String, dynamic>) {
      return opp['title']?.toString() ?? '—';
    }
    return app['opportunity_title']?.toString() ?? '—';
  }
}

final certificatesRepositoryProvider = Provider<CertificatesRepository>(
  (ref) => CertificatesRepository(ref.watch(apiClientProvider)),
);
