/// Runtime configuration via `--dart-define` (no secrets in source).
class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.appEnv,
    required this.enableDemoMode,
  });

  static const String _defaultApiBaseUrl = 'https://lms-7txx.onrender.com';

  factory AppConfig.fromEnvironment() {
    const apiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: _defaultApiBaseUrl,
    );
    const appEnv = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'development',
    );
    const enableDemoMode = bool.fromEnvironment(
      'ENABLE_DEMO_MODE',
      defaultValue: false,
    );
    return AppConfig(
      apiBaseUrl: _normalizeBaseUrl(apiBaseUrl),
      appEnv: appEnv,
      enableDemoMode: enableDemoMode,
    );
  }

  final String apiBaseUrl;
  final String appEnv;
  final bool enableDemoMode;

  bool get isProduction => appEnv == 'production';
  bool get isDevelopment => !isProduction;
  String get apiVersion => 'v1';

  String get authRoot => '$apiBaseUrl/api/auth';
  String get apiRoot => '$apiBaseUrl/api/$apiVersion';

  /// Root-level health probe (not under `/api/*`). API availability only —
  /// never exposes the database URL or other environment details.
  String get healthUrl => '$apiBaseUrl/health';

  static String _normalizeBaseUrl(String raw) {
    var url = raw.trim();
    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url;
  }
}
