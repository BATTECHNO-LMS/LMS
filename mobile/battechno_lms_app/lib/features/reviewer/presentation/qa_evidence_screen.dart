import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';

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
      appBar: AppBar(title: Text(l10n.evidenceTitle)),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                hintText: l10n.searchEvidence,
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
              onChanged: (v) => _search = v,
              onSubmitted: (_) => _load(),
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
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_items.isEmpty)
                          EmptyState(title: l10n.noEvidence, subtitle: '')
                        else
                          for (final item in _items) ...[
                            _buildCard(l10n, item),
                            const SizedBox(height: 8),
                          ],
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              evidence.title.isNotEmpty ? evidence.title : l10n.evidenceTitle,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (evidence.evidenceType.isNotEmpty)
                  ReviewerLabels.humanizeSnakeCase(evidence.evidenceType),
                if (evidence.studentName != null) evidence.studentName!,
                if (evidence.cohortTitle != null) evidence.cohortTitle!,
              ].join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (canOpen) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: busy ? null : () => _openFile(evidence),
                  icon: busy
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.open_in_new, size: 18),
                  label: Text(l10n.openEvidenceFile),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
