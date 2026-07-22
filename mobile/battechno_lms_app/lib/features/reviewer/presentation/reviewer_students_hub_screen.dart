import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';

/// University-scoped academic student roster — shared by `qa_officer` and
/// `university_reviewer` (`canReadFtReports`). Read-only: taps drill into
/// `ReviewerStudentDetailScreen`, never the admin hours-write screen.
class ReviewerStudentsHubScreen extends ConsumerStatefulWidget {
  const ReviewerStudentsHubScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<ReviewerStudentsHubScreen> createState() =>
      _ReviewerStudentsHubScreenState();
}

class _ReviewerStudentsHubScreenState
    extends ConsumerState<ReviewerStudentsHubScreen> {
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
      final page = await ref
          .read(reviewerRepositoryProvider)
          .academicStudentsReport(userId: widget.user.id, search: _search);
      setState(() => _students = page.items);
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
      body: _loading && _students.isEmpty
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
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    decoration: InputDecoration(
                      hintText: l10n.reviewerSearchStudents,
                      prefixIcon: const Icon(Icons.search),
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (v) => _search = v,
                    onSubmitted: (_) => _load(),
                  ),
                  const SizedBox(height: 12),
                  if (_students.isEmpty)
                    EmptyState(title: l10n.noParticipants, subtitle: '')
                  else
                    for (final s in _students) ...[
                      _studentCard(l10n, s),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }

  Widget _studentCard(AppLocalizations l10n, Map<String, dynamic> s) {
    final name = s['student_name']?.toString() ?? '—';
    final opportunityTitle = s['opportunity_title']?.toString();
    final completed = s['completed_training_hours'];
    final required = s['required_training_hours'];
    return Card(
      child: ListTile(
        onTap: () {
          final appId = s['application_id']?.toString();
          if (appId == null) return;
          context.push('/reviewer/students/$appId');
        },
        leading: CircleAvatar(
          child: Text(name.isNotEmpty ? name.characters.first : '?'),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          [
            if (opportunityTitle != null && opportunityTitle.isNotEmpty)
              opportunityTitle,
            if (completed != null)
              '${l10n.completedHoursLabel}: $completed${required != null ? '/$required' : ''}',
          ].join(' · '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}
