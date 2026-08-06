/// Safe external URL policy for LMS lesson video/resource links.
bool isSafeLessonUrl(String? raw) {
  if (raw == null) return false;
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;
  final uri = Uri.tryParse(trimmed);
  if (uri == null) return false;
  if (!uri.hasScheme) return false;
  // HTTPS only — reject http, javascript, data, file, etc.
  if (uri.scheme.toLowerCase() != 'https') return false;
  if (uri.host.isEmpty) return false;
  return true;
}

/// Extracts an 11-char YouTube video id from common HTTPS URL shapes.
///
/// Returns null when the URL is unsafe or not a recognized YouTube link.
String? extractYoutubeVideoId(String? raw) {
  if (!isSafeLessonUrl(raw)) return null;
  final uri = Uri.parse(raw!.trim());
  final host = uri.host.toLowerCase();

  if (host == 'youtu.be' || host.endsWith('.youtu.be')) {
    if (uri.pathSegments.isEmpty) return null;
    return _normalizeYoutubeId(uri.pathSegments.first);
  }

  final isYoutube =
      host == 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host == 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com');
  if (!isYoutube) return null;

  final v = uri.queryParameters['v'];
  if (v != null && v.isNotEmpty) {
    return _normalizeYoutubeId(v);
  }

  final segments = uri.pathSegments;
  for (var i = 0; i < segments.length - 1; i++) {
    final part = segments[i];
    if (part == 'embed' ||
        part == 'shorts' ||
        part == 'live' ||
        part == 'v' ||
        part == 'e') {
      return _normalizeYoutubeId(segments[i + 1]);
    }
  }
  return null;
}

String? _normalizeYoutubeId(String raw) {
  final id = raw.split('?').first.split('&').first.trim();
  if (!RegExp(r'^[\w-]{11}$').hasMatch(id)) return null;
  return id;
}
