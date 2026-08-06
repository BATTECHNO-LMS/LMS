import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/config/app_config.dart';
import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/certificates_repository.dart';
import '../domain/certificate_models.dart';
import 'certificate_design_widgets.dart';

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
      backgroundColor: kCertPageBg,
      appBar: AppBar(
        title: Text(l10n.certificateDetails),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
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

    final issued = cert.status == 'issued';
    final issuedDate = cert.issuedAt.isNotEmpty && cert.issuedAt.length >= 10
        ? cert.issuedAt.substring(0, 10)
        : (cert.issuedAt.isNotEmpty ? cert.issuedAt : '—');

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          CertSoftCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.verified_outlined,
                    color: BatColors.primary,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cert.displayTitle,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                              height: 1.25,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: issued
                              ? BatColors.success.withValues(alpha: 0.12)
                              : const Color(0xFFEEF0F3),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          CertificateLabels.statusAr(cert.status),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: issued
                                    ? BatColors.successText
                                    : const Color(0xFF8B93A0),
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          CertSoftCard(
            child: Column(
              children: [
                CertMetaRow(
                  icon: Icons.tag_outlined,
                  label: l10n.certificateNumber,
                  value: cert.certificateNo.isNotEmpty
                      ? cert.certificateNo
                      : '—',
                ),
                const SizedBox(height: 12),
                CertMetaRow(
                  icon: Icons.event_outlined,
                  label: l10n.issuedAt,
                  value: issuedDate,
                ),
                const SizedBox(height: 12),
                CertMetaRow(
                  icon: Icons.info_outline,
                  label: l10n.certificateStatus,
                  value: CertificateLabels.statusAr(cert.status),
                  valueColor: issued
                      ? BatColors.successText
                      : BatColors.heading,
                ),
                if (cert.verificationCode.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  CertMetaRow(
                    icon: Icons.qr_code_2_outlined,
                    label: l10n.verificationCode,
                    value: cert.verificationCode,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          CertSoftCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: BatColors.accentSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.info_outline,
                    color: BatColors.accentHover,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    l10n.certificateDownloadUnavailable,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: BatColors.heading,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: cert.verificationCode.isEmpty
                  ? null
                  : _openVerification,
              icon: const Icon(Icons.open_in_new, size: 18),
              label: Text(
                l10n.verifyCertificate,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: BatColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFE9EBEE),
                disabledForegroundColor: const Color(0xFF8B93A0),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
