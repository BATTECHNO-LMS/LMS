const { ApiError } = require('../../utils/apiError');
const {
  decodeXmlText,
  extractYoutubeVideoId,
  extractYoutubePlaylistId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
} = require('./youtube.utils');

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'BATTECHNO-LMS/1.0',
      Accept: 'application/xml, text/xml, application/json',
    },
  });
  return res;
}

/**
 * Public playlist RSS (no API key).
 * @param {string} playlistId
 */
async function fetchPlaylistFromRss(playlistId) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const res = await fetchText(feedUrl);
  if (!res.ok) {
    throw new ApiError(400, 'تعذر جلب قائمة التشغيل. تأكد أن القائمة عامة وصالحة.');
  }
  const xml = await res.text();
  const chunks = xml.split('<entry>').slice(1);
  const videos = [];

  for (const chunk of chunks) {
    const videoId = chunk.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) continue;
    const titleMatch = chunk.match(/<title>([^<]*)<\/title>/);
    const title = decodeXmlText(titleMatch?.[1] || `درس ${videos.length + 1}`);
    videos.push({
      video_id: videoId,
      title,
      watch_url: youtubeWatchUrl(videoId),
      thumbnail_url: youtubeThumbnailUrl(videoId),
    });
  }

  if (!videos.length) {
    throw new ApiError(400, 'لم يتم العثور على فيديوهات في قائمة التشغيل.');
  }

  return { playlist_id: playlistId, videos };
}

async function fetchVideoFromOembed(urlOrId) {
  const videoId = extractYoutubeVideoId(urlOrId);
  if (!videoId) {
    throw new ApiError(400, 'رابط يوتيوب غير صالح');
  }

  const watchUrl = youtubeWatchUrl(videoId);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const res = await fetchText(oembedUrl);
  if (!res.ok) {
    return {
      video_id: videoId,
      title: `درس ${videoId}`,
      watch_url: watchUrl,
      thumbnail_url: youtubeThumbnailUrl(videoId),
    };
  }

  const data = await res.json();
  return {
    video_id: videoId,
    title: String(data.title || `درس ${videoId}`).trim(),
    watch_url: watchUrl,
    thumbnail_url: data.thumbnail_url || youtubeThumbnailUrl(videoId),
  };
}

/**
 * @param {{ url: string }} input
 */
async function previewYoutube(input) {
  const url = String(input.url ?? '').trim();
  if (!url) throw new ApiError(400, 'الرابط مطلوب');

  const playlistId = extractYoutubePlaylistId(url);
  if (playlistId) {
    return fetchPlaylistFromRss(playlistId);
  }

  const video = await fetchVideoFromOembed(url);
  return { videos: [video] };
}

module.exports = { previewYoutube, fetchPlaylistFromRss, fetchVideoFromOembed };
