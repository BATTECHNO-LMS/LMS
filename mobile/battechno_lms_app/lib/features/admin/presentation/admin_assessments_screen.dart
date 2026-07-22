import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';

class AdminAssessmentsScreen extends ConsumerStatefulWidget {
  const AdminAssessmentsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminAssessmentsScreen> createState() =>
      _AdminAssessmentsScreenState();
}

class _AdminAssessmentsScreenState
    extends ConsumerState<AdminAssessmentsScreen> {
  List<Map<String, dynamic>> _assessments = const [];
  bool _loading = true;
  String? _error;

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
      final list = await ref
          .read(adminRepositoryProvider)
          .listAssessments(widget.opportunityId);
      setState(() => _assessments = list);
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
      appBar: AppBar(title: Text(l10n.assessmentResults)),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 4),
            )
          : _error != null
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
                  if (_assessments.isEmpty)
                    EmptyState(title: l10n.noAssessmentResults, subtitle: '')
                  else
                    for (final assessment in _assessments) ...[
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                assessment['title']?.toString() ??
                                    (assessment['type']?.toString() == 'pre'
                                        ? l10n.preAssessment
                                        : l10n.postAssessment),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                assessment['type']?.toString() == 'pre'
                                    ? l10n.preAssessment
                                    : l10n.postAssessment,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }
}
