import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/super_admin_repository.dart';
import 'widgets/super_admin_widgets.dart';

/// Minimal create/edit form: name (required), contact person/email/phone
/// (optional). Kept deliberately simple — the web app owns the full
/// university form (type, partnership state, notes, etc.).
class SuperAdminUniversityFormScreen extends ConsumerStatefulWidget {
  const SuperAdminUniversityFormScreen({super.key, this.universityId});

  final String? universityId;

  @override
  ConsumerState<SuperAdminUniversityFormScreen> createState() =>
      _SuperAdminUniversityFormScreenState();
}

class _SuperAdminUniversityFormScreenState
    extends ConsumerState<SuperAdminUniversityFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _contactPersonCtrl = TextEditingController();
  final _contactEmailCtrl = TextEditingController();
  final _contactPhoneCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.universityId != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    } else {
      _loading = false;
    }
  }

  Future<void> _load() async {
    try {
      final uni = await ref
          .read(superAdminRepositoryProvider)
          .getUniversity(widget.universityId!, includeCounts: false);
      if (uni != null) {
        _nameCtrl.text = uni.name;
        _contactPersonCtrl.text = uni.contactPerson ?? '';
        _contactEmailCtrl.text = uni.contactEmail ?? '';
        _contactPhoneCtrl.text = uni.contactPhone ?? '';
      } else {
        _error = 'forbidden';
      }
    } on ApiException catch (e) {
      _error = e.isNetwork ? 'network' : e.message;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final repo = ref.read(superAdminRepositoryProvider);
      if (_isEdit) {
        await repo.updateUniversity(
          id: widget.universityId!,
          body: {
            'name': _nameCtrl.text.trim(),
            'contact_person': _contactPersonCtrl.text.trim().isEmpty
                ? null
                : _contactPersonCtrl.text.trim(),
            'contact_email': _contactEmailCtrl.text.trim().isEmpty
                ? null
                : _contactEmailCtrl.text.trim(),
            'contact_phone': _contactPhoneCtrl.text.trim().isEmpty
                ? null
                : _contactPhoneCtrl.text.trim(),
          },
        );
      } else {
        await repo.createUniversity(
          name: _nameCtrl.text.trim(),
          contactPerson: _contactPersonCtrl.text.trim(),
          contactEmail: _contactEmailCtrl.text.trim(),
          contactPhone: _contactPhoneCtrl.text.trim(),
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.universitySaved)));
        context.pop();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.statusCode == 409
                  ? l10n.universityNameTaken
                  : e.statusCode == 403
                  ? l10n.forbiddenAccess
                  : e.message,
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactPersonCtrl.dispose();
    _contactEmailCtrl.dispose();
    _contactPhoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kSaPageBg,
      appBar: saAppBar(
        context,
        title: _isEdit ? l10n.editUniversity : l10n.createUniversity,
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
    if (_error != null && _nameCtrl.text.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SaSoftCard(
            child: Column(
              children: [
                TextFormField(
                  controller: _nameCtrl,
                  decoration: saSoftFieldDecoration(l10n.universityNameLabel),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.nameRequired
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _contactPersonCtrl,
                  decoration: saSoftFieldDecoration(l10n.contactPersonLabel),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _contactEmailCtrl,
                  decoration: saSoftFieldDecoration(l10n.email),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _contactPhoneCtrl,
                  decoration: saSoftFieldDecoration(l10n.phoneOptional),
                  keyboardType: TextInputType.phone,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            style: saPrimaryButtonStyle(),
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(l10n.save),
          ),
        ],
      ),
    );
  }
}
