import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/files/secure_file_service.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../../training/data/student_training_repository.dart';
import '../data/certificates_repository.dart';
import '../domain/certificate_models.dart';

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
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.certificatesAndDocuments),
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

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_certificates.isNotEmpty) ...[
            AcademicSectionHeader(title: l10n.certificatesTitle),
            const SizedBox(height: 8),
            ..._certificates.map(
              (cert) => Card(
                child: ListTile(
                  leading: const Icon(Icons.verified_outlined),
                  title: Text(cert.displayTitle),
                  subtitle: Text(
                    '${l10n.issuedAt}: ${cert.issuedAt.isNotEmpty ? cert.issuedAt.substring(0, 10) : '—'}',
                  ),
                  trailing: const Icon(Icons.chevron_left),
                  onTap: () => context.push('/student/certificates/${cert.id}'),
                ),
              ),
            ),
          ],
          if (_letters.isNotEmpty) ...[
            const SizedBox(height: 16),
            AcademicSectionHeader(title: l10n.officialLetters),
            const SizedBox(height: 8),
            ..._letters.map(
              (letter) => Card(
                child: ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text(letter.opportunityTitle),
                  subtitle: Text(l10n.completionLetter),
                  trailing: IconButton(
                    icon: const Icon(Icons.download_outlined),
                    onPressed: () => _downloadLetter(letter),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
