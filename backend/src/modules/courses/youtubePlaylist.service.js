const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const {
  decodeXmlText,
  extractYoutubeVideoId,
  extractYoutubePlaylistId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
} = require('./youtube.utils');

async function fetchText(url, accept = 'application/xml, text/xml, application/json') {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'BATTECHNO-LMS/1.0',
      Accept: accept,
    },
  });
  return res;
}

/**
 * Public playlist RSS (no API key). Works for public playlists only.
 * @param {string} playlistId
 */
async function fetchPlaylistFromRss(playlistId) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const res = await fetchText(feedUrl);
  if (!res.ok) {
    return null;
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

  if (!videos.length) return null;
  return { playlist_id: playlistId, videos };
}

/**
 * YouTube Data API v3 — supports public and unlisted playlists (not private).
 * @param {string} playlistId
 */
async function fetchPlaylistFromApi(playlistId) {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const videos = [];
  let pageToken;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;
    const res = await fetchText(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const quota = res.status === 403 && /quota/i.test(body);
      if (quota) {
        throw new ApiError(503, 'تجاوز حد YouTube API. حاول لاحقًا أو استخدم قائمة عامة.');
      }
      return null;
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) continue;
      const title = String(item.snippet?.title || `درس ${videos.length + 1}`).trim();
      videos.push({
        video_id: videoId,
        title,
        watch_url: youtubeWatchUrl(videoId),
        thumbnail_url: youtubeThumbnailUrl(videoId),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (!videos.length) return null;
  return { playlist_id: playlistId, videos };
}

function playlistFetchError() {
  if (env.YOUTUBE_API_KEY) {
    return new ApiError(
      400,
      'تعذر جلب قائمة التشغيل. تأكد أن الرابط صحيح وأن القائمة ليست خاصة، أو أن الفيديوهات لم تُحذف.'
    );
  }
  return new ApiError(
    400,
    'تعذر جلب قائمة التشغيل. القوائم «غير المدرجة» أو الخاصة لا تعمل بدون مفتاح YouTube API. اجعل القائمة عامة، أو أضف YOUTUBE_API_KEY في إعدادات الخادم (Render).'
  );
}

/**
 * @param {string} playlistId
 */
async function fetchPlaylistVideos(playlistId) {
  const fromRss = await fetchPlaylistFromRss(playlistId);
  if (fromRss?.videos?.length) return fromRss;

  const fromApi = await fetchPlaylistFromApi(playlistId);
  if (fromApi?.videos?.length) return fromApi;

  throw playlistFetchError();
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
    return fetchPlaylistVideos(playlistId);
  }

  const video = await fetchVideoFromOembed(url);
  return { videos: [video] };
}

module.exports = {
  previewYoutube,
  fetchPlaylistFromRss,
  fetchPlaylistFromApi,
  fetchPlaylistVideos,
  fetchVideoFromOembed,
};
