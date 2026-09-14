const analyticsService = require('./analytics.service');
const commandCenter = require('./commandCenter.service');
const { isSystemWideAdmin, resolveUniversityIdFilter } = require('../../utils/universityScope');
const analyticsPdfService = require('./analyticsPdf.service');
const analyticsExcelExportService = require('./analyticsExcelExport.service');
const { success } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');

async function overview(req, res, next) {
  try {
    const data = await analyticsService.getOverviewAnalytics(req.validated.query);
    return success(res, data, { message: 'Analytics overview retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function universities(req, res, next) {
  try {
    const data = await analyticsService.getUniversitiesAnalytics(req.validated.query);
    return success(res, data, { message: 'Universities analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function enrollments(req, res, next) {
  try {
    const data = await analyticsService.getEnrollmentsAnalytics(req.validated.query);
    return success(res, data, { message: 'Enrollments analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function cohorts(req, res, next) {
  try {
    const data = await analyticsService.getCohortsAnalytics(req.validated.query);
    return success(res, data, { message: 'Cohorts analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function assessments(req, res, next) {
  try {
    const data = await analyticsService.getAssessmentsAnalytics(req.validated.query);
    return success(res, data, { message: 'Assessments analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function attendance(req, res, next) {
  try {
    const data = await analyticsService.getAttendanceAnalytics(req.validated.query);
    return success(res, data, { message: 'Attendance analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function evidence(req, res, next) {
  try {
    const data = await analyticsService.getEvidenceAnalytics(req.validated.query);
    return success(res, data, { message: 'Evidence analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function qaIntegrity(req, res, next) {
  try {
    const data = await analyticsService.getQaIntegrityAnalytics(req.validated.query);
    return success(res, data, { message: 'QA & integrity analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function recognition(req, res, next) {
  try {
    const data = await analyticsService.getRecognitionAnalytics(req.validated.query);
    return success(res, data, { message: 'Recognition analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function certificates(req, res, next) {
  try {
    const data = await analyticsService.getCertificatesAnalytics(req.validated.query);
    return success(res, data, { message: 'Certificates analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function fieldTraining(req, res, next) {
  try {
    let query = req.validated.query;
    if (!isSystemWideAdmin(req.user)) {
      const scoped = resolveUniversityIdFilter(req.user, query.university_id);
      if (scoped) query = { ...query, university_id: scoped };
      else if (req.user?.universityId) query = { ...query, university_id: req.user.universityId };
    }
    const data = await analyticsService.getFieldTrainingAnalytics(query);
    return success(res, data, { message: 'Field training analytics retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function exportPdf(req, res, next) {
  try {
    const { buffer, filename } = await analyticsPdfService.generateAnalyticsPdf(
      req.validated.query,
      { userId: req.user?.userId },
      req.validated.query.lang || 'ar'
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (e) {
    if (e?.message?.includes('Could not find Chrome') || e?.message?.includes('Failed to launch')) {
      return next(new ApiError(503, 'PDF export is temporarily unavailable on this server.'));
    }
    return next(e);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { buffer, filename } = await analyticsExcelExportService.generateAnalyticsExcel(
      req.validated.query,
      { userId: req.user?.userId }
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (e) {
    return next(e);
  }
}

async function commandCenterOverview(req, res, next) {
  try {
    const data = await commandCenter.getCommandCenterOverview(req.user, req.validated.query);
    return success(res, data, { message: 'Analytics command center retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function commandCenterLiveSnapshot(req, res, next) {
  try {
    const data = await commandCenter.getLiveSnapshot(req.user, req.validated.query);
    return success(res, data, { message: 'Analytics live snapshot retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function commandCenterFilters(req, res, next) {
  try {
    const data = await commandCenter.getFilterOptions(req.user, req.validated.query);
    return success(res, data, { message: 'Analytics filters retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function commandCenterDrilldown(req, res, next) {
  try {
    const data = await commandCenter.getDrilldown(req.user, req.validated.query);
    return success(res, data, { message: 'Analytics drilldown retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function commandCenterLiveStream(req, res, next) {
  try {
    await commandCenter.getLiveSnapshot(req.user, req.validated.query);
  } catch (e) {
    return next(e);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let closed = false;
  const send = async () => {
    if (closed) return;
    try {
      const data = await commandCenter.getLiveSnapshot(req.user, req.validated.query);
      res.write(`event: snapshot\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        res.write(`event: auth\ndata: ${JSON.stringify({ code: err.code || 'FORBIDDEN' })}\n\n`);
        closed = true;
        res.end();
        return;
      }
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'live_update_failed' })}\n\n`);
    }
  };

  await send();
  const interval = setInterval(send, 8000);
  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}

module.exports = {
  overview,
  universities,
  enrollments,
  cohorts,
  assessments,
  attendance,
  evidence,
  qaIntegrity,
  recognition,
  certificates,
  fieldTraining,
  exportPdf,
  exportExcel,
  commandCenterOverview,
  commandCenterLiveSnapshot,
  commandCenterFilters,
  commandCenterDrilldown,
  commandCenterLiveStream,
};
