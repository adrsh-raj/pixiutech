const assert = require('node:assert/strict');
const { buildCorsOptions, normalizeOrigins } = require('../middleware/cors');

const OFFICIAL = 'https://portal.pixiutech.com,https://pixiutech.com,https://www.pixiutech.com';
const officialOrigins = normalizeOrigins(OFFICIAL);

assert.deepEqual(officialOrigins, [
  'https://portal.pixiutech.com',
  'https://pixiutech.com',
  'https://www.pixiutech.com'
]);

for (const unsafe of [
  '*',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:5000',
  'https://evil.example/path',
  'https://evil.example?x=1'
]) {
  assert.throws(() => normalizeOrigins(unsafe));
}

const options = buildCorsOptions({ CORS_ORIGINS: OFFICIAL });
assert.equal(options.credentials, false);
assert.equal(options.optionsSuccessStatus, 204);
assert.ok(options.methods.includes('OPTIONS'));
assert.ok(options.allowedHeaders.includes('Authorization'));

options.origin('https://portal.pixiutech.com', (error, allowed) => {
  assert.equal(error, null);
  assert.equal(allowed, true);
});

options.origin('https://evil.example', (error, allowed) => {
  assert.equal(error, null);
  assert.equal(allowed, false);
});

console.log('CORS policy assertions passed.');
