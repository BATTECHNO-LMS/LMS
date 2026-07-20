import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';

/// Sectioned create/edit form for a field-training opportunity.
/// Creation requires resolving eligibility from the university's eligibility
/// catalog entry (the admin's own university, per backend university scoping).
class AdminOpportunityFormScreen extends ConsumerStatefulWidget {
  const AdminOpportunityFormScreen({super.key, this.opportunityId});

  final String? opportunityId;

  @override
  ConsumerState<AdminOpportunityFormScreen> createState() =>
      _AdminOpportunityFormScreenState();
}

class _AdminOpportunityFormScreenState
    extends ConsumerState<AdminOpportunityFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _startDateCtrl = TextEditingController();
  final _endDateCtrl = TextEditingController();
  final _requiredHoursCtrl = TextEditingController();

  bool get isEdit => widget.opportunityId != null;

  String _trainingMode = 'onsite';
  String? _assignedInstructorId;
  List<Map<String, dynamic>> _instructors = const [];

  Map<String, dynamic>? _catalogUniversity;
  Map<String, dynamic>? _selectedSpecialtyEntry;

  bool _loading = true;
  bool _saving = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    _locationCtrl.dispose();
    _startDateCtrl.dispose();
    _endDateCtrl.dispose();
    _requiredHoursCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final repo = ref.read(adminRepositoryProvider);
      final results = await Future.wait([
        repo.listInstructors(),
        if (!isEdit) repo.getEligibilityCatalog(),
        if (isEdit) repo.getOpportunity(widget.opportunityId!),
      ]);
      _instructors = results[0] as List<Map<String, dynamic>>;

      if (!isEdit) {
        final catalog = results[1] as Map<String, dynamic>;
        final universities = (catalog['universities'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList();
        final user = ref.read(authControllerProvider).user;
        _catalogUniversity = universities.firstWhere(
          (u) => u['id']?.toString() == user?.universityId,
          orElse: () => universities.isNotEmpty ? universities.first : {},
        );
        if (_catalogUniversity?.isEmpty ?? true) _catalogUniversity = null;
      } else {
        final data = results[1] as Map<String, dynamic>;
        final opp = data['opportunity'] is Map<String, dynamic>
            ? data['opportunity'] as Map<String, dynamic>
            : data;
        _titleCtrl.text = opp['title']?.toString() ?? '';
        _descriptionCtrl.text = opp['description']?.toString() ?? '';
        _locationCtrl.text = opp['location']?.toString() ?? '';
        _startDateCtrl.text =
            opp['start_date']?.toString().split('T').first ?? '';
        _endDateCtrl.text = opp['end_date']?.toString().split('T').first ?? '';
        final hours = opp['required_training_hours'];
        _requiredHoursCtrl.text = hours != null ? hours.toString() : '';
        _trainingMode = opp['training_mode']?.toString() ?? 'onsite';
        _assignedInstructorId = opp['assigned_instructor_id']?.toString();
      }
    } on ApiException catch (e) {
      _loadError = e.isNetwork ? 'network' : e.message;
    } catch (_) {
      _loadError = 'unknown';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!isEdit && _selectedSpecialtyEntry == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.specialtyRequired)));
      return;
    }

    setState(() => _saving = true);
    final requiredHoursText = _requiredHoursCtrl.text.trim();
    final body = <String, dynamic>{
      'title': _titleCtrl.text.trim(),
      'description': _descriptionCtrl.text.trim().isEmpty
          ? null
          : _descriptionCtrl.text.trim(),
      'location': _locationCtrl.text.trim(),
      'training_mode': _trainingMode,
      'start_date': _startDateCtrl.text.trim().isEmpty
          ? null
          : _startDateCtrl.text.trim(),
      'end_date': _endDateCtrl.text.trim().isEmpty
          ? null
          : _endDateCtrl.text.trim(),
      'required_training_hours': requiredHoursText.isEmpty
          ? null
          : int.tryParse(requiredHoursText),
      'assigned_instructor_id': _assignedInstructorId,
    };

    if (!isEdit) {
      final entry = _selectedSpecialtyEntry!;
      body['specialty_id'] = entry['canonicalSpecialtyId'];
      body['eligibility'] = [
        {
          'university_id': _catalogUniversity!['id'],
          'university_specialty_id': entry['id'],
        },
      ];
    }

    try {
      final repo = ref.read(adminRepositoryProvider);
      if (isEdit) {
        await repo.updateOpportunity(id: widget.opportunityId!, body: body);
      } else {
        await repo.createOpportunity(body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.opportunitySaved)));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : e.statusCode == 422
          ? l10n.validationError
          : e.message;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? l10n.editOpportunity : l10n.createOpportunity),
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 6),
            )
          : _loadError != null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _loadError == 'network'
                  ? l10n.networkErrorBody
                  : _loadError!,
              onRetry: _bootstrap,
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  AppTextField(
                    controller: _titleCtrl,
                    label: l10n.opportunityTitleLabel,
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? l10n.validationError
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _descriptionCtrl,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: l10n.description,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  AppTextField(
                    controller: _locationCtrl,
                    label: l10n.locationLabel,
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? l10n.validationError
                        : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _trainingMode,
                    decoration: InputDecoration(
                      labelText: l10n.trainingModeLabel,
                      border: const OutlineInputBorder(),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: 'onsite',
                        child: Text(AdminLabels.modeAr('onsite')),
                      ),
                      DropdownMenuItem(
                        value: 'remote',
                        child: Text(AdminLabels.modeAr('remote')),
                      ),
                      DropdownMenuItem(
                        value: 'hybrid',
                        child: Text(AdminLabels.modeAr('hybrid')),
                      ),
                    ],
                    onChanged: (v) =>
                        setState(() => _trainingMode = v ?? 'onsite'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _startDateCtrl,
                          decoration: InputDecoration(
                            labelText: l10n.startDateLabel,
                            hintText: 'YYYY-MM-DD',
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          controller: _endDateCtrl,
                          decoration: InputDecoration(
                            labelText: l10n.endDateLabel,
                            hintText: 'YYYY-MM-DD',
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _requiredHoursCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.requiredHoursLabel,
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => AdminLabels.isValidRequiredHours(v ?? '')
                        ? null
                        : l10n.invalidRequiredHours,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _assignedInstructorId,
                    decoration: InputDecoration(
                      labelText: l10n.assignedInstructorLabel,
                      border: const OutlineInputBorder(),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(l10n.hoursNotSpecified),
                      ),
                      for (final ins in _instructors)
                        DropdownMenuItem(
                          value: ins['id']?.toString(),
                          child: Text(ins['full_name']?.toString() ?? '—'),
                        ),
                    ],
                    onChanged: (v) => setState(() => _assignedInstructorId = v),
                  ),
                  if (!isEdit) ...[
                    const SizedBox(height: 12),
                    if (_catalogUniversity == null)
                      InfoBanner(message: l10n.specialtyCatalogUnavailable)
                    else
                      DropdownButtonFormField<Map<String, dynamic>>(
                        initialValue: _selectedSpecialtyEntry,
                        decoration: InputDecoration(
                          labelText: l10n.specialty,
                          border: const OutlineInputBorder(),
                        ),
                        items: [
                          for (final s
                              in (_catalogUniversity!['specialties'] as List? ??
                                      const [])
                                  .whereType<Map<String, dynamic>>())
                            DropdownMenuItem(
                              value: s,
                              child: Text(
                                s['nameAr']?.toString() ??
                                    s['nameEn']?.toString() ??
                                    '—',
                              ),
                            ),
                        ],
                        onChanged: (v) =>
                            setState(() => _selectedSpecialtyEntry = v),
                        validator: (v) =>
                            v == null ? l10n.specialtyRequired : null,
                      ),
                  ],
                  const SizedBox(height: 24),
                  PrimaryButton(
                    label: l10n.save,
                    isLoading: _saving,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
