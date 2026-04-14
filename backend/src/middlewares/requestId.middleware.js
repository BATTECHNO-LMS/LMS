const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const fromHeader = req.headers['x-request-id'];
  const id =
    typeof fromHeader === 'string' && fromHeader.trim().length > 0
      ? fromHeader.trim().slice(0, 128)
      : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestIdMiddleware };
