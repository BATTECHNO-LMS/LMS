import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _navigated = false;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_started) return;
      _started = true;
      _bootstrapAndNavigate();
    });
  }

  Future<void> _bootstrapAndNavigate() async {
    final auth = ref.read(authControllerProvider.notifier);
    try {
      await auth.bootstrap().timeout(const Duration(seconds: 25));
    } on TimeoutException {
      auth.markBootstrapTimedOut();
    } catch (_) {
      auth.markBootstrapTimedOut();
    }
    if (!mounted || _navigated) return;
    _goForStatus(ref.read(authControllerProvider).status);
  }

  void _goForStatus(AuthStatus status) {
    if (!mounted || _navigated) return;
    if (status == AuthStatus.unknown) return;
    _navigated = true;
    switch (status) {
      case AuthStatus.authenticated:
        context.go('/home');
      case AuthStatus.pendingApproval:
        context.go('/auth/pending');
      case AuthStatus.inactive:
        context.go('/auth/inactive');
      case AuthStatus.unsupportedRole:
        context.go('/auth/unsupported');
      case AuthStatus.unauthenticated:
      case AuthStatus.unknown:
        context.go('/auth/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    ref.listen(authControllerProvider, (prev, next) {
      if (next.status != AuthStatus.unknown) {
        _goForStatus(next.status);
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const BatLogoHeader(height: 96),
              const SizedBox(height: 24),
              Text(l10n.appTagline, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              const CircularProgressIndicator(),
              const SizedBox(height: 12),
              Text(l10n.loading),
            ],
          ),
        ),
      ),
    );
  }
}
