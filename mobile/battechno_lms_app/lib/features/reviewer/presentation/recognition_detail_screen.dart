import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
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
    final item = request != null ? RecognitionRequestItem(request) : null;
    final title = item?.microCredentialTitle ?? l10n.recognitionRequestsTitle;
    final status = request?['status']?.toString();

    return Scaffold(
      backgroundColor: kReviewerPageBg,
      appBar: AppBar(
        title: Text(l10n.recognitionRequestsTitle),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: _loading && request == null
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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  children: [
                    ReviewerSoftCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: BatColors.primarySoft,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(
                              Icons.workspace_premium_outlined,
                              color: BatColors.primary,
                              size: 26,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        color: BatColors.heading,
                                        height: 1.25,
                                      ),
                                ),
                                const SizedBox(height: 8),
                                ReviewerStatusChip(
                                  label: ReviewerLabels.recognitionStatus(
                                    l10n,
                                    status,
                                  ),
                                  status: status,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ReviewerSoftCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.opportunityInfo,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                ),
                          ),
                          const SizedBox(height: 14),
                          ReviewerMetaRow(
                            icon: Icons.groups_outlined,
                            label: l10n.cohortLabel,
                            value: item?.cohortTitle ?? '—',
                          ),
                          const SizedBox(height: 12),
                          ReviewerMetaRow(
                            icon: Icons.school_outlined,
                            label: l10n.university,
                            value: item?.universityName ?? '—',
                          ),
                          const SizedBox(height: 12),
                          ReviewerMetaRow(
                            icon: Icons.badge_outlined,
                            label: l10n.recognitionMicroCredentialLabel,
                            value: item?.microCredentialTitle ?? '—',
                          ),
                        ],
                      ),
                    ),
                    if (request['decision_notes']?.toString().isNotEmpty ==
                        true) ...[
                      const SizedBox(height: 12),
                      ReviewerSoftCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.qaFindingsLabel,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: BatColors.heading,
                                  ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              request['decision_notes'].toString(),
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    color: BatColors.heading,
                                    height: 1.4,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    Text(
                      l10n.recognitionDocumentsTitle,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (_documents.isEmpty)
                      ReviewerSoftCard(
                        child: Text(
                          l10n.noRecognitionDocuments,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: BatColors.muted),
                        ),
                      )
                    else
                      for (final doc in _documents) ...[
                        _documentCard(l10n, doc),
                        const SizedBox(height: 10),
                      ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _acting ? null : _decide,
                        style: FilledButton.styleFrom(
                          backgroundColor: BatColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: _acting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                l10n.decideRecognition,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _documentCard(AppLocalizations l10n, Map<String, dynamic> raw) {
    final doc = RecognitionDocumentItem(raw);
    final canOpen = SecureFileService.isSafeHttpsUrl(doc.fileUrl);
    final busy = _openingDocId == doc.id;
    final docTitle = doc.title?.isNotEmpty == true
        ? doc.title!
        : ReviewerLabels.humanizeSnakeCase(doc.documentType);

    return ReviewerSoftCard(
      onTap: canOpen && !busy ? () => _openDocument(doc) : null,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.description_outlined,
              color: BatColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  docTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  ReviewerLabels.humanizeSnakeCase(doc.documentType),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
            ),
          ),
          if (canOpen)
            busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(
                    Icons.open_in_new,
                    color: BatColors.primary,
                    size: 20,
                  ),
        ],
      ),
    );
  }
}
