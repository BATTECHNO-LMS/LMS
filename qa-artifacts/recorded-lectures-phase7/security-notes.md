# Security notes (Phase 7)

## YouTube API key

- Server env: `YOUTUBE_API_KEY` in `backend/src/config/env.js` and `backend/.env.example` (empty placeholder).
- YouTube Data API is called only from `fieldTraining.recordedLectures.youtubeClient.js`.
- Request URL includes `key=` internally. Logs record operation, status, duration, and item count — not the URL or key.
- Frontend recorded-lecture player uses YouTube IFrame API only. Production `frontend/dist` search for `YOUTUBE_API_KEY` and `AIza` returned no matches.
- Courses i18n (unrelated module) mentions the env var *name* as an admin hint. That is not a secret value.

Verdict: secret is not exposed. Exposure = NO.

## SSRF

`youtubeUrls.js` allows only http/https and a YouTube host allowlist. Rejected in tests: random domain, `javascript:`, localhost, `127.0.0.1`, `file:`, `data:`, malformed URL. Backend does not fetch admin-supplied arbitrary URLs.

## XSS

Imported titles/descriptions are stored as text. Student UI uses React text nodes, not `dangerouslySetInnerHTML`. Title containing `<script>alert(1)</script>` remains a string.

## Progress forgery

Heartbeat Zod schema and watch service ignore `uniqueWatchedSeconds`, `progressPercentage`, and `completedAt` from the client. Completion is computed from interval union vs duration at 90%.

`fromSecond > toSecond`, span larger than `MAX_HEARTBEAT_SPAN_SECONDS` (~28s), negative values, NaN, Infinity, and overflow are rejected.

## IDOR

Lecture get/update/reorder/sync/heartbeat require opportunity + university/enrollment match. Foreign reorder IDs are rejected. Cross-opportunity session attach is rejected.

## Hard delete

No `DELETE` lecture route. Hide sets `HIDDEN`. Schema still cascades progress if a lecture row is deleted at the database layer. That remains a residual risk for Prisma Studio / raw SQL.

## Rate limit

There is no global `apiLimiter` wired in `app.js`. Phase 7 added `recordedLectureHeartbeatLimiter`: 90 requests / 60s per user+lecture on heartbeat and player-event.

## Logging

YouTube client logs do not include the API key. Error middleware does not send stacks to the browser in production.
