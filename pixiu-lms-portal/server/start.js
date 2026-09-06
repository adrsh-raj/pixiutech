// Production entrypoint: database must initialize before HTTP traffic starts.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters before the Pixiu LMS API can start.');
if (!process.env.CORS_ORIGINS || !process.env.CORS_ORIGINS.trim()) throw new Error('CORS_ORIGINS must be configured before the Pixiu LMS API can start.');
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) throw new Error('DATABASE_URL must be configured before the Pixiu LMS API can start.');
if (process.env.NODE_ENV !== 'production') console.warn('Pixiu LMS API is starting outside NODE_ENV=production.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function initializeDatabaseWithRetry() {
  let lastError;
  const delays = [2000, 4000, 8000, 12000];

  for (let attempt = 1; attempt <= delays.length + 1; attempt += 1) {
    try {
      const modulePath = require.resolve('./database');
      delete require.cache[modulePath];
      const db = require('./database');
      await db.ready;
      return;
    } catch (err) {
      lastError = err;
      if (attempt > delays.length) break;
      const delay = delays[attempt - 1];
      console.error(`Pixiu LMS database initialization attempt ${attempt} failed: ${err.message}. Retrying in ${delay / 1000}s.`);
      await sleep(delay);
    }
  }

  throw lastError;
}

(async () => {
  try {
    await initializeDatabaseWithRetry();
    require('./index.js');
  } catch (err) {
    console.error('Pixiu LMS API failed to initialize:', err);
    process.exit(1);
  }
})();
