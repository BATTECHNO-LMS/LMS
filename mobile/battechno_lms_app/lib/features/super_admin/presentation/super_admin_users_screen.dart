import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';
import 'widgets/super_admin_widgets.dart';

/// Searchable/filterable users list (`super_admin` shell tab 3). When
/// [initialUniversityId] is set (pushed from a university detail screen),
/// the list starts pre-filtered to that university.
class SuperAdminUsersScreen extends ConsumerStatefulWidget {
  const SuperAdminUsersScreen({super.key, this.initialUniversityId});

  final String? initialUniversityId;

  @override
  ConsumerState<SuperAdminUsersScreen> createState() =>
      _SuperAdminUsersScreenState();
}

class _SuperAdminUsersScreenState extends ConsumerState<SuperAdminUsersScreen> {
  List<UserItem> _items = const [];
  bool _loading = true;
  String? _error;
  String _search = '';
  String? _status;
  String? _universityId;

  static const _statuses = ['active', 'inactive', 'suspended'];

  @override
  void initState() {
    super.initState();
    _universityId = widget.initialUniversityId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final userId = ref.read(authControllerProvider).user?.id;
      final result = await ref
          .read(superAdminRepositoryProvider)
          .listUsers(
            userId: userId,
            search: _search,
            status: _status,
            universityId: _universityId,
          );
      setState(() => _items = result.items);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return ColoredBox(
      color: kSaPageBg,
      child: _loading && _items.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 5),
            )
          : _error == 'network' && _items.isEmpty
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: l10n.networkErrorBody,
              onRetry: _load,
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: BatColors.primary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  TextField(
                    decoration:
                        saSoftFieldDecoration(
                          l10n.searchUsers,
                          hint: l10n.searchUsers,
                        ).copyWith(
                          prefixIcon: const Icon(
                            Icons.search,
                            color: BatColors.primaryLight,
                          ),
                        ),
                    onChanged: (v) => _search = v,
                    onSubmitted: (_) => _load(),
                  ),
                  const SizedBox(height: 10),
                  SaSoftCard(
                    padding: const EdgeInsets.all(8),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _FilterChip(
                          label: l10n.statusLabel,
                          selected: _status == null,
                          onTap: () {
                            setState(() => _status = null);
                            _load();
                          },
                        ),
                        for (final s in _statuses)
                          _FilterChip(
                            label: SuperAdminLabels.userStatusAr(s),
                            selected: _status == s,
                            onTap: () {
                              setState(() => _status = s);
                              _load();
                            },
                          ),
                        if (_universityId != null)
                          InputChip(
                            label: Text(l10n.university),
                            labelStyle: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: BatColors.primary,
                                ),
                            backgroundColor: BatColors.primarySoft,
                            deleteIconColor: BatColors.primary,
                            side: BorderSide.none,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            onDeleted: () {
                              setState(() => _universityId = null);
                              _load();
                            },
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_items.isEmpty)
                    EmptyState(title: l10n.noUsersFound)
                  else
                    for (final user in _items) _UserCard(user: user),
                ],
              ),
            ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? BatColors.primarySoft : const Color(0xFFF7F8FA),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? BatColors.primary.withValues(alpha: 0.2)
                  : const Color(0xFFE6E8EC),
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: selected ? BatColors.primary : const Color(0xFF8B93A0),
            ),
          ),
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.user});

  final UserItem user;

  @override
  Widget build(BuildContext context) {
    final initial = user.fullName.isNotEmpty ? user.fullName[0] : '?';

    return SaSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: () => context.push('/super/users/${user.id}'),
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          CircleAvatar(
            radius: 21,
            backgroundColor: BatColors.primarySoft,
            foregroundColor: BatColors.primary,
            child: Text(
              initial,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.fullName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  user.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
                const SizedBox(height: 8),
                SaStatusBadge(
                  label: SuperAdminLabels.userStatusAr(user.status),
                  tone: _statusTone(user.status),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
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
