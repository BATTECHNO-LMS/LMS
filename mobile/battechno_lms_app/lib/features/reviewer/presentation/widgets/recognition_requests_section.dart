import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../../auth/domain/auth_user.dart';
import '../../data/reviewer_repository.dart';
import '../../domain/reviewer_labels.dart';
import '../../domain/reviewer_models.dart';
import 'reviewer_widgets.dart';

/// Embeddable recognition-requests list (search + status filter + cards).
/// Used both inside `ReviewerReviewsHubScreen` and the standalone
/// `/reviewer/recognition` route.
class RecognitionRequestsSection extends ConsumerStatefulWidget {
  const RecognitionRequestsSection({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<RecognitionRequestsSection> createState() =>
      _RecognitionRequestsSectionState();
}

class _RecognitionRequestsSectionState
    extends ConsumerState<RecognitionRequestsSection> {
  String? _status;
  String _search = '';
  List<Map<String, dynamic>> _items = const [];
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
      final page = await ref
          .read(reviewerRepositoryProvider)
          .listRecognitionRequests(
            userId: widget.user.id,
            status: _status,
            search: _search,
          );
      setState(() => _items = page.items);
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: ReviewerSoftCard(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
              child: TextField(
                decoration:
                    reviewerSoftFieldDecoration(
                      '',
                      hint: l10n.searchRecognitionRequests,
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
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _statusFilterChip(
                  label: l10n.statusLabel,
                  selected: _status == null,
                  onTap: () {
                    setState(() => _status = null);
                    _load();
                  },
                ),
                for (final s in ReviewerStatusOptions.recognitionStatuses)
                  _statusFilterChip(
                    label: ReviewerLabels.recognitionStatus(l10n, s),
                    selected: _status == s,
                    onTap: () {
                      setState(() => _status = s);
                      _load();
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading && _items.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: LoadingSkeleton(lines: 4),
                  )
                : _error != null && _items.isEmpty
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
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                      children: [
                        if (_items.isEmpty)
                          EmptyState(
                            title: l10n.noRecognitionRequests,
                            subtitle: '',
                          )
                        else
                          for (final item in _items) _buildCard(l10n, item),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _statusFilterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
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
                  ? BatColors.primary.withValues(alpha: 0.25)
                  : const Color(0xFFE6E8EC),
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: selected ? BatColors.primary : const Color(0xFF8B93A0),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCard(AppLocalizations l10n, Map<String, dynamic> item) {
    final req = RecognitionRequestItem(item);
    return ReviewerQueueCard(
      title: req.microCredentialTitle ?? l10n.recognitionRequestsTitle,
      statusLabel: ReviewerLabels.recognitionStatus(l10n, req.status),
      status: req.status,
      subtitle: req.cohortTitle,
      metaChips: [if (req.universityName != null) req.universityName!],
      onTap: () => context.push('/reviewer/recognition/${req.id}'),
    );
  }
}
