import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';
import 'widgets/admin_widgets.dart';

class AdminOpportunityDetailScreen extends ConsumerStatefulWidget {
  const AdminOpportunityDetailScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminOpportunityDetailScreen> createState() =>
      _AdminOpportunityDetailScreenState();
}

class _AdminOpportunityDetailScreenState
    extends ConsumerState<AdminOpportunityDetailScreen> {
  Map<String, dynamic>? _opportunity;
  bool _loading = true;
  String? _error;
  bool _acting = false;

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
          .read(adminRepositoryProvider)
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

  PreferredSizeWidget _appBar(String title, {List<Widget>? actions}) {
    return AppBar(
      title: Text(title),
      actions: actions,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      foregroundColor: BatColors.heading,
      elevation: 0,
      leading: BackButton(onPressed: () => context.pop()),
    );
  }

  Future<void> _confirmAndRun({
    required String title,
    required String body,
    required Future<void> Function() action,
    required String successMessage,
  }) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              body,
              style: Theme.of(
                ctx,
              ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(
                backgroundColor: BatColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                l10n.continueAction,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(ctx, false),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF8B93A0),
                side: const BorderSide(color: Color(0xFFE6E8EC)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(
                l10n.stayAndEdit,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    setState(() => _acting = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : e.statusCode == 404
          ? l10n.resourceNotFound
          : e.message;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _publish() async {
    final l10n = AppLocalizations.of(context);
    await _confirmAndRun(
      title: l10n.publishOpportunity,
      body: l10n.confirmPublishBody,
      action: () =>
          ref.read(adminRepositoryProvider).publish(widget.opportunityId),
      successMessage: l10n.opportunityPublished,
    );
  }

  Future<void> _archive() async {
    final l10n = AppLocalizations.of(context);
    await _confirmAndRun(
      title: l10n.archiveOpportunity,
      body: l10n.confirmArchiveBody,
      action: () =>
          ref.read(adminRepositoryProvider).archive(widget.opportunityId),
      successMessage: l10n.opportunityArchived,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading) {
      return Scaffold(
        backgroundColor: kAdminPageBg,
        appBar: _appBar(l10n.opportunities),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 6),
        ),
      );
    }
    if (_error != null && _opportunity == null) {
      return Scaffold(
        backgroundColor: kAdminPageBg,
        appBar: _appBar(l10n.opportunities),
        body: RetryView(
          title: l10n.networkErrorTitle,
          message: _mapError(l10n),
          onRetry: _load,
        ),
      );
    }

    final opp = AdminOpportunity(_opportunity ?? {});
    final id = widget.opportunityId;

    return Scaffold(
      backgroundColor: kAdminPageBg,
      appBar: _appBar(
        opp.title,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: l10n.editOpportunity,
            onPressed: () => context.push('/admin/field-training/$id/edit'),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              AdminSoftCard(
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
                              AdminLabels.statusAr(opp.status),
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
              AdminSoftCard(
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
                    AdminMetaRow(
                      icon: Icons.verified_outlined,
                      label: l10n.certificateStatus,
                      value: AdminLabels.statusAr(opp.status),
                    ),
                    const SizedBox(height: 12),
                    AdminMetaRow(
                      icon: Icons.category_outlined,
                      label: l10n.specialty,
                      value: opp.specialtyName ?? '—',
                    ),
                    const SizedBox(height: 12),
                    AdminMetaRow(
                      icon: Icons.school_outlined,
                      label: l10n.trainingModeLabel,
                      value: AdminLabels.modeAr(opp.trainingMode),
                    ),
                    const SizedBox(height: 12),
                    AdminMetaRow(
                      icon: Icons.schedule_outlined,
                      label: l10n.requiredHoursLabel,
                      value:
                          opp.requiredHours?.toString() ??
                          l10n.hoursNotSpecified,
                    ),
                    const SizedBox(height: 12),
                    AdminMetaRow(
                      icon: Icons.person_outline,
                      label: l10n.assignedInstructorLabel,
                      value: opp.instructorName ?? '—',
                    ),
                    if (opp.startDate != null || opp.endDate != null) ...[
                      const SizedBox(height: 12),
                      AdminMetaRow(
                        icon: Icons.date_range_outlined,
                        label: l10n.trainingDates,
                        value:
                            '${opp.startDate ?? '—'} → ${opp.endDate ?? '—'}',
                      ),
                    ],
                  ],
                ),
              ),
              if (opp.needsEligibilitySetup) ...[
                const SizedBox(height: 12),
                AdminSoftCard(
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
                          Icons.warning_amber_outlined,
                          color: BatColors.accentHover,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          l10n.needsEligibilitySetupNotice,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: BatColors.heading, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  if (opp.status == 'draft')
                    Expanded(
                      child: FilledButton(
                        onPressed: _acting ? null : _publish,
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
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                l10n.publishOpportunity,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
                  if (opp.status == 'published' ||
                      opp.status == 'in_progress') ...[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _acting ? null : _archive,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF8B93A0),
                          side: const BorderSide(color: Color(0xFFE6E8EC)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          l10n.archiveOpportunity,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ],
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
              AdminActionTile(
                icon: Icons.fact_check_outlined,
                label: l10n.reviewApplications,
                onTap: () =>
                    context.push('/admin/field-training/$id/applications'),
              ),
              AdminActionTile(
                icon: Icons.event_outlined,
                label: l10n.viewSessions,
                onTap: () => context.push('/admin/field-training/$id/sessions'),
              ),
              AdminActionTile(
                icon: Icons.assignment_outlined,
                label: l10n.viewSubmissions,
                onTap: () =>
                    context.push('/admin/field-training/$id/submissions'),
              ),
              AdminActionTile(
                icon: Icons.quiz_outlined,
                label: l10n.viewAssessmentResults,
                onTap: () =>
                    context.push('/admin/field-training/$id/assessments'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
