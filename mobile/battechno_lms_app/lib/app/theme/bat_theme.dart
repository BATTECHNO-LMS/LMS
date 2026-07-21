import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'bat_colors.dart';

abstract final class BatTheme {
  static ThemeData light({required Locale locale}) {
    final isArabic = locale.languageCode == 'ar';
    // Prefer Tajawal/Inter when available offline; never hang splash on font CDN.
    late final TextTheme baseText;
    try {
      baseText = isArabic
          ? GoogleFonts.tajawalTextTheme(ThemeData.light().textTheme)
          : GoogleFonts.interTextTheme(ThemeData.light().textTheme);
    } catch (_) {
      baseText = ThemeData.light().textTheme;
    }

    final colorScheme = ColorScheme.light(
      primary: BatColors.primary,
      onPrimary: Colors.white,
      secondary: BatColors.secondary,
      onSecondary: Colors.white,
      tertiary: BatColors.accent,
      onTertiary: BatColors.primary,
      error: BatColors.danger,
      onError: Colors.white,
      surface: BatColors.surface,
      onSurface: BatColors.onSurface,
      outline: BatColors.outline,
      surfaceContainerHighest: BatColors.surfaceAlt,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: BatColors.background,
      textTheme: baseText.apply(
        bodyColor: BatColors.onSurface,
        displayColor: BatColors.heading,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: BatColors.surface,
        foregroundColor: BatColors.heading,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: baseText.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: BatColors.heading,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: BatColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BatRadii.md),
          borderSide: const BorderSide(color: BatColors.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BatRadii.md),
          borderSide: const BorderSide(color: BatColors.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BatRadii.md),
          borderSide: const BorderSide(color: BatColors.accent, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BatRadii.md),
          borderSide: const BorderSide(color: BatColors.danger),
        ),
        labelStyle: baseText.bodyMedium?.copyWith(color: BatColors.muted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: BatColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(BatRadii.md),
          ),
          textStyle: baseText.labelLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: BatColors.primary,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: BatColors.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(BatRadii.md),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: BatColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(BatRadii.lg),
          side: const BorderSide(color: BatColors.outlineVariant),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(BatRadii.lg),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: BatColors.surface,
        selectedItemColor: BatColors.primary,
        unselectedItemColor: BatColors.muted,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dividerTheme: const DividerThemeData(color: BatColors.outlineVariant),
    );
  }
}
