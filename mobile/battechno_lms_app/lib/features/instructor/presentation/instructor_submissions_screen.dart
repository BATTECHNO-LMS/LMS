import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorSubmissionsScreen extends ConsumerStatefulWidget {
  const InstructorSubmissionsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<InstructorSubmissionsScreen> createState() =>
      _InstructorSubmissionsScreenState();
}

class _InstructorSubmissionsScreenState
    extends ConsumerState<InstructorSubmissionsScreen> {
  List<Map<String, dynamic>> _submissions = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref
          .read(instructorRepositoryProvider)
          .listSubmissions(widget.opportunityId, userId: user?.id);
      setState(() => _submissions = list);
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.viewSubmissions)),
      body: _loading && _submissions.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 4),
            )
          : _error != null && _submissions.isEmpty
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
                  if (_submissions.isEmpty)
                    EmptyState(title: l10n.noSubmissions, subtitle: '')
                  else
                    for (final s in _submissions) ...[
                      SubmissionReviewCard(
                        submission: s,
                        onTap: () {
                          final id = s['id']?.toString();
                          if (id == null) return;
                          context.push(
                            '/instructor/field-training/${widget.opportunityId}/submissions/$id',
                            extra: s,
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }
}

class InstructorSubmissionReviewScreen extends ConsumerStatefulWidget {
  const InstructorSubmissionReviewScreen({
    super.key,
    required this.opportunityId,
    required this.submissionId,
    this.initial,
  });

  final String opportunityId;
  final String submissionId;
  final Map<String, dynamic>? initial;

  @override
  ConsumerState<InstructorSubmissionReviewScreen> createState() =>
      _InstructorSubmissionReviewScreenState();
}

class _InstructorSubmissionReviewScreenState
    extends ConsumerState<InstructorSubmissionReviewScreen> {
  late Map<String, dynamic> _submission;
  final _feedbackCtrl = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _submission = Map<String, dynamic>.from(widget.initial ?? {});
    _feedbackCtrl.text = _submission['instructor_feedback']?.toString() ?? '';
  }

  @override
  void dispose() {
    _feedbackCtrl.dispose();
    super.dispose();
  }

  Future<void> _review(SubmissionReviewStatus status) async {
    final l10n = AppLocalizations.of(context);
    final feedback = _feedbackCtrl.text.trim();
    if ((status == SubmissionReviewStatus.needsRevision ||
            status == SubmissionReviewStatus.rejected) &&
        feedback.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.feedbackRequired)));
      return;
    }
    setState(() => _saving = true);
    try {
      final data = await ref
          .read(instructorRepositoryProvider)
          .reviewSubmission(
            submissionId: widget.submissionId,
            reviewStatus: status.apiValue,
            feedback: feedback.isEmpty ? null : feedback,
          );
      final updated = data['submission'];
      if (updated is Map<String, dynamic>) {
        setState(() => _submission = updated);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.reviewSaved)));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : e.statusCode == 422
          ? l10n.validationError
          : e.message;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _download() async {
    final l10n = AppLocalizations.of(context);
    try {
      final data = await ref
          .read(instructorRepositoryProvider)
          .getSubmissionDownloadUrl(widget.submissionId);
      final url = data['url']?.toString();
      final service = ref.read(secureFileServiceProvider);
      File file;
      if (url != null && SecureFileService.isSafeHttpsUrl(url)) {
        file = await service.downloadSignedUrl(
          url: url,
          fileName: 'submission',
        );
      } else {
        file = await service.downloadAuthenticated(
          path: ref
              .read(apiClientProvider)
              .endpoints
              .instructorSubmissionDownload(widget.submissionId),
          fileName: 'submission',
        );
      }
      await service.openFile(file);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.documentDownloadFailed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final student =
        _submission['student_name']?.toString() ??
        (_submission['student'] is Map
            ? (_submission['student'] as Map)['full_name']?.toString()
            : null) ??
        '—';
    final task =
        _submission['task_title']?.toString() ??
        (_submission['task'] is Map
            ? (_submission['task'] as Map)['title']?.toString()
            : null) ??
        '—';
    final projectUrl = _submission['project_url']?.toString();
    final status = SubmissionReviewStatus.fromApi(
      _submission['review_status']?.toString(),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.reviewSubmission)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            task,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: 4),
          Text(student),
          Text(InstructorLabels.reviewStatusAr(status)),
          const SizedBox(height: 12),
          if (projectUrl != null && projectUrl.isNotEmpty)
            OutlinedButton.icon(
              onPressed: () async {
                final uri = Uri.tryParse(projectUrl);
                if (uri != null &&
                    SecureFileService.isSafeHttpsUrl(projectUrl)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
              icon: const Icon(Icons.link),
              label: Text(l10n.projectUrl),
            ),
          OutlinedButton.icon(
            onPressed: _download,
            icon: const Icon(Icons.download_outlined),
            label: Text(l10n.downloadAttachment),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _feedbackCtrl,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: l10n.instructorFeedback,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: l10n.approveSubmission,
            onPressed: _saving
                ? null
                : () => _review(SubmissionReviewStatus.approved),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _saving
                ? null
                : () => _review(SubmissionReviewStatus.needsRevision),
            child: Text(l10n.requestRevision),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _saving
                ? null
                : () => _review(SubmissionReviewStatus.rejected),
            child: Text(l10n.rejectSubmission),
          ),
        ],
      ),
    );
  }
}
