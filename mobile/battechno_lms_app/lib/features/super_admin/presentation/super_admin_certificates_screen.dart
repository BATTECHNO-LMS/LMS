import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../../certificates/domain/certificate_models.dart';
import '../data/super_admin_repository.dart';

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
      appBar: AppBar(
        title: Text(l10n.certificatesTitle),
        leading: BackButton(onPressed: () => context.pop()),
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
        padding: const EdgeInsets.all(16),
        children: [
          for (final cert in _items) ...[
            Card(
              child: ListTile(
                leading: const Icon(Icons.verified_outlined),
                title: Text(cert.displayTitle),
                subtitle: Text(
                  '${l10n.issuedAt}: ${cert.issuedAt.isNotEmpty ? cert.issuedAt.substring(0, 10) : '—'}',
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}
