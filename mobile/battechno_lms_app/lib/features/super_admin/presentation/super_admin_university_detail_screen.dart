import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';

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
      appBar: AppBar(
        title: Text(uni?.name ?? l10n.universityDetail),
        leading: BackButton(onPressed: () => context.pop()),
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
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          uni.name,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      StatusChip(
                        label: SuperAdminLabels.universityStatusAr(uni.status),
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (uni.contactPerson != null)
                    _kv(l10n.contactPersonLabel, uni.contactPerson!),
                  if (uni.contactEmail != null)
                    _kv(l10n.email, uni.contactEmail!),
                  if (uni.contactPhone != null)
                    _kv(l10n.phoneOptional, uni.contactPhone!),
                  if (uni.linkedUsersCount != null)
                    _kv(l10n.users, '${uni.linkedUsersCount}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          AcademicSectionHeader(title: l10n.changeStatus),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in ['active', 'inactive', 'archived'])
                if (s != uni.status)
                  OutlinedButton(
                    onPressed: _saving ? null : () => _confirmStatusChange(s),
                    child: Text(SuperAdminLabels.universityStatusAr(s)),
                  ),
            ],
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () =>
                context.push('/super/universities/${uni.id}/users'),
            icon: const Icon(Icons.group_outlined),
            label: Text(l10n.users),
          ),
        ],
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
