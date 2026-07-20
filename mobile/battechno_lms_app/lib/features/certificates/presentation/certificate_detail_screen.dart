import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/config/app_config.dart';
import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/certificates_repository.dart';
import '../domain/certificate_models.dart';

class CertificateDetailScreen extends ConsumerStatefulWidget {
  const CertificateDetailScreen({super.key, required this.certificateId});

  final String certificateId;

  @override
  ConsumerState<CertificateDetailScreen> createState() =>
      _CertificateDetailScreenState();
}

class _CertificateDetailScreenState
    extends ConsumerState<CertificateDetailScreen> {
  StudentCertificate? _certificate;
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
      final cert = await ref
          .read(certificatesRepositoryProvider)
          .loadCertificate(widget.certificateId);
      setState(() => _certificate = cert);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openVerification() async {
    final l10n = AppLocalizations.of(context);
    final code = _certificate?.verificationCode;
    if (code == null || code.isEmpty) return;
    final config = AppConfig.fromEnvironment();
    final url = '${config.apiBaseUrl}/verify/certificate/$code';
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.invalidMeetingLink)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.certificateDetails),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    final cert = _certificate;
    if (cert == null) {
      return EmptyState(title: l10n.certificateNotFound);
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cert.displayTitle,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text('${l10n.certificateNumber}: ${cert.certificateNo}'),
                Text('${l10n.issuedAt}: ${cert.issuedAt}'),
                Text(
                  '${l10n.certificateStatus}: ${CertificateLabels.statusAr(cert.status)}',
                ),
                if (cert.verificationCode.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('${l10n.verificationCode}: ${cert.verificationCode}'),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        InfoBanner(message: l10n.certificateDownloadUnavailable),
        const SizedBox(height: 12),
        PrimaryButton(
          label: l10n.verifyCertificate,
          onPressed: cert.verificationCode.isEmpty ? null : _openVerification,
        ),
      ],
    );
  }
}
