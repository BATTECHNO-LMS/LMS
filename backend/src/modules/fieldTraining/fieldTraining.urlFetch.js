const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const MAX_URL_RESPONSE_BYTES = 1.5 * 1024 * 1024;
const MAX_URL_EXTRACT_CHARS = 30000;
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
]);

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe80')) return true; // link-local
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice(7);
      return isPrivateIp(v4);
    }
  }
  return false;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = MAX_URL_EXTRACT_CHARS) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[… تم اقتصاص محتوى الرابط …]`;
}

/**
 * @param {string} rawUrl
 * @returns {Promise<URL>}
 */
async function assertSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    const err = new Error('تعذر الوصول إلى الرابط.');
    err.code = 'URL_INVALID';
    throw err;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('الرابط يجب أن يكون عامًا ومتاحًا.');
    err.code = 'URL_PROTOCOL';
    throw err;
  }

  if (parsed.username || parsed.password) {
    const err = new Error('الرابط يجب أن يكون عامًا ومتاحًا.');
    err.code = 'URL_CREDENTIALS';
    throw err;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    const err = new Error('تعذر الوصول إلى الرابط.');
    err.code = 'URL_BLOCKED_HOST';
    throw err;
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      const err = new Error('تعذر الوصول إلى الرابط.');
      err.code = 'URL_PRIVATE_IP';
      throw err;
    }
    return parsed;
  }

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    const err = new Error('تعذر الوصول إلى الرابط.');
    err.code = 'URL_DNS';
    throw err;
  }

  if (!addresses?.length || addresses.some((a) => isPrivateIp(a.address))) {
    const err = new Error('تعذر الوصول إلى الرابط.');
    err.code = 'URL_PRIVATE_IP';
    throw err;
  }

  return parsed;
}

async function fetchOnce(url, redirectCount = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BATTECHNO-LMS-ContentFetcher/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5',
      },
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        const err = new Error('تعذر الوصول إلى الرابط.');
        err.code = 'URL_REDIRECT_LIMIT';
        throw err;
      }
      const location = res.headers.get('location');
      if (!location) {
        const err = new Error('تعذر الوصول إلى الرابط.');
        err.code = 'URL_REDIRECT';
        throw err;
      }
      const next = new URL(location, url).toString();
      await assertSafePublicUrl(next);
      return fetchOnce(next, redirectCount + 1);
    }

    if (res.status === 401 || res.status === 403) {
      const err = new Error(
        'تعذر قراءة محتوى الرابط. تأكد أن الرابط عام ومتاح بدون تسجيل دخول.'
      );
      err.code = 'URL_AUTH_REQUIRED';
      throw err;
    }

    if (!res.ok) {
      const err = new Error('تعذر الوصول إلى الرابط.');
      err.code = 'URL_HTTP_ERROR';
      throw err;
    }

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_URL_RESPONSE_BYTES) {
      const err = new Error('تعذر قراءة محتوى الرابط. تأكد أن الرابط عام ومتاح بدون تسجيل دخول.');
      err.code = 'URL_TOO_LARGE';
      throw err;
    }

    const reader = res.body?.getReader?.();
    if (!reader) {
      const text = await res.text();
      return { contentType, body: text.slice(0, MAX_URL_RESPONSE_BYTES) };
    }

    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      total += buf.length;
      if (total > MAX_URL_RESPONSE_BYTES) {
        try {
          reader.cancel();
        } catch {
          /* ignore */
        }
        const err = new Error('تعذر قراءة محتوى الرابط. تأكد أن الرابط عام ومتاح بدون تسجيل دخول.');
        err.code = 'URL_TOO_LARGE';
        throw err;
      }
      chunks.push(buf);
    }
    return { contentType, body: Buffer.concat(chunks).toString('utf8') };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} projectUrl
 * @returns {Promise<{ status: string, text: string | null, error: string | null, finalUrl?: string }>}
 */
async function fetchAndExtractPublicUrl(projectUrl) {
  try {
    const safe = await assertSafePublicUrl(projectUrl);
    const { contentType, body } = await fetchOnce(safe.toString());

    let text = '';
    if (contentType.includes('application/json')) {
      text = truncate(body);
    } else if (contentType.includes('text/plain')) {
      text = truncate(body);
    } else {
      text = truncate(stripHtml(body));
    }

    if (!text || text.length < 20) {
      return {
        status: 'empty',
        text: null,
        error: 'تعذر قراءة محتوى الرابط. تأكد أن الرابط عام ومتاح بدون تسجيل دخول.',
        finalUrl: safe.toString(),
      };
    }

    return { status: 'ok', text, error: null, finalUrl: safe.toString() };
  } catch (err) {
    const message =
      err?.message ||
      'تعذر قراءة محتوى الرابط. تأكد أن الرابط عام ومتاح بدون تسجيل دخول.';
    return {
      status: 'failed',
      text: null,
      error: message,
    };
  }
}

function isValidHttpUrlShape(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  assertSafePublicUrl,
  fetchAndExtractPublicUrl,
  isValidHttpUrlShape,
  MAX_URL_RESPONSE_BYTES,
  MAX_REDIRECTS,
};
