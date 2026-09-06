// Production entrypoint: database must initialize before HTTP traffic starts.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters before the Pixiu LMS API can start.');
if (!process.env.CORS_ORIGINS || !process.env.CORS_ORIGINS.trim()) throw new Error('CORS_ORIGINS must be configured before the Pixiu LMS API can start.');
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) throw new Error('DATABASE_URL must be configured before the Pixiu LMS API can start.');
if (process.env.NODE_ENV !== 'production') console.warn('Pixiu LMS API is starting outside NODE_ENV=production.');
(async () => {
  try {
    const db = require('./database');
    await db.ready;
    require('./index.js');
  } catch (err) {
    console.error('Pixiu LMS API failed to initialize:', err);
    process.exit(1);
  }
})();
