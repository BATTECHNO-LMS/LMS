import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../../training/data/student_training_repository.dart';
import '../data/certificates_repository.dart';
import '../domain/certificate_models.dart';
import 'certificate_design_widgets.dart';

class CertificatesHubScreen extends ConsumerStatefulWidget {
  const CertificatesHubScreen({super.key});

  @override
  ConsumerState<CertificatesHubScreen> createState() =>
      _CertificatesHubScreenState();
}

class _CertificatesHubScreenState extends ConsumerState<CertificatesHubScreen> {
  List<StudentCertificate> _certificates = const [];
  List<CompletionLetterItem> _letters = const [];
  bool _loading = true;
  String? _error;
  String? _downloadingId;

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
      final user = ref.read(authControllerProvider).user!;
      final certs = await ref
          .read(certificatesRepositoryProvider)
          .loadCertificates();
      final training = await ref
          .read(studentTrainingRepositoryProvider)
          .load(userId: user.id);
      final letters = ref
          .read(certificatesRepositoryProvider)
          .completionLettersFromApplications(training.applications);
      setState(() {
        _certificates = certs;
        _letters = letters;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _downloadLetter(CompletionLetterItem letter) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _downloadingId = letter.applicationId);
    try {
      final file = await ref
          .read(certificatesRepositoryProvider)
          .downloadCompletionLetter(letter.applicationId);
      await ref.read(secureFileServiceProvider).openFile(file);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.documentDownloadFailed)));
    } finally {
      if (mounted) setState(() => _downloadingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kCertPageBg,
      appBar: AppBar(
        title: Text(l10n.certificatesAndDocuments),
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

    if (_certificates.isEmpty && _letters.isEmpty) {
      return EmptyState(
        title: l10n.noCertificatesOrDocuments,
        icon: Icons.workspace_premium_outlined,
      );
    }

    final total = _certificates.length + _letters.length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          CertSoftCard(
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
                        l10n.certificatesAndDocuments,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.certificatesTitle,
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
                    '$total',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: BatColors.accentHover,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_certificates.isNotEmpty) ...[
            const SizedBox(height: 18),
            CertSectionLabel(
              title: l10n.certificatesTitle,
              count: _certificates.length,
            ),
            const SizedBox(height: 10),
            for (final cert in _certificates)
              _CertificateListCard(
                title: cert.displayTitle,
                subtitle:
                    '${l10n.issuedAt}: ${cert.issuedAt.isNotEmpty && cert.issuedAt.length >= 10 ? cert.issuedAt.substring(0, 10) : (cert.issuedAt.isNotEmpty ? cert.issuedAt : '—')}',
                status: CertificateLabels.statusAr(cert.status),
                issued: cert.status == 'issued',
                onTap: () => context.push('/student/certificates/${cert.id}'),
              ),
          ],
          if (_letters.isNotEmpty) ...[
            const SizedBox(height: 14),
            CertSectionLabel(
              title: l10n.officialLetters,
              count: _letters.length,
            ),
            const SizedBox(height: 10),
            for (final letter in _letters)
              _LetterListCard(
                title: letter.opportunityTitle,
                subtitle: l10n.completionLetter,
                downloading: _downloadingId == letter.applicationId,
                onDownload: () => _downloadLetter(letter),
              ),
          ],
        ],
      ),
    );
  }
}

class _CertificateListCard extends StatelessWidget {
  const _CertificateListCard({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.issued,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String status;
  final bool issued;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE6E8EC)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1A2330).withValues(alpha: 0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
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
                          title,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: BatColors.muted),
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
                            status,
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
                  const Icon(Icons.chevron_left, color: BatColors.muted),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LetterListCard extends StatelessWidget {
  const _LetterListCard({
    required this.title,
    required this.subtitle,
    required this.downloading,
    required this.onDownload,
  });

  final String title;
  final String subtitle;
  final bool downloading;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE6E8EC)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1A2330).withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 8, 14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: BatColors.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  color: BatColors.accentHover,
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
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: downloading ? null : onDownload,
                icon: downloading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(
                        Icons.download_outlined,
                        color: BatColors.primary,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
