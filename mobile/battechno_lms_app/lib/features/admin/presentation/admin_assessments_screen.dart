import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';
import 'widgets/admin_widgets.dart';

class AdminAssessmentsScreen extends ConsumerStatefulWidget {
  const AdminAssessmentsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminAssessmentsScreen> createState() =>
      _AdminAssessmentsScreenState();
}

class _AdminAssessmentsScreenState
    extends ConsumerState<AdminAssessmentsScreen> {
  List<Map<String, dynamic>> _assessments = const [];
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
          .listAssessments(widget.opportunityId);
      setState(() => _assessments = list);
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
      backgroundColor: kAdminPageBg,
      appBar: AppBar(
        title: Text(l10n.assessmentResults),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
      ),
      body: SafeArea(
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: LoadingSkeleton(lines: 4),
              )
            : _error != null
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
                    if (_assessments.isEmpty)
                      EmptyState(title: l10n.noAssessmentResults, subtitle: '')
                    else
                      for (final assessment in _assessments)
                        _AdminAssessmentCard(
                          assessment: assessment,
                          l10n: l10n,
                        ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _AdminAssessmentCard extends StatelessWidget {
  const _AdminAssessmentCard({required this.assessment, required this.l10n});

  final Map<String, dynamic> assessment;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final isPre = assessment['type']?.toString() == 'pre';
    final typeLabel = isPre ? l10n.preAssessment : l10n.postAssessment;
    final title =
        assessment['title']?.toString() ??
        (isPre ? l10n.preAssessment : l10n.postAssessment);

    return AdminSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.fact_check_outlined,
              color: BatColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: isPre ? BatColors.accentSoft : BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    typeLabel,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: isPre ? BatColors.accentHover : BatColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
