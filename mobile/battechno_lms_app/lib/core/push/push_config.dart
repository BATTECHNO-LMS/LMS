/// Compile-time gate for Firebase push notifications (MOBILE-PHASE-25).
///
/// Push stays fully disabled — no Firebase initialization, no permission
/// prompts, no token registration — until an owner completes BOTH:
///
///  1. Runs `flutterfire configure` (or otherwise generates
///     `lib/app/firebase_options.dart`) after adding the native config files
///     (`android/app/google-services.json`,
///     `ios/Runner/GoogleService-Info.plist`) and flips [_hasFirebaseOptions]
///     to `true`.
///  2. Builds with `--dart-define=ENABLE_FIREBASE_PUSH=true`.
///
/// This repo intentionally ships neither of those, so [isConfigured] is
/// `false` for every build produced from it — the app remains fully
/// buildable and functional (in-app notifications still work) with push
/// disabled.
abstract final class PushConfig {
  static const bool _enableFlag = bool.fromEnvironment(
    'ENABLE_FIREBASE_PUSH',
    defaultValue: false,
  );

  /// Flip to `true` only after `firebase_options.dart` + native config files
  /// exist. Kept as a separate constant (rather than trusting the build flag
  /// alone) so a CI build that forgets to add config files can never
  /// accidentally call `Firebase.initializeApp()` without options.
  static const bool _hasFirebaseOptions = false;

  static bool get isConfigured => _enableFlag && _hasFirebaseOptions;
}
