import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import 'widgets/instructor_widgets.dart';

class InstructorParticipantsScreen extends ConsumerStatefulWidget {
  const InstructorParticipantsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<InstructorParticipantsScreen> createState() =>
      _InstructorParticipantsScreenState();
}

class _InstructorParticipantsScreenState
    extends ConsumerState<InstructorParticipantsScreen> {
  List<Map<String, dynamic>> _apps = const [];
  bool _loading = true;
  String? _error;
  bool _fromCache = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final apps = await ref
          .read(instructorRepositoryProvider)
          .listApplications(widget.opportunityId, userId: user?.id);
      setState(() {
        _apps = apps;
        _fromCache = false;
      });
    } on ApiException catch (e) {
      setState(() {
        if (e.statusCode == 403) {
          _error = 'forbidden';
        } else {
          _error = e.isNetwork ? 'network' : e.message;
        }
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
      appBar: AppBar(title: Text(l10n.participants)),
      body: _loading && _apps.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 5),
            )
          : _error != null && _apps.isEmpty
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
                  if (_fromCache) InfoBanner(message: l10n.offlineCachedBanner),
                  if (_apps.isEmpty)
                    EmptyState(title: l10n.noParticipants, subtitle: '')
                  else
                    for (final app in _apps) ...[
                      ParticipantProgressCard(
                        application: app,
                        onTap: () {
                          final appId = app['id']?.toString();
                          if (appId == null) return;
                          context.push(
                            '/instructor/field-training/${widget.opportunityId}/participants/$appId',
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }
}
