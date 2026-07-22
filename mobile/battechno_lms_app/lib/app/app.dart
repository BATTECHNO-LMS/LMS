import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/app_config.dart';
import 'localization/l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/bat_theme.dart';

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() => const Locale('ar');

  void toggle() {
    state = state.languageCode == 'ar'
        ? const Locale('en')
        : const Locale('ar');
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

class BattechnoLmsApp extends ConsumerWidget {
  const BattechnoLmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);
    final router = ref.watch(routerProvider);
    final isRtl = locale.languageCode == 'ar';

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'BATTECHNO LMS',
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: BatTheme.light(locale: locale),
      builder: (context, child) {
        return Directionality(
          textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
          child: child ?? const SizedBox.shrink(),
        );
      },
      routerConfig: router,
    );
  }
}

/// Exposed for tests.
AppConfig readAppConfig() => AppConfig.fromEnvironment();
