'use strict';

const { pipeline } = require('stream');
const { success, created } = require('../../utils/apiResponse');
const { ApiError } = require('../../utils/apiError');
const svc = require('./taskSubmissionFiles.service');
const { downloadContentType, attachmentDisposition } = require('./taskSubmissionFileRules');

const R = (req) => req.user;

async function uploadDraft(req, res, next) {
  try {
    return created(res, await svc.uploadDraftFile(R(req), req.validated.params.taskId, req.file));
  } catch (e) {
    return next(e);
  }
}

async function listDrafts(req, res, next) {
  try {
    return success(res, await svc.listDraftFiles(R(req), req.validated.params.taskId));
  } catch (e) {
    return next(e);
  }
}

async function deleteDraft(req, res, next) {
  try {
    const { taskId, fileId } = req.validated.params;
    return success(res, await svc.deleteDraftFile(R(req), taskId, fileId));
  } catch (e) {
    return next(e);
  }
}

function streamAttachment(res, next, opened) {
  res.setHeader('Content-Type', downloadContentType(opened.mimeType));
  res.setHeader('Content-Disposition', attachmentDisposition(opened.fileName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  if (opened.contentLength) res.setHeader('Content-Length', String(opened.contentLength));
  pipeline(opened.stream, res, (err) => {
    if (!err) return;
    if (!res.headersSent) {
      next(new ApiError(500, 'تعذّر تنزيل الملف. حاول مرة أخرى.', null, 'DOWNLOAD_FAILED'));
    } else {
      res.destroy(err);
    }
  });
}

async function downloadAttachment(req, res, next) {
  try {
    const { submissionId, fileId } = req.validated.params;
    const opened = await svc.openSubmissionAttachment(R(req), submissionId, fileId);
    return streamAttachment(res, next, opened);
  } catch (e) {
    return next(e);
  }
}

async function downloadLegacyFile(req, res, next) {
  try {
    const result = await svc.openLegacySubmissionFile(R(req), req.validated.params.submissionId);
    if (result.mode === 'external') return success(res, { externalUrl: result.url });
    return streamAttachment(res, next, result);
  } catch (e) {
    return next(e);
  }
}

module.exports = { uploadDraft, listDrafts, deleteDraft, downloadAttachment, downloadLegacyFile };
