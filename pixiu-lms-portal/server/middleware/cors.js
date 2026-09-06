const DEFAULT_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Authorization', 'Content-Type'];

function normalizeOrigins(rawOrigins) {
  const values = String(rawOrigins || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one allowed production origin.');
  }

  const origins = [...new Set(values)];
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error(`CORS origin must be an HTTPS origin without a path: ${origin}`);
    }

    if (origin === '*') {
      throw new Error('Wildcard CORS origin (*) is not permitted.');
    }

    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(parsed.hostname)) {
      throw new Error(`Localhost CORS origin is not permitted in production: ${origin}`);
    }
  }

  return origins;
}

function buildCorsOptions(env = process.env) {
  const origins = normalizeOrigins(env.CORS_ORIGINS);
  const allowedOrigins = new Set(origins);

  return {
    origin(origin, callback) {
      // Non-browser clients do not send an Origin header and do not need CORS headers.
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins.has(origin));
    },
    credentials: false,
    methods: DEFAULT_METHODS,
    allowedHeaders: DEFAULT_HEADERS,
    optionsSuccessStatus: 204,
    maxAge: 600
  };
}

module.exports = { buildCorsOptions, normalizeOrigins };
