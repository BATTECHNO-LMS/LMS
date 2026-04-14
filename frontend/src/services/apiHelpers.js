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
    const msg = typeof body.message === 'string' ? body.message : 'Request failed';
    const err = new Error(msg);
    err.code = 'API_ERROR';
    err.status = res.status;
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
    return fallback;
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
    return err.message || fallback;
  }
  return fallback;
}
