import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

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

  PreferredSizeWidget _appBar(String title) {
    return AppBar(
      title: Text(title),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: BatColors.heading,
      elevation: 0,
      leading: BackButton(onPressed: () => context.pop()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading) {
      return Scaffold(
        backgroundColor: kInstructorPageBg,
        appBar: _appBar(l10n.myTrainings),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 6),
        ),
      );
    }
    if (_error != null && _opportunity == null) {
      return Scaffold(
        backgroundColor: kInstructorPageBg,
        appBar: _appBar(l10n.myTrainings),
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
      backgroundColor: kInstructorPageBg,
      appBar: _appBar(opp.title),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
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
                        color: BatColors.primarySoft,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(
                        Icons.hiking_outlined,
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
                            opp.title,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: BatColors.heading,
                                  height: 1.25,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: BatColors.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              InstructorLabels.statusAr(opp.status),
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: BatColors.primary,
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.opportunityInfo,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _InfoRow(
                      icon: Icons.category_outlined,
                      label: l10n.specialty,
                      value: opp.specialtyName ?? '—',
                    ),
                    const SizedBox(height: 12),
                    _InfoRow(
                      icon: Icons.school_outlined,
                      label: InstructorLabels.modeAr(opp.trainingMode),
                      value: '',
                      valueAsLabel: true,
                    ),
                    const SizedBox(height: 12),
                    _InfoRow(
                      icon: Icons.schedule_outlined,
                      label: l10n.requiredHoursLabel,
                      value:
                          opp.requiredHours?.toString() ??
                          l10n.hoursNotSpecified,
                    ),
                    if (opp.startDate != null || opp.endDate != null) ...[
                      const SizedBox(height: 12),
                      _InfoRow(
                        icon: Icons.date_range_outlined,
                        label: l10n.trainingDates,
                        value:
                            '${opp.startDate ?? '—'} → ${opp.endDate ?? '—'}',
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              InstSoftCard(
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
                        l10n.hoursRecordedPerStudentHint,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.heading,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Text(
                l10n.quickActions,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 10),
              _ActionTile(
                icon: Icons.groups_outlined,
                label: l10n.viewParticipants,
                onTap: () =>
                    context.push('/instructor/field-training/$id/participants'),
              ),
              _ActionTile(
                icon: Icons.event_outlined,
                label: l10n.viewSessions,
                onTap: () =>
                    context.push('/instructor/field-training/$id/sessions'),
              ),
              _ActionTile(
                icon: Icons.assignment_outlined,
                label: l10n.viewSubmissions,
                onTap: () =>
                    context.push('/instructor/field-training/$id/submissions'),
              ),
              _ActionTile(
                icon: Icons.quiz_outlined,
                label: l10n.viewAssessmentResults,
                onTap: () =>
                    context.push('/instructor/field-training/$id/assessments'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueAsLabel = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool valueAsLabel;

  @override
  Widget build(BuildContext context) {
    if (valueAsLabel || value.isEmpty) {
      return Row(
        children: [
          Icon(icon, size: 18, color: BatColors.primaryLight),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: BatColors.heading,
              ),
            ),
          ),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BatColors.primaryLight),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InstSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: BatColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
      ),
    );
  }
}
