'use strict';

const { validateRequest } = require('../../middlewares/validate.middleware');
const { uuidParamSchema, opportunityIdParamSchema } = require('./fieldTraining.validation');
const {
  lectureIdParamSchema,
  opportunityLectureParamSchema,
  createRecordedLectureBodySchema,
  updateRecordedLectureBodySchema,
  changeLectureStatusBodySchema,
  youtubeUrlBodySchema,
  youtubePlaylistImportBodySchema,
  reorderLecturesBodySchema,
  youtubePlaylistSyncBodySchema,
  watchSessionBodySchema,
  heartbeatBodySchema,
  playerEventBodySchema,
  progressRosterQuerySchema,
} = require('./fieldTraining.recordedLectures.validation');
const controller = require('./fieldTraining.recordedLectures.controller');
const {
  recordedLectureHeartbeatLimiter,
} = require('./fieldTraining.recordedLectures.heartbeatRateLimit.middleware');

function mountManageRoutes(router, authorize) {
  router.post(
    '/:id/recorded-lectures/youtube/preview',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubeUrlBodySchema }),
    controller.previewYoutubeVideo
  );
  router.post(
    '/:id/recorded-lectures/youtube/import',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubeUrlBodySchema }),
    controller.importYoutubeVideo
  );
  router.post(
    '/:id/recorded-lectures/youtube/playlist/preview',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubeUrlBodySchema }),
    controller.previewYoutubePlaylist
  );
  router.post(
    '/:id/recorded-lectures/youtube/playlist/import',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubePlaylistImportBodySchema }),
    controller.importYoutubePlaylist
  );
  router.post(
    '/:id/recorded-lectures/youtube/playlist/sync/preview',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubePlaylistSyncBodySchema }),
    controller.previewYoutubePlaylistSync
  );
  router.post(
    '/:id/recorded-lectures/youtube/playlist/sync',
    authorize,
    validateRequest({ params: uuidParamSchema, body: youtubePlaylistSyncBodySchema }),
    controller.applyYoutubePlaylistSync
  );
  router.patch(
    '/:id/recorded-lectures/reorder',
    authorize,
    validateRequest({ params: uuidParamSchema, body: reorderLecturesBodySchema }),
    controller.reorderForOpportunity
  );
  router.get(
    '/recorded-lectures/:lectureId',
    authorize,
    validateRequest({ params: lectureIdParamSchema }),
    controller.getById
  );
  router.get(
    '/recorded-lectures/:lectureId/students',
    authorize,
    validateRequest({ params: lectureIdParamSchema, query: progressRosterQuerySchema }),
    controller.listLectureStudentProgress
  );
  router.patch(
    '/recorded-lectures/:lectureId',
    authorize,
    validateRequest({ params: lectureIdParamSchema, body: updateRecordedLectureBodySchema }),
    controller.updateById
  );
  router.patch(
    '/recorded-lectures/:lectureId/status',
    authorize,
    validateRequest({ params: lectureIdParamSchema, body: changeLectureStatusBodySchema }),
    controller.changeStatus
  );
  router.post(
    '/recorded-lectures/:lectureId/publish',
    authorize,
    validateRequest({ params: lectureIdParamSchema }),
    controller.publishById
  );
  router.post(
    '/recorded-lectures/:lectureId/hide',
    authorize,
    validateRequest({ params: lectureIdParamSchema }),
    controller.hideById
  );
  router.get(
    '/:id/recorded-lectures',
    authorize,
    validateRequest({ params: uuidParamSchema }),
    controller.listForOpportunity
  );
  router.post(
    '/:id/recorded-lectures',
    authorize,
    validateRequest({ params: uuidParamSchema, body: createRecordedLectureBodySchema }),
    controller.createForOpportunity
  );
}

function mountReadRoutes(router, authorize, { opportunityParam = 'id' } = {}) {
  router.get(
    '/recorded-lectures/:lectureId',
    authorize,
    validateRequest({ params: lectureIdParamSchema }),
    controller.getById
  );
  router.get(
    '/recorded-lectures/:lectureId/students',
    authorize,
    validateRequest({ params: lectureIdParamSchema, query: progressRosterQuerySchema }),
    controller.listLectureStudentProgress
  );
  if (opportunityParam === 'opportunityId') {
    router.get(
      '/opportunities/:opportunityId/recorded-lectures',
      authorize,
      validateRequest({ params: opportunityIdParamSchema }),
      controller.listForAcademicOpportunity
    );
    return;
  }
  router.get(
    '/:id/recorded-lectures',
    authorize,
    validateRequest({ params: uuidParamSchema }),
    controller.listForOpportunity
  );
}

function mountStudentRoutes(router, authorize) {
  router.get(
    '/:id/recorded-lectures/:lectureId/progress',
    authorize,
    validateRequest({ params: opportunityLectureParamSchema }),
    controller.getStudentProgress
  );
  router.post(
    '/:id/recorded-lectures/:lectureId/watch-session',
    authorize,
    validateRequest({ params: opportunityLectureParamSchema, body: watchSessionBodySchema }),
    controller.startStudentWatchSession
  );
  router.post(
    '/:id/recorded-lectures/:lectureId/heartbeat',
    authorize,
    recordedLectureHeartbeatLimiter,
    validateRequest({ params: opportunityLectureParamSchema, body: heartbeatBodySchema }),
    controller.studentHeartbeat
  );
  router.post(
    '/:id/recorded-lectures/:lectureId/player-event',
    authorize,
    recordedLectureHeartbeatLimiter,
    validateRequest({ params: opportunityLectureParamSchema, body: playerEventBodySchema }),
    controller.studentPlayerEvent
  );
  router.get(
    '/:id/recorded-lectures/:lectureId',
    authorize,
    validateRequest({ params: opportunityLectureParamSchema }),
    controller.getForStudent
  );
  router.get(
    '/:id/recorded-lectures',
    authorize,
    validateRequest({ params: uuidParamSchema }),
    controller.listForStudent
  );
}

module.exports = {
  mountManageRoutes,
  mountReadRoutes,
  mountStudentRoutes,
};
