import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';

/// Read-only submissions overview (review happens on the instructor/web portal).
class AdminSubmissionsScreen extends ConsumerStatefulWidget {
  const AdminSubmissionsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminSubmissionsScreen> createState() =>
      _AdminSubmissionsScreenState();
}

class _AdminSubmissionsScreenState
    extends ConsumerState<AdminSubmissionsScreen> {
  List<Map<String, dynamic>> _submissions = const [];
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
      final list = await ref
          .read(adminRepositoryProvider)
          .listSubmissions(widget.opportunityId);
      setState(() => _submissions = list);
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.viewSubmissions)),
      body: _loading && _submissions.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 4),
            )
          : _error != null && _submissions.isEmpty
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
                padding: const EdgeInsets.all(16),
                children: [
                  if (_submissions.isEmpty)
                    EmptyState(title: l10n.noSubmissions, subtitle: '')
                  else
                    for (final s in _submissions) ...[
                      Card(
                        child: ListTile(
                          title: Text(
                            s['task_title']?.toString() ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            '${s['student_name']?.toString() ?? '—'} · '
                            '${AdminLabels.statusAr(s['review_status']?.toString())}',
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }
}
