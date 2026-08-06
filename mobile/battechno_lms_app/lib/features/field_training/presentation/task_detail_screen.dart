import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/field_training_models.dart';
import 'widgets/field_training_widgets.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  const TaskDetailScreen({
    super.key,
    required this.taskId,
    required this.opportunityId,
    this.initialTask,
  });

  final String taskId;
  final String opportunityId;
  final Map<String, dynamic>? initialTask;

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  Map<String, dynamic>? _task;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _pickedFileName;
  String? _pickedFilePath;

  final _urlController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _task = widget.initialTask;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _urlController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final bundle = await ref
          .read(fieldTrainingRepositoryProvider)
          .loadDetail(widget.opportunityId);
      final match = bundle.tasks.cast<Map<String, dynamic>?>().firstWhere(
        (t) => t?['id']?.toString() == widget.taskId,
        orElse: () => _task,
      );
      setState(() => _task = match ?? _task);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'],
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    setState(() {
      _pickedFileName = file.name;
      _pickedFilePath = file.path;
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final task = _task;
    if (task == null) return;

    final requiresAi = task['requires_ai_self_evaluation'] == true;
    final validation = TaskSubmissionValidator.validate(
      notes: _notesController.text,
      projectUrl: _urlController.text,
      requiresAi: requiresAi,
      hasFile: _pickedFilePath != null,
    );
    if (validation != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(validation)));
      return;
    }

    setState(() => _submitting = true);
    try {
      final repo = ref.read(fieldTrainingRepositoryProvider);
      if (_pickedFilePath != null) {
        await repo.submitTaskWithFile(
          taskId: widget.taskId,
          filePath: _pickedFilePath!,
          fileName: _pickedFileName ?? 'submission',
          projectUrl: _urlController.text,
          finalNotes: _notesController.text,
        );
      } else {
        await repo.submitTask(
          taskId: widget.taskId,
          projectUrl: _urlController.text,
          finalNotes: _notesController.text,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.taskSubmitSuccess)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: kFtPageBg,
      appBar: AppBar(
        title: Text(l10n.taskDetails),
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
    if (_loading && _task == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final task = _task;
    if (task == null) {
      return EmptyState(title: l10n.taskNotFound);
    }

    final submission = JsonHelpers.map(task['submission']);
    final requiresAi = task['requires_ai_self_evaluation'] == true;
    final reviewStatus = submission?['review_status']?.toString();
    final approved = reviewStatus == 'approved';
    final hasSubmission = submission != null;
    final dueDate = task['due_date']?.toString();
    final description = task['description']?.toString();
    final aiPrompt = task['ai_self_evaluation_prompt']?.toString();

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FtSoftCard(
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
                    child: Icon(
                      hasSubmission
                          ? Icons.task_alt_rounded
                          : Icons.task_outlined,
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
                          task['title']?.toString() ?? l10n.taskUntitled,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                                height: 1.25,
                              ),
                        ),
                        if (dueDate != null && dueDate.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            '${l10n.dueDate}: $dueDate',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: BatColors.muted),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: approved
                                ? BatColors.success.withValues(alpha: 0.12)
                                : const Color(0xFFEEF0F3),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            FieldTrainingLabels.reviewStatusAr(
                              hasSubmission ? reviewStatus : null,
                            ),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: approved
                                      ? BatColors.successText
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
            if (description != null && description.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(
                l10n.description,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 10),
              FtSoftCard(
                child: Text(
                  description,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: BatColors.heading,
                    height: 1.45,
                  ),
                ),
              ),
            ],
            if (aiPrompt != null && aiPrompt.isNotEmpty) ...[
              const SizedBox(height: 12),
              FtSoftCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: BatColors.accentSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.auto_awesome_outlined,
                        color: BatColors.accentHover,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        aiPrompt,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.heading,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (submission != null) ...[
              const SizedBox(height: 18),
              Text(
                l10n.previousSubmission,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 10),
              FtSoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: approved
                            ? BatColors.success.withValues(alpha: 0.12)
                            : const Color(0xFFEEF0F3),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        FieldTrainingLabels.reviewStatusAr(reviewStatus),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: approved
                              ? BatColors.successText
                              : const Color(0xFF8B93A0),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (submission['submitted_at'] != null) ...[
                      const SizedBox(height: 12),
                      _MetaRow(
                        icon: Icons.schedule_outlined,
                        label: l10n.submittedAt,
                        value: submission['submitted_at'].toString(),
                      ),
                    ],
                    if (submission['project_url'] != null) ...[
                      const SizedBox(height: 10),
                      _MetaRow(
                        icon: Icons.link_outlined,
                        label: l10n.projectUrl,
                        value: submission['project_url'].toString(),
                      ),
                    ],
                    if (submission['instructor_feedback'] != null &&
                        submission['instructor_feedback']
                            .toString()
                            .isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF7F8FA),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          submission['instructor_feedback'].toString(),
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: BatColors.heading, height: 1.4),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 18),
            Text(
              l10n.submitTask,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 10),
            if (requiresAi)
              FtSoftCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: BatColors.accentSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.info_outline,
                        color: BatColors.accentHover,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l10n.aiTaskMobileLimited,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.heading,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              )
            else
              FtSoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppTextField(
                      controller: _urlController,
                      label: l10n.projectUrl,
                      keyboardType: TextInputType.url,
                    ),
                    const SizedBox(height: 12),
                    AppTextField(
                      controller: _notesController,
                      label: l10n.submissionNotes,
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      onPressed: _pickFile,
                      icon: const Icon(Icons.attach_file),
                      label: Text(_pickedFileName ?? l10n.attachFileOptional),
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
                    const SizedBox(height: 8),
                    Text(
                      l10n.fileUploadHint,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _submitting ? null : _submit,
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
                        child: _submitting
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                l10n.submitTask,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BatColors.primaryLight),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: BatColors.heading,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
