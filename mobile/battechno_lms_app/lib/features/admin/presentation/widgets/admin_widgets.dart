import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../domain/admin_models.dart';

const Color kAdminPageBg = Color(0xFFF2F3F5);

class AdminSoftCard extends StatelessWidget {
  const AdminSoftCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(22);
    final content = Padding(padding: padding, child: child);
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: radius,
          border: Border.all(color: const Color(0xFFE6E8EC)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1A2330).withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: onTap == null
            ? content
            : Material(
                color: Colors.transparent,
                borderRadius: radius,
                child: InkWell(
                  onTap: onTap,
                  borderRadius: radius,
                  child: content,
                ),
              ),
      ),
    );
  }
}

InputDecoration adminSoftFieldDecoration(String label, {String? hint}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    filled: true,
    fillColor: const Color(0xFFF7F8FA),
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
      borderSide: const BorderSide(color: BatColors.primary, width: 1.4),
    ),
  );
}

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
    return AdminSoftCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: BatColors.accentSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: BatColors.accentHover, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  action.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: BatColors.muted,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
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
    return AdminSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.hiking_outlined,
                  color: BatColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      opportunity.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                        height: 1.25,
                      ),
                    ),
                    if (opportunity.specialtyName != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        opportunity.specialtyName!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: BatColors.muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
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
                  AdminLabels.statusAr(opportunity.status),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: BatColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${AdminLabels.modeAr(opportunity.trainingMode)}'
            '${opportunity.startDate != null ? ' · ${opportunity.startDate}' : ''}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaChip(
                icon: Icons.groups_outlined,
                text: '${opportunity.participantsCount} ${l10n.students}',
              ),
              _MetaChip(
                icon: Icons.event_outlined,
                text: '${opportunity.sessionsCount} ${l10n.sessions}',
              ),
              if (opportunity.pendingSubmissionsCount > 0)
                _MetaChip(
                  icon: Icons.assignment_late_outlined,
                  text: l10n.pendingSubmissionsCount(
                    opportunity.pendingSubmissionsCount,
                  ),
                  accent: true,
                ),
              if (opportunity.instructorName != null)
                _MetaChip(
                  icon: Icons.person_outline,
                  text: opportunity.instructorName!,
                ),
              if (opportunity.needsEligibilitySetup)
                _MetaChip(
                  icon: Icons.warning_amber_outlined,
                  text: l10n.needsEligibilitySetupNotice,
                  accent: true,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.text,
    this.accent = false,
  });

  final IconData icon;
  final String text;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: accent ? BatColors.accentSoft : const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: accent ? BatColors.accentHover : BatColors.primaryLight,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              text,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: accent ? BatColors.accentHover : BatColors.heading,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
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
    final initial = name.isNotEmpty ? name.characters.first : '?';

    return AdminSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: BatColors.primary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (university != null && university.isNotEmpty)
                            university,
                          AdminLabels.statusAr(status),
                        ].join(' · '),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: BatColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_left, color: BatColors.muted),
              ],
            ),
          ),
          if (pending && (onApprove != null || onReject != null)) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onReject,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF8B93A0),
                      side: const BorderSide(color: Color(0xFFE6E8EC)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      l10n.rejectApplication,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: onApprove,
                    style: FilledButton.styleFrom(
                      backgroundColor: BatColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      l10n.approveApplication,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ],
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
    final initial = name.isNotEmpty ? name.characters.first : '?';

    return AdminSoftCard(
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
            child: Center(
              child: Text(
                initial,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: BatColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (opportunityTitle != null && opportunityTitle.isNotEmpty)
                      opportunityTitle,
                    AdminLabels.statusAr(trainingStatus),
                    if (completed != null)
                      '${l10n.completedHoursLabel}: $completed${required != null ? '/$required' : ''}',
                  ].join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
      ),
    );
  }
}

class AdminActionTile extends StatelessWidget {
  const AdminActionTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AdminSoftCard(
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

class AdminMetaRow extends StatelessWidget {
  const AdminMetaRow({
    super.key,
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
