import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';
import 'widgets/admin_widgets.dart';

/// University-scoped student roster aggregated from the students report.
class AdminStudentsHubScreen extends ConsumerStatefulWidget {
  const AdminStudentsHubScreen({super.key});

  @override
  ConsumerState<AdminStudentsHubScreen> createState() =>
      _AdminStudentsHubScreenState();
}

class _AdminStudentsHubScreenState
    extends ConsumerState<AdminStudentsHubScreen> {
  List<Map<String, dynamic>> _students = const [];
  bool _loading = true;
  String? _error;
  String _search = '';

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
      final data = await ref.read(adminRepositoryProvider).studentsReport();
      final students = (data['students'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      setState(() => _students = students);
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

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _students;
    final q = _search.trim().toLowerCase();
    return _students.where((s) {
      final name = s['student_name']?.toString().toLowerCase() ?? '';
      final title = s['opportunity_title']?.toString().toLowerCase() ?? '';
      return name.contains(q) || title.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = _filtered;

    return ColoredBox(
      color: kAdminPageBg,
      child: _loading && _students.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 5),
            )
          : _error != null && _students.isEmpty
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  AdminSoftCard(
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: BatColors.primarySoft,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.groups_outlined,
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
                                l10n.trainees,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: BatColors.heading,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                l10n.searchAssignedTrainings,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: BatColors.muted),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: BatColors.accentSoft,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${items.length}',
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: BatColors.accentHover,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  AdminSoftCard(
                    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                    child: TextField(
                      decoration:
                          adminSoftFieldDecoration(
                            l10n.searchAssignedTrainings,
                          ).copyWith(
                            prefixIcon: const Icon(
                              Icons.search,
                              color: BatColors.primaryLight,
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                          ),
                      onChanged: (v) => setState(() => _search = v),
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (items.isEmpty)
                    EmptyState(
                      title: l10n.noParticipants,
                      subtitle: '',
                      icon: Icons.person_off_outlined,
                    )
                  else
                    for (final s in items)
                      AdminStudentSummaryCard(
                        application: s,
                        onTap: () {
                          final appId = s['application_id']?.toString();
                          if (appId == null) return;
                          context.push('/admin/applications/$appId');
                        },
                      ),
                ],
              ),
            ),
    );
  }
}
