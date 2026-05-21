const test = require('node:test');

const assert = require('node:assert');
const { extractYoutubePlaylistId } = require('../src/modules/courses/youtube.utils');

test('extractYoutubePlaylistId from watch URL with list param', () => {
  const id = extractYoutubePlaylistId(
    'https://www.youtube.com/watch?v=abc12345678&list=PLrAXtmRdnEQy6nuLM'
  );
  assert.strictEqual(id, 'PLrAXtmRdnEQy6nuLM');
});

test('extractYoutubePlaylistId from playlist URL', () => {
  const id = extractYoutubePlaylistId('https://www.youtube.com/playlist?list=PLtest123');
  assert.strictEqual(id, 'PLtest123');
});
