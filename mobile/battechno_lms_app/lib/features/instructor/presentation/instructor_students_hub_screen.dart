import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

/// Tab hub: pick an assigned training, then browse its participants.
class InstructorStudentsHubScreen extends ConsumerStatefulWidget {
  const InstructorStudentsHubScreen({super.key});

  @override
  ConsumerState<InstructorStudentsHubScreen> createState() =>
      _InstructorStudentsHubScreenState();
}

class _InstructorStudentsHubScreenState
    extends ConsumerState<InstructorStudentsHubScreen> {
  InstructorTrainingListData? _data;
  bool _loading = true;
  String? _error;
  String? _selectedId;
  List<Map<String, dynamic>> _apps = const [];
  bool _loadingApps = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(instructorRepositoryProvider)
          .listOpportunities(userId: user.id);
      setState(() {
        _data = data;
        if (data.opportunities.isNotEmpty && _selectedId == null) {
          _selectedId = data.opportunities.first.id;
        }
      });
      if (_selectedId != null) await _loadApps(_selectedId!);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadApps(String opportunityId) async {
    final user = ref.read(authControllerProvider).user;
    setState(() => _loadingApps = true);
    try {
      final apps = await ref
          .read(instructorRepositoryProvider)
          .listApplications(opportunityId, userId: user?.id);
      setState(() => _apps = apps);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.statusCode == 403
                  ? AppLocalizations.of(context).forbiddenAccess
                  : e.message,
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingApps = false);
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

    final opps = _data?.opportunities ?? const [];
    if (opps.isEmpty) {
      return EmptyState(
        title: l10n.instructorStudentsHub,
        subtitle: l10n.noAssignedTrainings,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.instructorStudentsHub,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(l10n.selectTrainingForStudents),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _selectedId,
            decoration: const InputDecoration(border: OutlineInputBorder()),
            items: [
              for (final o in opps)
                DropdownMenuItem(value: o.id, child: Text(o.title)),
            ],
            onChanged: (id) {
              if (id == null) return;
              setState(() => _selectedId = id);
              _loadApps(id);
            },
          ),
          const SizedBox(height: 16),
          if (_loadingApps)
            const LoadingSkeleton(lines: 3)
          else if (_apps.isEmpty)
            EmptyState(title: l10n.noParticipants, subtitle: '')
          else
            for (final app in _apps) ...[
              ParticipantProgressCard(
                application: app,
                onTap: () {
                  final appId = app['id']?.toString();
                  final oppId = _selectedId;
                  if (appId == null || oppId == null) return;
                  context.push(
                    '/instructor/field-training/$oppId/participants/$appId',
                  );
                },
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}
