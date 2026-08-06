import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';
import 'widgets/super_admin_widgets.dart';

/// University detail with activate/deactivate/archive confirm sheet, an
/// edit-basic-fields shortcut, and a link into the users list filtered to
/// this university.
class SuperAdminUniversityDetailScreen extends ConsumerStatefulWidget {
  const SuperAdminUniversityDetailScreen({
    super.key,
    required this.universityId,
  });

  final String universityId;

  @override
  ConsumerState<SuperAdminUniversityDetailScreen> createState() =>
      _SuperAdminUniversityDetailScreenState();
}

class _SuperAdminUniversityDetailScreenState
    extends ConsumerState<SuperAdminUniversityDetailScreen> {
  UniversityItem? _university;
  bool _loading = true;
  bool _saving = false;
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
      final uni = await ref
          .read(superAdminRepositoryProvider)
          .getUniversity(widget.universityId, includeCounts: true);
      setState(() => _university = uni);
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

  Future<void> _confirmStatusChange(String newStatus) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.confirmStatusChangeTitle),
        content: Text(
          l10n.confirmStatusChangeBody(
            SuperAdminLabels.universityStatusAr(newStatus),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.stayAndEdit),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.continueAction),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _saving = true);
    try {
      final updated = await ref
          .read(superAdminRepositoryProvider)
          .updateUniversity(
            id: widget.universityId,
            body: {'status': newStatus},
          );
      setState(() => _university = updated);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.statusChangeSaved)));
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.statusCode == 403 ? l10n.forbiddenAccess : e.message,
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final uni = _university;

    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: uni?.name ?? l10n.universityDetail,
        actions: [
          if (uni != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: l10n.editUniversity,
              onPressed: () => context.push(
                '/super/universities/${widget.universityId}/edit',
              ),
            ),
        ],
      ),
      body: SafeArea(child: _buildBody(l10n, uni)),
    );
  }

  Widget _buildBody(AppLocalizations l10n, UniversityItem? uni) {
    if (_loading && uni == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && uni == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (uni == null) {
      return EmptyState(title: l10n.resourceNotFound);
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: BatColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SaSoftCard(
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
                    Icons.account_balance_outlined,
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
                        uni.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                              height: 1.25,
                            ),
                      ),
                      const SizedBox(height: 8),
                      SaStatusBadge(
                        label: SuperAdminLabels.universityStatusAr(uni.status),
                        tone: _statusTone(uni.status),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SaSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.universityDetail,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 14),
                if (uni.contactPerson != null) ...[
                  SaMetaRow(
                    icon: Icons.person_outline,
                    label: l10n.contactPersonLabel,
                    value: uni.contactPerson!,
                  ),
                  const SizedBox(height: 12),
                ],
                if (uni.contactEmail != null) ...[
                  SaMetaRow(
                    icon: Icons.email_outlined,
                    label: l10n.email,
                    value: uni.contactEmail!,
                  ),
                  const SizedBox(height: 12),
                ],
                if (uni.contactPhone != null) ...[
                  SaMetaRow(
                    icon: Icons.phone_outlined,
                    label: l10n.phoneOptional,
                    value: uni.contactPhone!,
                  ),
                  const SizedBox(height: 12),
                ],
                if (uni.linkedUsersCount != null)
                  SaMetaRow(
                    icon: Icons.group_outlined,
                    label: l10n.users,
                    value: '${uni.linkedUsersCount}',
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SaSoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.changeStatus,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in ['active', 'inactive', 'archived'])
                      if (s != uni.status)
                        OutlinedButton(
                          style: saOutlinedButtonStyle(),
                          onPressed: _saving
                              ? null
                              : () => _confirmStatusChange(s),
                          child: Text(SuperAdminLabels.universityStatusAr(s)),
                        ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SaSoftCard(
            onTap: () => context.push('/super/universities/${uni.id}/users'),
            padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.group_outlined,
                    color: BatColors.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    l10n.users,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.heading,
                    ),
                  ),
                ),
                const Icon(Icons.chevron_left, color: BatColors.muted),
              ],
            ),
          ),
        ],
      ),
    );
  }

  SaBadgeTone _statusTone(String status) {
    switch (status) {
      case 'active':
        return SaBadgeTone.success;
      case 'inactive':
        return SaBadgeTone.accent;
      case 'archived':
        return SaBadgeTone.neutral;
      default:
        return SaBadgeTone.primary;
    }
  }
}
