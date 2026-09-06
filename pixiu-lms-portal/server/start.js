// Production entrypoint. The API must never boot with a bundled/default JWT secret.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters before the Pixiu LMS API can start.');
}

if (process.env.NODE_ENV !== 'production') {
  console.warn('Pixiu LMS API is starting outside NODE_ENV=production. Use a production deployment environment for the live service.');
}

require('./index.js');
