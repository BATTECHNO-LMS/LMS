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
      appBar: AppBar(
        title: Text(l10n.taskDetails),
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

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            task['title']?.toString() ?? l10n.taskUntitled,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (task['due_date'] != null)
            Text('${l10n.dueDate}: ${task['due_date']}'),
          const SizedBox(height: 16),
          if (task['description'] != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(task['description'].toString()),
              ),
            ),
          if (task['ai_self_evaluation_prompt'] != null) ...[
            const SizedBox(height: 12),
            InfoBanner(message: task['ai_self_evaluation_prompt'].toString()),
          ],
          if (submission != null) ...[
            const SizedBox(height: 16),
            AcademicSectionHeader(title: l10n.previousSubmission),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      FieldTrainingLabels.reviewStatusAr(
                        submission['review_status']?.toString(),
                      ),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (submission['submitted_at'] != null)
                      Text(
                        '${l10n.submittedAt}: ${submission['submitted_at']}',
                      ),
                    if (submission['project_url'] != null)
                      Text(submission['project_url'].toString()),
                    if (submission['instructor_feedback'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          submission['instructor_feedback'].toString(),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 20),
          AcademicSectionHeader(title: l10n.submitTask),
          const SizedBox(height: 8),
          if (requiresAi)
            InfoBanner(message: l10n.aiTaskMobileLimited)
          else ...[
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
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.attach_file),
              label: Text(_pickedFileName ?? l10n.attachFileOptional),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.fileUploadHint,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: l10n.submitTask,
              isLoading: _submitting,
              onPressed: _submit,
            ),
          ],
        ],
      ),
    );
  }
}
