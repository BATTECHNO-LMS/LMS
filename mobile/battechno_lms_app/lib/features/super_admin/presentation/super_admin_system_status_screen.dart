import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';
import 'widgets/super_admin_widgets.dart';

/// API availability probe only (`GET /health`) — never the database URL or
/// any other environment detail. Web-only `/settings` and `/analytics/*`
/// are intentionally not implemented here.
class SuperAdminSystemStatusScreen extends ConsumerStatefulWidget {
  const SuperAdminSystemStatusScreen({super.key});

  @override
  ConsumerState<SuperAdminSystemStatusScreen> createState() =>
      _SuperAdminSystemStatusScreenState();
}

class _SuperAdminSystemStatusScreenState
    extends ConsumerState<SuperAdminSystemStatusScreen> {
  Map<String, dynamic>? _health;
  bool _loading = true;
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  Future<void> _check() async {
    setState(() => _loading = true);
    final health = await ref.read(superAdminRepositoryProvider).getHealth();
    if (!mounted) return;
    setState(() {
      _health = health;
      _checked = true;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isUp = _health?['status']?.toString() == 'ok';

    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: l10n.systemStatusTitle,
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _check,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              if (_loading && !_checked)
                const LoadingSkeleton(lines: 2)
              else
                SaSoftCard(
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: isUp
                              ? BatColors.success.withValues(alpha: 0.12)
                              : BatColors.danger.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          isUp
                              ? Icons.check_circle_outline
                              : Icons.error_outline,
                          color: isUp ? BatColors.success : BatColors.danger,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isUp ? l10n.apiAvailable : l10n.apiUnavailable,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: BatColors.heading,
                                  ),
                            ),
                            if (_health?['service'] != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                _health!['service'].toString(),
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: BatColors.muted),
                              ),
                            ],
                            const SizedBox(height: 8),
                            SaStatusBadge(
                              label: isUp
                                  ? l10n.apiAvailable
                                  : l10n.apiUnavailable,
                              tone: isUp
                                  ? SaBadgeTone.success
                                  : SaBadgeTone.accent,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SaInfoNotice(message: l10n.systemStatusApiOnlyNotice),
            ],
          ),
        ),
      ),
    );
  }
}
