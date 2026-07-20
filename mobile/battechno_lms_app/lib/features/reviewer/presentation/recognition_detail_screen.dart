import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

/// Recognition request detail — summary, attached documents, and a status
/// decision sheet limited to the valid next statuses. `university_reviewer`
/// decides with `{status}` only (no notes) per the backend contract.
class RecognitionDetailScreen extends ConsumerStatefulWidget {
  const RecognitionDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<RecognitionDetailScreen> createState() =>
      _RecognitionDetailScreenState();
}

class _RecognitionDetailScreenState
    extends ConsumerState<RecognitionDetailScreen> {
  Map<String, dynamic>? _request;
  List<Map<String, dynamic>> _documents = const [];
  bool _loading = true;
  bool _acting = false;
  String? _error;
  String? _openingDocId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(reviewerRepositoryProvider);
      final results = await Future.wait([
        repo.getRecognitionRequest(widget.requestId),
        repo.listRecognitionDocuments(widget.requestId),
      ]);
      final request = results[0] as Map<String, dynamic>?;
      if (request == null) {
        setState(() => _error = 'forbidden');
        return;
      }
      setState(() {
        _request = request;
        _documents = results[1] as List<Map<String, dynamic>>;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 404
            ? 'not_found'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _decide() async {
    if (_acting || _request == null) return;
    final l10n = AppLocalizations.of(context);
    final current = _request!['status']?.toString();
    final chosen = await showStatusDecisionSheet(
      context: context,
      options: nextRecognitionStatuses(current),
      labelBuilder: (s) => ReviewerLabels.recognitionStatus(l10n, s),
    );
    if (chosen == null || !mounted) return;
    final confirmed = await showConfirmationSheet(
      context: context,
      title: l10n.confirmRecognitionDecisionTitle,
      body: l10n.confirmRecognitionDecisionBody(
        ReviewerLabels.recognitionStatus(l10n, chosen),
      ),
    );
    if (confirmed == null || !mounted) return;

    setState(() => _acting = true);
    try {
      final data = await ref
          .read(reviewerRepositoryProvider)
          .patchRecognitionStatus(widget.requestId, chosen);
      final updated = data['recognition_request'];
      if (updated is Map<String, dynamic>) {
        setState(() => _request = updated);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.recognitionStatusUpdated)));
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 400 || e.statusCode == 409) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.statusConflictRefresh)));
        await _load();
      } else {
        final msg = e.statusCode == 403 ? l10n.forbiddenAccess : e.message;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _openDocument(RecognitionDocumentItem doc) async {
    final url = doc.fileUrl;
    if (url == null || !SecureFileService.isSafeHttpsUrl(url)) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _openingDocId = doc.id);
    try {
      final service = ref.read(secureFileServiceProvider);
      final file = await service.downloadSignedUrl(
        url: url,
        fileName: doc.title?.isNotEmpty == true ? doc.title! : doc.documentType,
      );
      await service.openFile(file);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.documentDownloadFailed)));
    } finally {
      if (mounted) setState(() => _openingDocId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final request = _request;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.recognitionRequestsTitle)),
      body: _loading && request == null
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 6),
            )
          : _error != null && request == null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : _error == 'not_found'
                  ? l10n.resourceNotFound
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : request == null
          ? EmptyState(title: l10n.resourceNotFound)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          RecognitionRequestItem(
                                request,
                              ).microCredentialTitle ??
                              l10n.recognitionRequestsTitle,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      ReviewerStatusChip(
                        label: ReviewerLabels.recognitionStatus(
                          l10n,
                          request['status']?.toString(),
                        ),
                        status: request['status']?.toString(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _section(l10n.cohortLabel, [
                    Text(RecognitionRequestItem(request).cohortTitle ?? '—'),
                  ]),
                  _section(l10n.university, [
                    Text(RecognitionRequestItem(request).universityName ?? '—'),
                  ]),
                  _section(l10n.recognitionMicroCredentialLabel, [
                    Text(
                      RecognitionRequestItem(request).microCredentialTitle ??
                          '—',
                    ),
                  ]),
                  if (request['decision_notes']?.toString().isNotEmpty == true)
                    _section(l10n.qaFindingsLabel, [
                      Text(request['decision_notes'].toString()),
                    ]),
                  const SizedBox(height: 8),
                  Text(
                    l10n.recognitionDocumentsTitle,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  if (_documents.isEmpty)
                    EmptyState(title: l10n.noRecognitionDocuments, subtitle: '')
                  else
                    for (final doc in _documents) ...[
                      _documentCard(l10n, doc),
                      const SizedBox(height: 8),
                    ],
                  const SizedBox(height: 16),
                  PrimaryButton(
                    label: l10n.decideRecognition,
                    isLoading: _acting,
                    onPressed: _acting ? null : _decide,
                  ),
                ],
              ),
            ),
    );
  }

  Widget _documentCard(AppLocalizations l10n, Map<String, dynamic> raw) {
    final doc = RecognitionDocumentItem(raw);
    final canOpen = SecureFileService.isSafeHttpsUrl(doc.fileUrl);
    final busy = _openingDocId == doc.id;
    return Card(
      child: ListTile(
        title: Text(
          doc.title?.isNotEmpty == true
              ? doc.title!
              : ReviewerLabels.humanizeSnakeCase(doc.documentType),
        ),
        subtitle: Text(ReviewerLabels.humanizeSnakeCase(doc.documentType)),
        trailing: canOpen
            ? IconButton(
                icon: busy
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.open_in_new),
                onPressed: busy ? null : () => _openDocument(doc),
                tooltip: l10n.openDocument,
              )
            : null,
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            ...children,
          ],
        ),
      ),
    );
  }
}
