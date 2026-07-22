import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/admin_models.dart';

class AdminPriorityCard extends StatelessWidget {
  const AdminPriorityCard({
    super.key,
    required this.action,
    required this.onTap,
  });

  final AdminPriorityAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (title, icon) = _copy(l10n);
    return Card(
      color: BatColors.primary.withValues(alpha: 0.06),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: BatColors.accent.withValues(alpha: 0.25),
                child: Icon(icon, color: BatColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      action.title,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left),
            ],
          ),
        ),
      ),
    );
  }

  (String, IconData) _copy(AppLocalizations l10n) {
    switch (action.type) {
      case AdminPriorityType.reviewSubmissions:
        return (
          l10n.pendingSubmissionsCount(action.count ?? 0),
          Icons.assignment_turned_in_outlined,
        );
      case AdminPriorityType.reviewApplications:
        return (
          l10n.adminPendingApplicationsCount(action.count ?? 0),
          Icons.fact_check_outlined,
        );
      case AdminPriorityType.completeSetup:
        return (l10n.adminPriorityCompleteSetup, Icons.rule_folder_outlined);
    }
  }
}

class AdminOpportunityCard extends StatelessWidget {
  const AdminOpportunityCard({
    super.key,
    required this.opportunity,
    required this.onTap,
  });

  final AdminOpportunity opportunity;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      opportunity.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  StatusChip(
                    label: AdminLabels.statusAr(opportunity.status),
                    color: BatColors.primary,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (opportunity.specialtyName != null)
                Text(opportunity.specialtyName!),
              Text(
                '${AdminLabels.modeAr(opportunity.trainingMode)}'
                '${opportunity.startDate != null ? ' · ${opportunity.startDate}' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _meta(
                    Icons.groups_outlined,
                    '${opportunity.participantsCount} ${l10n.students}',
                  ),
                  _meta(
                    Icons.event_outlined,
                    '${opportunity.sessionsCount} ${l10n.sessions}',
                  ),
                  if (opportunity.pendingSubmissionsCount > 0)
                    _meta(
                      Icons.assignment_late_outlined,
                      l10n.pendingSubmissionsCount(
                        opportunity.pendingSubmissionsCount,
                      ),
                    ),
                  if (opportunity.instructorName != null)
                    _meta(Icons.person_outline, opportunity.instructorName!),
                  if (opportunity.needsEligibilitySetup)
                    _meta(
                      Icons.warning_amber_outlined,
                      l10n.needsEligibilitySetupNotice,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class AdminApplicationCard extends StatelessWidget {
  const AdminApplicationCard({
    super.key,
    required this.application,
    required this.onTap,
    this.onApprove,
    this.onReject,
  });

  final Map<String, dynamic> application;
  final VoidCallback onTap;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final name = application['student_name']?.toString() ?? '—';
    final university = application['student_university']?.toString();
    final status = application['status']?.toString() ?? '';
    final pending = status == 'pending';

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            onTap: onTap,
            leading: CircleAvatar(
              child: Text(name.isNotEmpty ? name.characters.first : '?'),
            ),
            title: Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              [
                if (university != null && university.isNotEmpty) university,
                AdminLabels.statusAr(status),
              ].join(' · '),
            ),
            trailing: const Icon(Icons.chevron_left),
          ),
          if (pending && (onApprove != null || onReject != null))
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onReject,
                      child: Text(l10n.rejectApplication),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: PrimaryButton(
                      label: l10n.approveApplication,
                      onPressed: onApprove,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class AdminStudentSummaryCard extends StatelessWidget {
  const AdminStudentSummaryCard({
    super.key,
    required this.application,
    required this.onTap,
  });

  final Map<String, dynamic> application;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final name = application['student_name']?.toString() ?? '—';
    final opportunityTitle = application['opportunity_title']?.toString();
    final trainingStatus =
        application['training_status']?.toString() ??
        application['status']?.toString() ??
        '';
    final completed = application['completed_training_hours'];
    final required = application['required_training_hours'];

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          child: Text(name.isNotEmpty ? name.characters.first : '?'),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          [
            if (opportunityTitle != null && opportunityTitle.isNotEmpty)
              opportunityTitle,
            AdminLabels.statusAr(trainingStatus),
            if (completed != null)
              '${l10n.completedHoursLabel}: $completed${required != null ? '/$required' : ''}',
          ].join(' · '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}
