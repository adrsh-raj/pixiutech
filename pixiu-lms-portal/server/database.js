const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL must be configured for the production PostgreSQL database.');

const poolMax = Math.max(2, Math.min(20, Number(process.env.DB_POOL_MAX || 10)));
const statementTimeout = Math.max(1000, Number(process.env.DB_STATEMENT_TIMEOUT_MS || 10000));
const sslMode = /sslmode=(require|verify-ca|verify-full)/i.test(connectionString);
const pool = new Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: statementTimeout,
  application_name: 'pixiu-lms-api',
  ssl: sslMode ? { rejectUnauthorized: false } : false
});
pool.on('error', err => console.error('PostgreSQL pool error:', err.message));

function convertPlaceholders(sql) {
  let output = '';
  let index = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (quote) {
      output += ch;
      if (ch === quote) {
        if (next === quote) { output += next; i += 1; }
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; output += ch; continue; }
    if (ch === '?') { index += 1; output += `$${index}`; }
    else output += ch;
  }
  return output;
}

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function migrateLegacySqlite() {
  const sqlitePath = process.env.SQLITE_MIGRATION_PATH?.trim();
  if (!sqlitePath) {
    console.log('No legacy SQLite migration path configured; using PostgreSQL as the authoritative database.');
    return;
  }

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLITE_MIGRATION_PATH does not exist: ${sqlitePath}`);
  }

  const client = await pool.connect();
  let sqlite = null;
  try {
    const marker = await client.query("SELECT 1 FROM _pixiu_migrations WHERE id = 'sqlite-to-postgres-v1'");
    if (marker.rowCount) return;

    const Database = require('better-sqlite3');
    sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
    const tables = [
      'users', 'schools', 'classes', 'students', 'trainers', 'sessions', 'attendance', 'leads',
      'content', 'curriculum', 'inventory', 'billing', 'comms_logs', 'projects', 'alerts',
      'notifications', 'audit_logs', 'student_reviews', 'notification_reads', 'quizzes',
      'quiz_questions', 'quiz_submissions'
    ];

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [82736451]);
    for (const table of tables) {
      const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(col => col.name);
      if (!cols.length) continue;
      const quotedCols = cols.map(col => `"${String(col).replace(/"/g, '""')}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const data = sqlite.prepare(`SELECT ${quotedCols} FROM "${table}"`).all();
      for (const row of data) {
        const values = cols.map(col => row[col]);
        await client.query(`INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
      }
    }
    await client.query("INSERT INTO _pixiu_migrations (id) VALUES ('sqlite-to-postgres-v1') ON CONFLICT DO NOTHING");
    await client.query('COMMIT');
    console.log(`SQLite → PostgreSQL migration completed from ${sqlitePath}`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    try { if (sqlite) sqlite.close(); } catch {}
    client.release();
  }
}

async function initializeDatabase() {
  await pool.query('SELECT 1');
  await pool.query(schema);
  await migrateLegacySqlite();
  await pool.query('SELECT 1');
  console.log(`Connected to PostgreSQL database (pool max ${poolMax}).`);
}

const ready = initializeDatabase();

const db = {
  ready,
  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const values = Array.isArray(params) ? params : (params == null ? [] : [params]);
    const promise = ready.then(() => pool.query(convertPlaceholders(sql), values));
    if (callback) promise.then(result => callback.call({ lastID: result.rows?.[0]?.id ?? null, changes: result.rowCount }, null)).catch(err => callback.call({}, err));
    return promise;
  },
  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const values = Array.isArray(params) ? params : (params == null ? [] : [params]);
    const promise = ready.then(() => pool.query(convertPlaceholders(sql), values));
    if (callback) promise.then(result => callback(null, result.rows)).catch(err => callback(err, []));
    return promise;
  },
  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const values = Array.isArray(params) ? params : (params == null ? [] : [params]);
    const promise = ready.then(() => pool.query(convertPlaceholders(sql), values));
    if (callback) promise.then(result => callback(null, result.rows[0])).catch(err => callback(err, null));
    return promise;
  },
  serialize(fn) { return typeof fn === 'function' ? fn() : undefined; },
  prepare(sql) {
    const converted = convertPlaceholders(sql);
    return { run(...args) { return ready.then(() => pool.query(converted, args)); }, finalize() {} };
  }
};

module.exports = db;