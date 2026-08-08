import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/api/api_client.dart';
import '../../../core/config/public_web_urls.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/push/push_config.dart';
import '../../../core/storage/offline_cache.dart';
import '../../auth/providers/auth_controller.dart';
import '../../push/data/push_token_sync_service.dart';
import '../../push/providers/push_route_coordinator.dart';
import '../data/account_deletion_repository.dart';
import '../domain/account_deletion_models.dart';

final accountDeletionRepositoryProvider = Provider<AccountDeletionRepository>(
  (ref) => AccountDeletionRepository(
    ref.watch(apiClientProvider),
    ref.watch(apiEndpointsProvider),
  ),
);

class AccountDeletionScreen extends ConsumerStatefulWidget {
  const AccountDeletionScreen({super.key});

  @override
  ConsumerState<AccountDeletionScreen> createState() =>
      _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends ConsumerState<AccountDeletionScreen> {
  static const _pageBg = Color(0xFFF2F3F5);

  AccountDeletionStatusPayload? _status;
  Object? _loadError;
  bool _loading = true;
  bool _submitting = false;
  bool _cancelling = false;

  final _reasonCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _understood = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final status = await ref
          .read(accountDeletionRepositoryProvider)
          .getStatus();
      if (!mounted) return;
      setState(() {
        _status = status;
        _loading = false;
      });
      if (status.request?.isCompleted == true) {
        await _clearSessionAfterCompleted();
      }
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.isAccountInactive) {
        await _clearSessionAfterCompleted();
        return;
      }
      setState(() {
        _loadError = e;
        _loading = false;
      });
    }
  }

  Future<void> _clearSessionAfterCompleted() async {
    final user = ref.read(authControllerProvider).user;
    if (PushConfig.isConfigured) {
      await ref.read(pushTokenSyncServiceProvider).unregisterAllBestEffort();
    }
    ref.read(pushRouteCoordinatorProvider.notifier).clear();
    await ref.read(authControllerProvider.notifier).logout();
    final cache = await OfflineCache.open();
    if (user != null) {
      await cache.clearUser(user.id);
    } else {
      await cache.clearAll();
    }
    if (mounted) context.go('/auth/login');
  }

  String _statusLabel(AppLocalizations l10n, String? status) {
    switch (status) {
      case 'pending':
        return l10n.deletionStatusPending;
      case 'processing':
        return l10n.deletionStatusProcessing;
      case 'completed':
        return l10n.deletionStatusCompleted;
      case 'rejected':
        return l10n.deletionStatusRejected;
      case 'cancelled':
        return l10n.deletionStatusCancelled;
      default:
        return l10n.deletionStatusNone;
    }
  }

  String _mapError(AppLocalizations l10n, Object e) {
    if (e is ApiException) {
      if (e.isNetwork) return l10n.deletionOfflineRequired;
      switch (e.code) {
        case 'DELETION_REQUEST_ALREADY_EXISTS':
          return l10n.deletionAlreadyExists;
        case 'DELETION_REQUEST_NOT_FOUND':
          return l10n.deletionNotFound;
        case 'DELETION_REQUEST_CANNOT_CANCEL':
          return l10n.deletionCannotCancel;
        case 'ACCOUNT_DELETION_UNAVAILABLE':
          return l10n.deletionUnavailable;
        case 'CONFIRMATION_REQUIRED':
        case 'VALIDATION_ERROR':
          return l10n.deletionConfirmationInvalid;
        case 'INVALID_PASSWORD':
          return l10n.deletionInvalidPassword;
        default:
          return e.message;
      }
    }
    return l10n.deletionSubmitFailed;
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (_submitting) return;
    if (!_understood) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.deletionCheckboxRequired)));
      return;
    }
    if (_confirmCtrl.text.trim() != 'DELETE') {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.deletionConfirmationInvalid)));
      return;
    }
    if (_passwordCtrl.text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.deletionPasswordRequired)));
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.deletionFinalConfirmTitle),
        content: Text(l10n.deletionFinalConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: BatColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.deletionSubmit),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      await ref
          .read(accountDeletionRepositoryProvider)
          .submit(
            currentPassword: _passwordCtrl.text,
            reason: _reasonCtrl.text,
          );
      if (!mounted) return;
      _passwordCtrl.clear();
      _confirmCtrl.clear();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.deletionSubmitSuccess)));
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_mapError(l10n, e))));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _cancel() async {
    final l10n = AppLocalizations.of(context);
    if (_cancelling) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.deletionCancelTitle),
        content: Text(l10n.deletionCancelBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.deletionCancelAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      await ref.read(accountDeletionRepositoryProvider).cancel();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.deletionCancelSuccess)));
      await _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_mapError(l10n, e))));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final request = _status?.request;

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Text(l10n.deleteAccount),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _loadError != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _mapError(l10n, _loadError!),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _refresh,
                        child: Text(l10n.retry),
                      ),
                    ],
                  ),
                ),
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  _SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.deletionExplainTitle,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: BatColors.heading,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.deletionExplainBody,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: BatColors.heading,
                                height: 1.45,
                              ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          l10n.deletionRetentionBody,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: BatColors.muted, height: 1.45),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.deletionRequestStatus,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        Text(_statusLabel(l10n, request?.status)),
                        if (request?.requestedAt != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            l10n.deletionRequestedAt(
                              request!.requestedAt!
                                  .toLocal()
                                  .toString()
                                  .split('.')
                                  .first,
                            ),
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: BatColors.muted),
                          ),
                        ],
                        if (request?.isActive == true) ...[
                          const SizedBox(height: 8),
                          Text(
                            l10n.deletionWhatHappensNext,
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(height: 1.4),
                          ),
                        ],
                        if (request?.canCancel == true) ...[
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: _cancelling ? null : _cancel,
                            child: _cancelling
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(l10n.cancelDeletionRequest),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (request?.isActive != true) ...[
                    const SizedBox(height: 12),
                    _SoftCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.requestAccountDeletion,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _reasonCtrl,
                            maxLines: 3,
                            maxLength: 1000,
                            decoration: InputDecoration(
                              labelText: l10n.deletionReasonOptional,
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _passwordCtrl,
                            obscureText: true,
                            decoration: InputDecoration(
                              labelText: l10n.deletionCurrentPassword,
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _confirmCtrl,
                            decoration: InputDecoration(
                              labelText: l10n.deletionTypeDelete,
                              border: const OutlineInputBorder(),
                              helperText: l10n.deletionTypeDeleteHint,
                            ),
                          ),
                          const SizedBox(height: 4),
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: _understood,
                            onChanged: (v) =>
                                setState(() => _understood = v ?? false),
                            title: Text(l10n.deletionCheckboxLabel),
                            controlAffinity: ListTileControlAffinity.leading,
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: BatColors.danger,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                              ),
                              onPressed: _submitting ? null : _submit,
                              child: _submitting
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(l10n.requestAccountDeletion),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _SoftCard(
                    child: Column(
                      children: [
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.privacy_tip_outlined),
                          title: Text(l10n.privacyPolicyLink),
                          trailing: const Icon(Icons.open_in_new, size: 18),
                          onTap: () => _openUrl(PublicWebUrls.privacyPolicy),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.public_outlined),
                          title: Text(l10n.accountDeletionWebLink),
                          trailing: const Icon(Icons.open_in_new, size: 18),
                          onTap: () => _openUrl(PublicWebUrls.accountDeletion),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.support_agent_outlined),
                          title: Text(l10n.deletionContactSupport),
                          subtitle: const Text(PublicWebUrls.supportEmail),
                          onTap: () => _openUrl(PublicWebUrls.supportMailto),
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

class _SoftCard extends StatelessWidget {
  const _SoftCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}
