/**
 * Parse YouTube URLs / IDs (watch, youtu.be, embed, playlist).
 */

function decodeXmlText(s) {
  if (!s) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractYoutubeVideoId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
    }
    const embed = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
    const shorts = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return shorts[1];
  }

  return null;
}

function extractYoutubePlaylistId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    const m = raw.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  const list = url.searchParams.get('list');
  return list || null;
}

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function youtubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

module.exports = {
  decodeXmlText,
  extractYoutubeVideoId,
  extractYoutubePlaylistId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
};
