import '../../../app/localization/l10n/app_localizations.dart';

class Validators {
  static String? required(String? value, String message) {
    if (value == null || value.trim().isEmpty) return message;
    return null;
  }

  static String? email(String? value, AppLocalizations l10n) {
    final requiredError = Validators.required(value, l10n.emailRequired);
    if (requiredError != null) return requiredError;
    final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
    if (!emailRegex.hasMatch(value!.trim())) return l10n.emailInvalid;
    return null;
  }

  static String? minLength(String? value, int min, String message) {
    if (value == null || value.length < min) return message;
    return null;
  }

  static String? otp(String? value, AppLocalizations l10n) {
    final requiredError = required(value, l10n.otpRequired);
    if (requiredError != null) return requiredError;
    if (!RegExp(r'^\d{6}$').hasMatch(value!.trim())) return l10n.otpInvalid;
    return null;
  }
}
