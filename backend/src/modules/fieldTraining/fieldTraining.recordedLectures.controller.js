'use strict';

const recordedLecturesService = require('./fieldTraining.recordedLectures.service');
const youtubeImportService = require('./fieldTraining.recordedLectures.youtubeImport.service');
const watchService = require('./fieldTraining.recordedLectures.watch.service');
const { success, created } = require('../../utils/apiResponse');

async function listForOpportunity(req, res, next) {
  try {
    const data = await recordedLecturesService.listForStaff(req.validated.params.id, req.user);
    return success(res, data, { message: 'Recorded lectures retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function listForAcademicOpportunity(req, res, next) {
  try {
    const data = await recordedLecturesService.listForStaff(
      req.validated.params.opportunityId,
      req.user
    );
    return success(res, data, { message: 'Recorded lectures retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function createForOpportunity(req, res, next) {
  try {
    const data = await recordedLecturesService.createForOpportunity(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'Recorded lecture created' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await recordedLecturesService.getForStaff(req.validated.params.lectureId, req.user);
    return success(res, data, { message: 'Recorded lecture retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function updateById(req, res, next) {
  try {
    const data = await recordedLecturesService.updateLecture(
      req.validated.params.lectureId,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'Recorded lecture updated' });
  } catch (e) {
    return next(e);
  }
}

async function publishById(req, res, next) {
  try {
    const data = await recordedLecturesService.setStatus(
      req.validated.params.lectureId,
      'published',
      req.user
    );
    return success(res, data, { message: 'Recorded lecture published' });
  } catch (e) {
    return next(e);
  }
}

async function hideById(req, res, next) {
  try {
    const data = await recordedLecturesService.setStatus(
      req.validated.params.lectureId,
      'hidden',
      req.user
    );
    return success(res, data, { message: 'Recorded lecture hidden' });
  } catch (e) {
    return next(e);
  }
}

async function changeStatus(req, res, next) {
  try {
    const data = await recordedLecturesService.setStatus(
      req.validated.params.lectureId,
      req.validated.body.status,
      req.user
    );
    return success(res, data, { message: 'Recorded lecture status updated' });
  } catch (e) {
    return next(e);
  }
}

async function listForStudent(req, res, next) {
  try {
    const data = await recordedLecturesService.listForStudent(
      req.validated.params.id,
      req.user.userId
    );
    return success(res, data, { message: 'Recorded lectures retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getForStudent(req, res, next) {
  try {
    const data = await recordedLecturesService.getForStudent(
      req.validated.params.id,
      req.validated.params.lectureId,
      req.user.userId
    );
    return success(res, data, { message: 'Recorded lecture retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getStudentProgress(req, res, next) {
  try {
    const data = await watchService.getProgress(
      req.validated.params.id,
      req.validated.params.lectureId,
      req.user.userId
    );
    return success(res, data, { message: 'Watch progress retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function startStudentWatchSession(req, res, next) {
  try {
    const data = await watchService.startWatchSession(
      req.validated.params.id,
      req.validated.params.lectureId,
      req.user.userId,
      req.validated.body || {}
    );
    return success(res, data, { message: 'Watch session started' });
  } catch (e) {
    return next(e);
  }
}

async function studentHeartbeat(req, res, next) {
  try {
    const data = await watchService.processHeartbeat(
      req.validated.params.id,
      req.validated.params.lectureId,
      req.user.userId,
      req.validated.body
    );
    return success(res, data, { message: 'Watch heartbeat recorded' });
  } catch (e) {
    return next(e);
  }
}

async function studentPlayerEvent(req, res, next) {
  try {
    const data = await watchService.processPlayerEvent(
      req.validated.params.id,
      req.validated.params.lectureId,
      req.user.userId,
      req.validated.body
    );
    return success(res, data, { message: 'Player event recorded' });
  } catch (e) {
    return next(e);
  }
}

async function previewYoutubeVideo(req, res, next) {
  try {
    const data = await youtubeImportService.previewSingle(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'YouTube video preview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function importYoutubeVideo(req, res, next) {
  try {
    const data = await youtubeImportService.importSingle(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'تم استيراد المحاضرة بنجاح' });
  } catch (e) {
    return next(e);
  }
}

async function previewYoutubePlaylist(req, res, next) {
  try {
    const data = await youtubeImportService.previewPlaylist(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'YouTube playlist preview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function importYoutubePlaylist(req, res, next) {
  try {
    const data = await youtubeImportService.importPlaylist(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return created(res, data, { message: 'تم الاستيراد بنجاح' });
  } catch (e) {
    return next(e);
  }
}

async function previewYoutubePlaylistSync(req, res, next) {
  try {
    const data = await youtubeImportService.previewPlaylistSync(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'YouTube playlist sync preview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function applyYoutubePlaylistSync(req, res, next) {
  try {
    const data = await youtubeImportService.applyPlaylistSync(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'تم الاستيراد بنجاح' });
  } catch (e) {
    return next(e);
  }
}

async function reorderForOpportunity(req, res, next) {
  try {
    const data = await recordedLecturesService.reorderLectures(
      req.validated.params.id,
      req.validated.body,
      req.user
    );
    return success(res, data, { message: 'تم حفظ ترتيب المحاضرات' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  listForOpportunity,
  listForAcademicOpportunity,
  createForOpportunity,
  getById,
  updateById,
  publishById,
  hideById,
  changeStatus,
  listForStudent,
  getForStudent,
  getStudentProgress,
  startStudentWatchSession,
  studentHeartbeat,
  studentPlayerEvent,
  previewYoutubeVideo,
  importYoutubeVideo,
  previewYoutubePlaylist,
  importYoutubePlaylist,
  previewYoutubePlaylistSync,
  applyYoutubePlaylistSync,
  reorderForOpportunity,
};
