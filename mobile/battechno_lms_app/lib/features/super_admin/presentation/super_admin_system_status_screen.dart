import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';

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
      appBar: AppBar(
        title: Text(l10n.systemStatusTitle),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _check,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_loading && !_checked)
                const LoadingSkeleton(lines: 2)
              else
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(
                          isUp
                              ? Icons.check_circle_outline
                              : Icons.error_outline,
                          color: isUp ? BatColors.success : BatColors.danger,
                          size: 32,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isUp ? l10n.apiAvailable : l10n.apiUnavailable,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (_health?['service'] != null)
                                Text(_health!['service'].toString()),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              InfoBanner(message: l10n.systemStatusApiOnlyNotice),
            ],
          ),
        ),
      ),
    );
  }
}
