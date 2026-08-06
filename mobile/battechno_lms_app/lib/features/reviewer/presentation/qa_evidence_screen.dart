import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

/// Read-only evidence list shared by `qa_officer` and `university_reviewer`
/// (`canReadEvidence`). No create/edit — evidence writes stay staff-only.
class QaEvidenceScreen extends ConsumerStatefulWidget {
  const QaEvidenceScreen({super.key});

  @override
  ConsumerState<QaEvidenceScreen> createState() => _QaEvidenceScreenState();
}

class _QaEvidenceScreenState extends ConsumerState<QaEvidenceScreen> {
  String _search = '';
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;
  String? _openingId;

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
      final page = await ref
          .read(reviewerRepositoryProvider)
          .listEvidence(search: _search);
      setState(() => _items = page.items);
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 403
            ? 'forbidden'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openFile(EvidenceItem evidence) async {
    final url = evidence.fileUrl;
    if (url == null || !SecureFileService.isSafeHttpsUrl(url)) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _openingId = evidence.id);
    try {
      final service = ref.read(secureFileServiceProvider);
      final File file = await service.downloadSignedUrl(
        url: url,
        fileName: evidence.title.isNotEmpty ? evidence.title : 'evidence',
      );
      await service.openFile(file);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.documentDownloadFailed)));
    } finally {
      if (mounted) setState(() => _openingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kReviewerPageBg,
      appBar: AppBar(
        title: Text(l10n.evidenceTitle),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: ReviewerSoftCard(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
              child: TextField(
                decoration:
                    reviewerSoftFieldDecoration(
                      '',
                      hint: l10n.searchEvidence,
                    ).copyWith(
                      prefixIcon: const Icon(
                        Icons.search,
                        color: BatColors.primaryLight,
                      ),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                onChanged: (v) => _search = v,
                onSubmitted: (_) => _load(),
              ),
            ),
          ),
          Expanded(
            child: _loading && _items.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: LoadingSkeleton(lines: 4),
                  )
                : _error != null && _items.isEmpty
                ? RetryView(
                    title: l10n.networkErrorTitle,
                    message: _error == 'forbidden'
                        ? l10n.forbiddenAccess
                        : l10n.networkErrorBody,
                    onRetry: _load,
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                      children: [
                        if (_items.isEmpty)
                          EmptyState(title: l10n.noEvidence, subtitle: '')
                        else
                          for (final item in _items) _buildCard(l10n, item),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(AppLocalizations l10n, Map<String, dynamic> item) {
    final evidence = EvidenceItem(item);
    final canOpen = SecureFileService.isSafeHttpsUrl(evidence.fileUrl);
    final busy = _openingId == evidence.id;
    final subtitle = [
      if (evidence.evidenceType.isNotEmpty)
        ReviewerLabels.humanizeSnakeCase(evidence.evidenceType),
      if (evidence.studentName != null) evidence.studentName!,
      if (evidence.cohortTitle != null) evidence.cohortTitle!,
    ].join(' · ');

    return ReviewerSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.folder_open_outlined,
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
                      evidence.title.isNotEmpty
                          ? evidence.title
                          : l10n.evidenceTitle,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                        height: 1.25,
                      ),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: BatColors.muted,
                          height: 1.35,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (canOpen) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: busy ? null : () => _openFile(evidence),
                style: FilledButton.styleFrom(
                  backgroundColor: BatColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: busy
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.open_in_new, size: 18),
                label: Text(
                  l10n.openEvidenceFile,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
