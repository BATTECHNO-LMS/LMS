'use strict';

const crypto = require('crypto');
const { ApiError } = require('../utils/apiError');
const { env } = require('../config/env');
const { log } = require('../utils/logger');
const { AUTH_ERROR_CODES, messageForCode } = require('../utils/authErrorCatalog');

const TECHNICAL_MESSAGE_RE =
  /prisma|econnrefused|ecanceled|etimedout|stack|sqlstate|p20\d{2}|axioserror|validationerror|internal server|unauthorized|forbidden|enoent|aggregateerror/i;

function formatRequestId(req) {
  const raw = req?.id || crypto.randomUUID();
  const compact = String(raw).replace(/-/g, '').slice(0, 12).toUpperCase();
  return `REQ-${compact}`;
}

function mapPrismaError(err) {
  const code = err?.code;
  if (code === 'P2002') {
    const targets = Array.isArray(err?.meta?.target) ? err.meta.target.map(String) : [];
    if (targets.some((t) => t.toLowerCase().includes('email'))) {
      return new ApiError(
        409,
        messageForCode(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS),
        null,
        AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS
      );
    }
    if (targets.some((t) => t.toLowerCase().includes('phone'))) {
      return new ApiError(
        409,
        messageForCode(AUTH_ERROR_CODES.PHONE_ALREADY_EXISTS),
        null,
        AUTH_ERROR_CODES.PHONE_ALREADY_EXISTS
      );
    }
    return new ApiError(
      409,
      'تعذر حفظ البيانات بسبب تكرار قيمة موجودة مسبقًا.',
      null,
      AUTH_ERROR_CODES.VALIDATION_ERROR
    );
  }
  if (code === 'P2025') {
    return new ApiError(
      404,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND),
      null,
      AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND
    );
  }
  if (typeof code === 'string' && code.startsWith('P')) {
    return new ApiError(
      500,
      messageForCode(AUTH_ERROR_CODES.SERVER_ERROR),
      null,
      AUTH_ERROR_CODES.SERVER_ERROR
    );
  }
  return null;
}

function sanitizeUserMessage(message, code) {
  const msg = String(message || '').trim();
  if (!msg || TECHNICAL_MESSAGE_RE.test(msg)) {
    return messageForCode(code || AUTH_ERROR_CODES.SERVER_ERROR);
  }
  return msg;
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  const requestId = formatRequestId(req);
  req.supportRequestId = requestId;

  let apiErr = err instanceof ApiError ? err : null;
  if (!apiErr) {
    apiErr = mapPrismaError(err);
  }

  if (apiErr) {
    const code = apiErr.code || AUTH_ERROR_CODES.SERVER_ERROR;
    const safeMessage = sanitizeUserMessage(apiErr.message, code);
    if (apiErr.statusCode >= 500) {
      log('error', apiErr.message || 'ApiError 5xx', {
        requestId,
        code,
        name: err?.name,
        ...(env.NODE_ENV === 'production' ? {} : { stack: err?.stack }),
      });
    }
    return res.status(apiErr.statusCode).json({
      success: false,
      code,
      message: safeMessage,
      details: apiErr.details ?? null,
      requestId,
    });
  }

  log('error', err?.message || 'Unhandled error', {
    requestId,
    name: err?.name,
    prismaCode: err?.code || null,
    ...(env.NODE_ENV === 'production' ? {} : { stack: err?.stack }),
  });

  return res.status(500).json({
    success: false,
    code: AUTH_ERROR_CODES.SERVER_ERROR,
    message: messageForCode(AUTH_ERROR_CODES.SERVER_ERROR),
    details: null,
    requestId,
  });
}

module.exports = { errorMiddleware, mapPrismaError, formatRequestId };
