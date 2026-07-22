import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Read-only offline cache scoped per user. Never stores tokens or passwords.
class OfflineCache {
  OfflineCache(this._prefs);

  final SharedPreferences _prefs;

  static Future<OfflineCache> open() async {
    return OfflineCache(await SharedPreferences.getInstance());
  }

  String _key(String userId, String namespace) =>
      'bat_cache_${userId}_$namespace';

  Future<void> writeJson({
    required String userId,
    required String namespace,
    required Map<String, dynamic> payload,
  }) async {
    await _prefs.setString(
      _key(userId, namespace),
      jsonEncode({
        'saved_at': DateTime.now().toIso8601String(),
        'data': payload,
      }),
    );
  }

  CachedPayload? readJson({required String userId, required String namespace}) {
    final raw = _prefs.getString(_key(userId, namespace));
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return CachedPayload(
        savedAt:
            DateTime.tryParse(decoded['saved_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
        data: decoded['data'] is Map<String, dynamic>
            ? decoded['data'] as Map<String, dynamic>
            : {},
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUser(String userId) async {
    final prefix = 'bat_cache_${userId}_';
    for (final key in _prefs.getKeys()) {
      if (key.startsWith(prefix)) {
        await _prefs.remove(key);
      }
    }
  }

  Future<void> clearAll() async {
    for (final key in _prefs.getKeys()) {
      if (key.startsWith('bat_cache_')) {
        await _prefs.remove(key);
      }
    }
  }
}

class CachedPayload {
  const CachedPayload({required this.savedAt, required this.data});

  final DateTime savedAt;
  final Map<String, dynamic> data;
}
