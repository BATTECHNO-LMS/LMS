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

    if (_loading && _items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network' && _items.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            decoration: InputDecoration(
              hintText: l10n.searchUsers,
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => _search = v,
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: Text(l10n.statusLabel),
                selected: _status == null,
                onSelected: (_) {
                  setState(() => _status = null);
                  _load();
                },
              ),
              for (final s in _statuses)
                ChoiceChip(
                  label: Text(SuperAdminLabels.userStatusAr(s)),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
              if (_universityId != null)
                InputChip(
                  label: Text(l10n.university),
                  onDeleted: () {
                    setState(() => _universityId = null);
                    _load();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_items.isEmpty)
            EmptyState(title: l10n.noUsersFound)
          else
            for (final user in _items) ...[
              Card(
                child: ListTile(
                  leading: CircleAvatar(
                    child: Text(
                      user.fullName.isNotEmpty ? user.fullName[0] : '?',
                    ),
                  ),
                  title: Text(user.fullName),
                  subtitle: Text(user.email),
                  trailing: StatusChip(
                    label: SuperAdminLabels.userStatusAr(user.status),
                    color: _statusColor(user.status),
                  ),
                  onTap: () => context.push('/super/users/${user.id}'),
                ),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'active':
        return BatColors.success;
      case 'suspended':
        return BatColors.danger;
      default:
        return BatColors.warning;
    }
  }
}
