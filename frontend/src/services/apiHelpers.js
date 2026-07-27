/**
 * Unwrap BATTECHNO-LMS API envelope: `{ success, message?, data }`.
 * @param {import('axios').AxiosResponse} res
 * @returns {unknown}
 */
export function unwrapApiData(res) {
  const body = res?.data;
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid API response');
  }
  if (body.success === false) {
    const msg = typeof body.message === 'string' ? body.message : 'تعذر إكمال العملية.';
    const err = new Error(msg);
    err.code = body.code || 'API_ERROR';
    err.status = res.status;
    err.details = body.details ?? null;
    err.requestId = body.requestId ?? null;
    throw err;
  }
  return body.data;
}

/**
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function getApiErrorMessage(err, fallback = 'Request failed') {
  if (!err?.response) {
    return 'تعذر الاتصال بالمنصة. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.';
  }
  const body = err?.response?.data;
  if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
    const fields = body.details?.fields;
    if (fields && typeof fields === 'object') {
      const firstKey = Object.keys(fields).find((k) => Array.isArray(fields[k]) && fields[k].length);
      if (firstKey) {
        const msg = fields[firstKey][0];
        if (typeof msg === 'string' && msg) return msg;
      }
    }
    return body.message;
  }
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const msg = err.message || '';
    if (/axioserror|network error|econnrefused|internal server|forbidden|unauthorized|p20\d{2}/i.test(msg)) {
      return 'تعذر إكمال العملية. حاول مرة أخرى بعد قليل.';
    }
    return msg || fallback;
  }
  return fallback;
}
