import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';

class InstructorTrainingDetailScreen extends ConsumerStatefulWidget {
  const InstructorTrainingDetailScreen({
    super.key,
    required this.opportunityId,
  });

  final String opportunityId;

  @override
  ConsumerState<InstructorTrainingDetailScreen> createState() =>
      _InstructorTrainingDetailScreenState();
}

class _InstructorTrainingDetailScreenState
    extends ConsumerState<InstructorTrainingDetailScreen> {
  Map<String, dynamic>? _opportunity;
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
      final data = await ref
          .read(instructorRepositoryProvider)
          .getOpportunity(widget.opportunityId);
      final opp = data['opportunity'];
      setState(() {
        _opportunity = opp is Map<String, dynamic> ? opp : data;
      });
    } on ApiException catch (e) {
      setState(() {
        if (e.statusCode == 403) {
          _error = 'forbidden';
        } else if (e.statusCode == 404) {
          _error = 'not_found';
        } else {
          _error = e.isNetwork ? 'network' : e.message;
        }
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _mapError(AppLocalizations l10n) {
    switch (_error) {
      case 'forbidden':
        return l10n.forbiddenAccess;
      case 'not_found':
        return l10n.resourceNotFound;
      case 'network':
        return l10n.networkErrorBody;
      default:
        return _error ?? l10n.resourceNotFound;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.myTrainings)),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 6),
        ),
      );
    }
    if (_error != null && _opportunity == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.myTrainings)),
        body: RetryView(
          title: l10n.networkErrorTitle,
          message: _mapError(l10n),
          onRetry: _load,
        ),
      );
    }

    final opp = InstructorOpportunity(_opportunity ?? {});
    final id = widget.opportunityId;

    return Scaffold(
      appBar: AppBar(title: Text(opp.title)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.opportunityInfo,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    _row(
                      l10n.certificateStatus,
                      InstructorLabels.statusAr(opp.status),
                    ),
                    _row(l10n.specialty, opp.specialtyName ?? '—'),
                    _row('', InstructorLabels.modeAr(opp.trainingMode)),
                    _row(
                      l10n.requiredHoursLabel,
                      opp.requiredHours?.toString() ?? l10n.hoursNotSpecified,
                    ),
                    if (opp.startDate != null || opp.endDate != null)
                      _row(
                        '',
                        '${opp.startDate ?? '—'} → ${opp.endDate ?? '—'}',
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            InfoBanner(message: l10n.hoursRecordedPerStudentHint),
            const SizedBox(height: 16),
            Text(
              l10n.quickActions,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _nav(l10n.viewParticipants, Icons.groups_outlined, () {
              context.push('/instructor/field-training/$id/participants');
            }),
            _nav(l10n.viewSessions, Icons.event_outlined, () {
              context.push('/instructor/field-training/$id/sessions');
            }),
            _nav(l10n.viewSubmissions, Icons.assignment_outlined, () {
              context.push('/instructor/field-training/$id/submissions');
            }),
            _nav(l10n.viewAssessmentResults, Icons.quiz_outlined, () {
              context.push('/instructor/field-training/$id/assessments');
            }),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          if (label.isNotEmpty) ...[
            Expanded(child: Text(label)),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ] else
            Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _nav(String label, IconData icon, VoidCallback onTap) {
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(label),
        trailing: const Icon(Icons.chevron_left),
        onTap: onTap,
      ),
    );
  }
}
