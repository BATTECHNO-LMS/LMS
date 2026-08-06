import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';
import 'widgets/reviewer_widgets.dart';

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

    return ColoredBox(
      color: kReviewerPageBg,
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
                  ReviewerSoftCard(
                    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                    child: TextField(
                      decoration:
                          reviewerSoftFieldDecoration(
                            '',
                            hint: l10n.reviewerSearchStudents,
                          ).copyWith(
                            prefixIcon: const Icon(
                              Icons.search,
                              color: BatColors.primaryLight,
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                          ),
                      onChanged: (v) => _search = v,
                      onSubmitted: (_) => _load(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_students.isEmpty)
                    EmptyState(title: l10n.noParticipants, subtitle: '')
                  else
                    for (final s in _students) _studentCard(l10n, s),
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
    final initial = name.isNotEmpty ? name.characters.first : '?';

    return ReviewerSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: () {
        final appId = s['application_id']?.toString();
        if (appId == null) return;
        context.push('/reviewer/students/$appId');
      },
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                initial,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: BatColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (opportunityTitle != null && opportunityTitle.isNotEmpty)
                      opportunityTitle,
                    if (completed != null)
                      '${l10n.completedHoursLabel}: $completed${required != null ? '/$required' : ''}',
                  ].join(' · '),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
      ),
    );
  }
}
