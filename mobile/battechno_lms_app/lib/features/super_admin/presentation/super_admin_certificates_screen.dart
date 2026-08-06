import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../../certificates/domain/certificate_models.dart';
import '../data/super_admin_repository.dart';
import 'widgets/super_admin_widgets.dart';

/// Read-only certificate listing. Issuing certificates and status changes
/// remain staff-role actions (`university_admin`/`academic_admin`) and are
/// intentionally not offered here.
class SuperAdminCertificatesScreen extends ConsumerStatefulWidget {
  const SuperAdminCertificatesScreen({super.key});

  @override
  ConsumerState<SuperAdminCertificatesScreen> createState() =>
      _SuperAdminCertificatesScreenState();
}

class _SuperAdminCertificatesScreenState
    extends ConsumerState<SuperAdminCertificatesScreen> {
  List<StudentCertificate> _items = const [];
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
      final userId = ref.read(authControllerProvider).user?.id;
      final raw = await ref
          .read(superAdminRepositoryProvider)
          .listCertificates(userId: userId);
      setState(() => _items = raw.map(StudentCertificate.fromMap).toList());
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
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: l10n.certificatesTitle,
        onBack: () => context.pop(),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading && _items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && _items.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.certificatesUnavailableForRole
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (_items.isEmpty) {
      return EmptyState(
        title: l10n.noCertificatesOrDocuments,
        icon: Icons.workspace_premium_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          SaSoftCard(
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
                    Icons.workspace_premium_outlined,
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
                        l10n.certificatesTitle,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.superAdminGlobalScopeNotice,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
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
                    '${_items.length}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: BatColors.accentHover,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SaSectionHeader(title: l10n.certificatesTitle, count: _items.length),
          const SizedBox(height: 10),
          for (final cert in _items) _certCard(l10n, cert),
        ],
      ),
    );
  }

  Widget _certCard(AppLocalizations l10n, StudentCertificate cert) {
    final issued = cert.status == 'issued';
    final issuedDate = cert.issuedAt.isNotEmpty && cert.issuedAt.length >= 10
        ? cert.issuedAt.substring(0, 10)
        : (cert.issuedAt.isNotEmpty ? cert.issuedAt : '—');

    return SaSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.verified_outlined,
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
                  cert.displayTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${l10n.issuedAt}: $issuedDate',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
                const SizedBox(height: 8),
                SaStatusBadge(
                  label: CertificateLabels.statusAr(cert.status),
                  tone: issued ? SaBadgeTone.success : SaBadgeTone.neutral,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
