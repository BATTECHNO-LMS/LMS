import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
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

  int get _pendingCount {
    return _submissions.where((s) {
      final status = SubmissionReviewStatus.fromApi(
        s['review_status']?.toString() ?? s['status']?.toString(),
      );
      return status == SubmissionReviewStatus.pending;
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kInstructorPageBg,
      appBar: AppBar(
        title: Text(l10n.viewSubmissions),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading && _submissions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error != null && _submissions.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          InstSoftCard(
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.assignment_outlined,
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
                        l10n.viewSubmissions,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _pendingCount > 0
                            ? l10n.pendingSubmissionsCount(_pendingCount)
                            : l10n.viewSubmissions,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: _pendingCount > 0
                        ? BatColors.accentSoft
                        : BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_submissions.length}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: _pendingCount > 0
                          ? BatColors.accentHover
                          : BatColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_submissions.isEmpty)
            EmptyState(
              title: l10n.noSubmissions,
              icon: Icons.assignment_outlined,
            )
          else
            for (final s in _submissions)
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
        ],
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
    final pending = status == SubmissionReviewStatus.pending;
    final approved = status == SubmissionReviewStatus.approved;

    return Scaffold(
      backgroundColor: kInstructorPageBg,
      appBar: AppBar(
        title: Text(l10n.reviewSubmission),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            InstSoftCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: pending
                          ? BatColors.accentSoft
                          : BatColors.primarySoft,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.assignment_outlined,
                      color: pending
                          ? BatColors.accentHover
                          : BatColors.primary,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                                height: 1.25,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          student,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: BatColors.muted),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: approved
                                ? BatColors.success.withValues(alpha: 0.12)
                                : pending
                                ? BatColors.accentSoft
                                : const Color(0xFFEEF0F3),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            InstructorLabels.reviewStatusAr(status),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: approved
                                      ? BatColors.successText
                                      : pending
                                      ? BatColors.accentHover
                                      : const Color(0xFF8B93A0),
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            InstSoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (projectUrl != null && projectUrl.isNotEmpty) ...[
                    OutlinedButton.icon(
                      onPressed: () async {
                        final uri = Uri.tryParse(projectUrl);
                        if (uri != null &&
                            SecureFileService.isSafeHttpsUrl(projectUrl)) {
                          await launchUrl(
                            uri,
                            mode: LaunchMode.externalApplication,
                          );
                        }
                      },
                      icon: const Icon(Icons.link),
                      label: Text(l10n.projectUrl),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: BatColors.primary,
                        side: const BorderSide(color: Color(0xFFE6E8EC)),
                        backgroundColor: const Color(0xFFF7F8FA),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  OutlinedButton.icon(
                    onPressed: _download,
                    icon: const Icon(Icons.download_outlined),
                    label: Text(l10n.downloadAttachment),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: BatColors.primary,
                      side: const BorderSide(color: Color(0xFFE6E8EC)),
                      backgroundColor: const Color(0xFFF7F8FA),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            InstSoftCard(
              child: TextField(
                controller: _feedbackCtrl,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: l10n.instructorFeedback,
                  filled: true,
                  fillColor: const Color(0xFFF7F8FA),
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(
                      color: BatColors.primary,
                      width: 1.4,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving
                    ? null
                    : () => _review(SubmissionReviewStatus.approved),
                style: FilledButton.styleFrom(
                  backgroundColor: BatColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: BatColors.primary.withValues(
                    alpha: 0.5,
                  ),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        l10n.approveSubmission,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _saving
                    ? null
                    : () => _review(SubmissionReviewStatus.needsRevision),
                style: OutlinedButton.styleFrom(
                  foregroundColor: BatColors.accentHover,
                  side: BorderSide(
                    color: BatColors.accentHover.withValues(alpha: 0.35),
                  ),
                  backgroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  l10n.requestRevision,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _saving
                    ? null
                    : () => _review(SubmissionReviewStatus.rejected),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF8B93A0),
                  side: const BorderSide(color: Color(0xFFE6E8EC)),
                  backgroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  l10n.rejectSubmission,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
