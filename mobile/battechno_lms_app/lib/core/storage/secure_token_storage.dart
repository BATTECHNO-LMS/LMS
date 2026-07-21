import 'package:shared_preferences/shared_preferences.dart';

abstract final class SecureStorageKeys {
  static const accessToken = 'battechno_access_token';
}

/// App-private token storage.
///
/// Uses [SharedPreferences] instead of [FlutterSecureStorage] because
/// encrypted SharedPreferences / Android Keystore frequently hangs forever
/// on emulators (and some devices on first Keystore init), which blocked
/// splash bootstrap in a retry loop.
///
/// The preference file is private to the app sandbox. Access tokens are
/// short-lived JWTs; refresh still requires Backend validation via `/auth/me`.
class SecureTokenStorage {
  SecureTokenStorage({SharedPreferences? prefs}) : _prefsOverride = prefs;

  final SharedPreferences? _prefsOverride;

  Future<SharedPreferences> _prefs() async =>
      _prefsOverride ?? SharedPreferences.getInstance();

  Future<String?> readToken() async {
    final prefs = await _prefs();
    final value = prefs.getString(SecureStorageKeys.accessToken);
    if (value == null || value.isEmpty) return null;
    return value;
  }

  Future<void> writeToken(String token) async {
    final prefs = await _prefs();
    await prefs.setString(SecureStorageKeys.accessToken, token);
  }

  Future<void> clearToken() async {
    final prefs = await _prefs();
    await prefs.remove(SecureStorageKeys.accessToken);
  }

  Future<void> clearAll() async {
    final prefs = await _prefs();
    await prefs.remove(SecureStorageKeys.accessToken);
  }
}
