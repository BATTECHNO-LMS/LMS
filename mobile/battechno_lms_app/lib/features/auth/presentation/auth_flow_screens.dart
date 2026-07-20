import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/auth_repository.dart';
import '../providers/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref
        .read(authControllerProvider.notifier)
        .login(_email.text, _password.text);
    if (!mounted) return;
    final state = ref.read(authControllerProvider);
    if (state.errorMessage == 'networkError') {
      context.go('/auth/network-error');
    } else if (state.errorMessage == 'emailNotVerified') {
      context.go(
        '/auth/verify-email?email=${Uri.encodeComponent(_email.text.trim())}',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final error = auth.errorMessage;

    return Scaffold(
      body: SafeArea(
        child: CampusMotifBackground(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const BatLogoHeader(),
                        const SizedBox(height: 16),
                        Text(
                          l10n.welcomeTitle,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.welcomeSubtitle,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 24),
                        AppTextField(
                          controller: _email,
                          label: l10n.email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          validator: (v) => Validators.email(v, l10n),
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 12),
                        PasswordField(
                          controller: _password,
                          label: l10n.password,
                          validator: (v) =>
                              Validators.required(v, l10n.passwordRequired),
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: TextButton(
                            onPressed: () =>
                                context.push('/auth/forgot-password'),
                            child: Text(l10n.forgotPassword),
                          ),
                        ),
                        if (error != null &&
                            error != 'emailNotVerified' &&
                            error != 'networkError')
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: InfoBanner(
                              message: error == 'loginFailed'
                                  ? l10n.loginFailed
                                  : error,
                            ),
                          ),
                        PrimaryButton(
                          label: l10n.login,
                          isLoading: auth.isLoading,
                          onPressed: _submit,
                        ),
                        const SizedBox(height: 12),
                        SecondaryButton(
                          label: l10n.register,
                          onPressed: () => context.push('/auth/register'),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  String? _universityId;
  String? _specialtyId;
  List<Map<String, dynamic>> _universities = [];
  List<Map<String, dynamic>> _specialties = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUniversities();
  }

  Future<void> _loadUniversities() async {
    try {
      final list = await ref
          .read(authRepositoryProvider)
          .fetchRegisterUniversities();
      setState(() => _universities = list);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _loadSpecialties(String universityId) async {
    setState(() {
      _specialtyId = null;
      _specialties = [];
    });
    final list = await ref
        .read(authRepositoryProvider)
        .fetchRegisterSpecialties(universityId);
    setState(() => _specialties = list);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_universityId == null || _specialtyId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .register(
            fullName: _name.text,
            email: _email.text,
            password: _password.text,
            universityId: _universityId!,
            universitySpecialtyId: _specialtyId!,
            phone: _phone.text,
          );
      if (!mounted) return;
      if (result['requiresEmailVerification'] == true) {
        context.go(
          '/auth/verify-email?email=${Uri.encodeComponent(_email.text.trim())}',
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.register)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              children: [
                AppTextField(
                  controller: _name,
                  label: l10n.fullName,
                  validator: (v) => Validators.required(v, l10n.nameRequired),
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _email,
                  label: l10n.email,
                  validator: (v) => Validators.email(v, l10n),
                ),
                const SizedBox(height: 12),
                AppTextField(controller: _phone, label: l10n.phoneOptional),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _universityId,
                  decoration: InputDecoration(labelText: l10n.university),
                  items: [
                    for (final u in _universities)
                      DropdownMenuItem(
                        value: u['id']?.toString(),
                        child: Text(u['name']?.toString() ?? ''),
                      ),
                  ],
                  onChanged: (v) {
                    setState(() => _universityId = v);
                    if (v != null) _loadSpecialties(v);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _specialtyId,
                  decoration: InputDecoration(labelText: l10n.specialty),
                  items: [
                    for (final s in _specialties)
                      DropdownMenuItem(
                        value: s['id']?.toString(),
                        child: Text(
                          s['name_ar']?.toString() ??
                              s['name_en']?.toString() ??
                              '',
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(() => _specialtyId = v),
                ),
                const SizedBox(height: 12),
                PasswordField(
                  controller: _password,
                  label: l10n.password,
                  validator: (v) =>
                      Validators.minLength(v, 6, l10n.passwordMinRegister),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  InfoBanner(message: _error!),
                ],
                const SizedBox(height: 16),
                PrimaryButton(
                  label: l10n.register,
                  isLoading: _loading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _otp = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _verify() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .verifyEmailOtp(email: widget.email, otp: _otp.text);
      if (!mounted) return;
      context.go('/auth/pending');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.verifyEmail)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            OtpInput(
              controller: _otp,
              label: l10n.otpHint,
              validator: (v) => Validators.otp(v, l10n),
            ),
            if (_error != null) InfoBanner(message: _error!),
            const SizedBox(height: 16),
            PrimaryButton(
              label: l10n.continueAction,
              isLoading: _loading,
              onPressed: _verify,
            ),
            TextButton(
              onPressed: () =>
                  ref.read(authRepositoryProvider).resendEmailOtp(widget.email),
              child: Text(l10n.resendCode),
            ),
          ],
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;

  Future<void> _submit() async {
    setState(() => _loading = true);
    await ref.read(authRepositoryProvider).forgotPassword(_email.text);
    if (!mounted) return;
    context.go(
      '/auth/reset-verify?email=${Uri.encodeComponent(_email.text.trim())}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotPassword)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            AppTextField(
              controller: _email,
              label: l10n.email,
              validator: (v) => Validators.email(v, l10n),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: l10n.continueAction,
              isLoading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class ResetVerifyScreen extends ConsumerStatefulWidget {
  const ResetVerifyScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<ResetVerifyScreen> createState() => _ResetVerifyScreenState();
}

class _ResetVerifyScreenState extends ConsumerState<ResetVerifyScreen> {
  final _otp = TextEditingController();
  bool _loading = false;

  Future<void> _submit() async {
    setState(() => _loading = true);
    final token = await ref
        .read(authRepositoryProvider)
        .verifyPasswordResetOtp(email: widget.email, otp: _otp.text);
    if (!mounted) return;
    context.go(
      '/auth/new-password?email=${Uri.encodeComponent(widget.email)}&token=${Uri.encodeComponent(token)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.verifyEmail)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            OtpInput(controller: _otp, label: l10n.otpHint),
            const SizedBox(height: 16),
            PrimaryButton(
              label: l10n.continueAction,
              isLoading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class NewPasswordScreen extends ConsumerStatefulWidget {
  const NewPasswordScreen({
    super.key,
    required this.email,
    required this.resetToken,
  });

  final String email;
  final String resetToken;

  @override
  ConsumerState<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends ConsumerState<NewPasswordScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (_password.text.length < 8) return;
    if (_password.text != _confirm.text) return;
    setState(() => _loading = true);
    await ref
        .read(authRepositoryProvider)
        .resetPassword(
          email: widget.email,
          resetToken: widget.resetToken,
          newPassword: _password.text,
          confirmPassword: _confirm.text,
        );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.resetPassword)));
    context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.resetPassword)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            PasswordField(controller: _password, label: l10n.newPassword),
            const SizedBox(height: 12),
            PasswordField(controller: _confirm, label: l10n.confirmPassword),
            const SizedBox(height: 16),
            PrimaryButton(
              label: l10n.resetPassword,
              isLoading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
