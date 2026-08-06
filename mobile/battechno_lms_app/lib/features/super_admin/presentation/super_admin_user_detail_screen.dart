import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/auth/lms_roles.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';
import 'widgets/super_admin_widgets.dart';

/// User detail with activate, status change, and a role-assignment sheet.
///
/// IDENTITY-001: assigning or removing `super_admin` is enforced by the
/// backend (`assertSuperAdminRoleMutationAllowed`), but this screen adds a
/// mandatory strong confirmation dialog before submitting any role change
/// that adds or removes `super_admin` — never `program_admin`, which is
/// never offered as an assignable role (`SuperAdminCapabilities`).
class SuperAdminUserDetailScreen extends ConsumerStatefulWidget {
  const SuperAdminUserDetailScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<SuperAdminUserDetailScreen> createState() =>
      _SuperAdminUserDetailScreenState();
}

class _SuperAdminUserDetailScreenState
    extends ConsumerState<SuperAdminUserDetailScreen> {
  UserItem? _user;
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
      final user = await ref
          .read(superAdminRepositoryProvider)
          .getUser(widget.userId);
      setState(() => _user = user);
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

  Future<void> _activate() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final updated = await ref
          .read(superAdminRepositoryProvider)
          .activateUser(widget.userId);
      setState(() => _user = updated);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.userActivated)));
      }
    } on ApiException catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmStatusChange(String status) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.confirmStatusChangeTitle),
        content: Text(
          l10n.confirmStatusChangeBody(SuperAdminLabels.userStatusAr(status)),
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
          .updateUserStatus(id: widget.userId, status: status);
      setState(() => _user = updated);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.statusChangeSaved)));
      }
    } on ApiException catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showError(ApiException e) {
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(e.statusCode == 403 ? l10n.forbiddenAccess : e.message),
      ),
    );
  }

  Future<void> _openRoleSheet() async {
    final user = _user;
    if (user == null) return;
    final l10n = AppLocalizations.of(context);
    final selected = {...user.roleCodes};

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: kSaPageBg,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDDE3EB),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        SaSoftCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                l10n.assignRolesTitle,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: BatColors.heading,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              for (final role
                                  in SuperAdminCapabilities.assignableRoles)
                                CheckboxListTile(
                                  contentPadding: EdgeInsets.zero,
                                  controlAffinity:
                                      ListTileControlAffinity.leading,
                                  activeColor: BatColors.primary,
                                  value: selected.contains(role),
                                  title: Text(
                                    SuperAdminLabels.roleAr(role),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w600,
                                          color: BatColors.heading,
                                        ),
                                  ),
                                  subtitle: role == LmsRoles.superAdmin
                                      ? Text(
                                          l10n.superAdminRoleWarning,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                color: BatColors.muted,
                                              ),
                                        )
                                      : null,
                                  onChanged: (v) {
                                    setModal(() {
                                      if (v == true) {
                                        selected.add(role);
                                      } else {
                                        selected.remove(role);
                                      }
                                    });
                                  },
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          style: saPrimaryButtonStyle(),
                          onPressed: _saving
                              ? null
                              : () async {
                                  if (selected.isEmpty) return;
                                  final wasSuper = user.roleCodes.contains(
                                    LmsRoles.superAdmin,
                                  );
                                  final willBeSuper = selected.contains(
                                    LmsRoles.superAdmin,
                                  );
                                  Navigator.pop(ctx);
                                  if (wasSuper != willBeSuper) {
                                    final confirmed =
                                        await _confirmSuperAdminChange(
                                          adding: willBeSuper,
                                        );
                                    if (confirmed != true) return;
                                  }
                                  await _submitRoles(selected.toList());
                                },
                          child: _saving
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(l10n.save),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<bool?> _confirmSuperAdminChange({required bool adding}) {
    final l10n = AppLocalizations.of(context);
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Colors.red),
        title: Text(
          adding
              ? l10n.confirmGrantSuperAdminTitle
              : l10n.confirmRevokeSuperAdminTitle,
        ),
        content: Text(
          adding
              ? l10n.confirmGrantSuperAdminBody
              : l10n.confirmRevokeSuperAdminBody,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.stayAndEdit),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.continueAction),
          ),
        ],
      ),
    );
  }

  Future<void> _submitRoles(List<String> roleCodes) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final updated = await ref
          .read(superAdminRepositoryProvider)
          .updateUser(id: widget.userId, body: {'role_codes': roleCodes});
      setState(() => _user = updated);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.rolesUpdated)));
      }
    } on ApiException catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = _user;

    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(context, title: user?.fullName ?? l10n.userDetail),
      body: SafeArea(child: _buildBody(l10n, user)),
    );
  }

  Widget _buildBody(AppLocalizations l10n, UserItem? user) {
    if (_loading && user == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && user == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (user == null) {
      return EmptyState(title: l10n.resourceNotFound);
    }

    final initial = user.fullName.isNotEmpty ? user.fullName[0] : '?';

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
                CircleAvatar(
                  radius: 28,
                  backgroundColor: BatColors.primarySoft,
                  foregroundColor: BatColors.primary,
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.fullName,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                              height: 1.25,
                            ),
                      ),
                      const SizedBox(height: 8),
                      SaStatusBadge(
                        label: SuperAdminLabels.userStatusAr(user.status),
                        tone: _statusTone(user.status),
                      ),
                      if (user.isSuperAdmin) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(
                              Icons.verified_user,
                              size: 16,
                              color: BatColors.danger,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              l10n.superAdminBadge,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: BatColors.danger,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ],
                        ),
                      ],
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
                  l10n.userDetail,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 14),
                SaMetaRow(
                  icon: Icons.email_outlined,
                  label: l10n.email,
                  value: user.email,
                ),
                if (user.universityName != null) ...[
                  const SizedBox(height: 12),
                  SaMetaRow(
                    icon: Icons.account_balance_outlined,
                    label: l10n.university,
                    value: user.universityName!,
                  ),
                ],
                const SizedBox(height: 12),
                SaMetaRow(
                  icon: Icons.badge_outlined,
                  label: l10n.roleAssignmentLabel,
                  value: user.roleCodes.map(SuperAdminLabels.roleAr).join('، '),
                ),
              ],
            ),
          ),
          if (user.status == 'inactive' && user.emailVerified) ...[
            const SizedBox(height: 12),
            FilledButton(
              style: saPrimaryButtonStyle(),
              onPressed: _saving ? null : _activate,
              child: _saving
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(l10n.activateUserAction),
            ),
          ],
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
                    for (final s in ['active', 'inactive', 'suspended'])
                      if (s != user.status)
                        OutlinedButton(
                          style: saOutlinedButtonStyle(),
                          onPressed: _saving
                              ? null
                              : () => _confirmStatusChange(s),
                          child: Text(SuperAdminLabels.userStatusAr(s)),
                        ),
                  ],
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
                  l10n.roleAssignmentLabel,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  style: saOutlinedButtonStyle(),
                  onPressed: _saving ? null : _openRoleSheet,
                  icon: const Icon(Icons.badge_outlined),
                  label: Text(l10n.assignRolesTitle),
                ),
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
      case 'suspended':
        return SaBadgeTone.accent;
      default:
        return SaBadgeTone.neutral;
    }
  }
}
