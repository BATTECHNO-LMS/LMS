import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';
import 'widgets/admin_widgets.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  AdminDashboardData? _data;
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
          .read(adminRepositoryProvider)
          .loadDashboard(userId: widget.user.id, role: widget.user.primaryRole);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPriority(AdminPriorityAction action) {
    switch (action.type) {
      case AdminPriorityType.reviewSubmissions:
        context.push(
          '/admin/field-training/${action.opportunityId}/applications',
        );
      case AdminPriorityType.reviewApplications:
        context.push(
          '/admin/field-training/${action.opportunityId}/applications',
        );
      case AdminPriorityType.completeSetup:
        context.push('/admin/field-training/${action.opportunityId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _data == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network' && _data == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final data = _data;
    final priority = data?.priorityAction;
    final ftStats = data?.ftStats;
    final dashboardStats = data?.dashboardStats;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.instructorGreeting(widget.user.fullName),
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (data?.fromCache == true) ...[
            const SizedBox(height: 8),
            InfoBanner(
              message:
                  '${l10n.offlineCachedBanner}'
                  '${data?.cachedAt != null ? ' · ${l10n.lastUpdatedAt(data!.cachedAt!.toLocal().toString().split('.').first)}' : ''}',
            ),
          ],
          const SizedBox(height: 16),
          if (priority != null) ...[
            AdminPriorityCard(
              action: priority,
              onTap: () => _openPriority(priority),
            ),
            const SizedBox(height: 16),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(
                l10n.adminOpportunitiesCount(ftStats?.totalOpportunities ?? 0),
                Icons.work_outline,
              ),
              _chip(
                l10n.adminPublishedOpportunitiesCount(
                  ftStats?.publishedOpportunities ?? 0,
                ),
                Icons.check_circle_outline,
              ),
              if ((ftStats?.pendingApplications ?? 0) > 0)
                _chip(
                  l10n.adminPendingApplicationsCount(
                    ftStats!.pendingApplications,
                  ),
                  Icons.fact_check_outlined,
                ),
              if ((data?.list.totalPendingSubmissions ?? 0) > 0)
                _chip(
                  l10n.pendingSubmissionsCount(
                    data!.list.totalPendingSubmissions,
                  ),
                  Icons.assignment_late_outlined,
                ),
              if (dashboardStats != null)
                _chip(
                  l10n.adminPendingUsersCount(data?.pendingUsersCount ?? 0),
                  Icons.person_add_alt_outlined,
                ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            l10n.quickActions,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/home/opportunities'),
            icon: const Icon(Icons.work_outline),
            label: Text(l10n.opportunities),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/admin/field-training/new'),
            icon: const Icon(Icons.add_circle_outline),
            label: Text(l10n.createOpportunity),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/home/trainees'),
            icon: const Icon(Icons.groups_outlined),
            label: Text(l10n.trainees),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, IconData icon) {
    return Chip(avatar: Icon(icon, size: 18), label: Text(label));
  }
}
