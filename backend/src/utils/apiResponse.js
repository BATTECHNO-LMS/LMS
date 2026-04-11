/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{ message?: string, status?: number } | number} [options]
 */
function success(res, data, options = {}) {
  const opts = typeof options === 'number' ? { status: options } : options;
  const status = opts.status ?? 200;
  const body = { success: true };
  if (opts.message) body.message = opts.message;
  body.data = data;
  return res.status(status).json(body);
}

/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{ message?: string }} [options]
 */
function created(res, data, options = {}) {
  return success(res, data, { status: 201, message: options.message });
}

function okMessage(res, message, status = 200) {
  return res.status(status).json({ success: true, message });
}

module.exports = { success, created, okMessage };
