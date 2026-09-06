from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / 'pixiu-lms-portal' / 'server'
DB = SERVER / 'database.js'

# Extract the live SQLite CREATE TABLE definitions before replacing the adapter.
source = DB.read_text()
blocks = re.findall(r"db\\.run\\(`(CREATE TABLE IF NOT EXISTS[\\s\\S]*?)`\\);", source)
if len(blocks) < 15:
    raise SystemExit(f'Expected at least 15 table definitions; found {len(blocks)}')

schema_parts = []
for block in blocks:
    sql = block.replace('DATETIME', 'TIMESTAMPTZ')
    sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'BIGSERIAL PRIMARY KEY')
    schema_parts.append(sql.strip() + ';')

indexes = '''
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users (school_id, role);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students (school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_school_date ON sessions (school_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_class_date ON sessions (class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_content_grade_level ON content (class_grade, level);
CREATE INDEX IF NOT EXISTS idx_inventory_school_status ON inventory (school_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_student ON inventory (assigned_student_id);
CREATE INDEX IF NOT EXISTS idx_billing_school_status ON billing (school_id, status);
CREATE INDEX IF NOT EXISTS idx_comms_student_sent ON comms_logs (student_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_projects_student ON projects (student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read_created ON alerts (is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_school_status ON notifications (target_school_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_schedule ON notifications (scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_school_created ON audit_logs (school_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_student_created ON student_reviews (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads (user_key, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz_questions (quiz_id, question_order);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student ON quiz_submissions (student_id, completed_at);
'''
(SERVER / 'schema.sql').write_text('\n\n'.join(schema_parts) + '\n\n' + indexes.strip() + '\n')

DATABASE_JS = r'''const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL must be configured for the production PostgreSQL database.');
}

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

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function migrateLegacySqlite() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _pixiu_migrations (
      id TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [82736451]);
    if (!lockResult.rows[0]?.locked) return;

    try {
      const marker = await client.query('SELECT 1 FROM _pixiu_migrations WHERE id = $1', ['sqlite-to-postgres-v1']);
      if (marker.rowCount > 0) return;

      const candidates = [
        process.env.SQLITE_MIGRATION_PATH,
        path.join('/opt/render/project/src/data', 'pixiu_lms.db'),
        path.join(__dirname, 'pixiu_lms.db')
      ].filter(Boolean);
      const sqlitePath = candidates.find(candidate => fs.existsSync(candidate));
      if (!sqlitePath) {
        console.warn('No legacy SQLite file found; PostgreSQL starts with its existing data.');
        return;
      }

      const Database = require('better-sqlite3');
      const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
      const preferredOrder = [
        'users', 'schools', 'classes', 'students', 'trainers', 'sessions', 'attendance', 'leads',
        'content', 'curriculum', 'inventory', 'billing', 'comms_logs', 'projects', 'alerts',
        'notifications', 'audit_logs', 'student_reviews', 'notification_reads', 'quizzes',
        'quiz_questions', 'quiz_submissions'
      ];
      const tableNames = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
      const unknown = tableNames.filter(name => !preferredOrder.includes(name));
      if (unknown.length) throw new Error(`Unexpected SQLite tables require migration mapping: ${unknown.join(', ')}`);

      await client.query('BEGIN');
      for (const tableName of preferredOrder.filter(name => tableNames.includes(name))) {
        const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all().map(col => col.name);
        const rows = sqlite.prepare(`SELECT ${columns.map(quoteIdent).join(', ')} FROM ${quoteIdent(tableName)}`).all();
        if (!rows.length) continue;
        const columnSql = columns.map(quoteIdent).join(', ');
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const insertSql = `INSERT INTO ${quoteIdent(tableName)} (${columnSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        for (const row of rows) await client.query(insertSql, columns.map(column => row[column]));
      }
      await client.query("INSERT INTO _pixiu_migrations (id) VALUES ('sqlite-to-postgres-v1')");
      await client.query('COMMIT');
      sqlite.close();
      console.log(`SQLite → PostgreSQL migration completed from ${sqlitePath}`);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [82736451]).catch(() => {});
    }
  } finally {
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
'''
DB.write_text(DATABASE_JS)

pkg = SERVER / 'package.json'
data = json.loads(pkg.read_text())
data['scripts']['start'] = 'node start.js'
data['dependencies']['better-sqlite3'] = '^11.0.0'
data['dependencies']['compression'] = '^1.8.1'
data['dependencies']['pg'] = '^8.16.3'
pkg.write_text(json.dumps(data, indent=2) + '\n')

(SERVER / 'start.js').write_text("""// Production entrypoint. Database initialization and legacy migration must finish before HTTP traffic is accepted.\nif (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters before the Pixiu LMS API can start.');\nif (!process.env.CORS_ORIGINS || !process.env.CORS_ORIGINS.trim()) throw new Error('CORS_ORIGINS must be configured before the Pixiu LMS API can start.');\nif (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) throw new Error('DATABASE_URL must be configured before the Pixiu LMS API can start.');\nif (process.env.NODE_ENV !== 'production') console.warn('Pixiu LMS API is starting outside NODE_ENV=production.');\n(async () => { try { const db = require('./database'); await db.ready; require('./index.js'); } catch (err) { console.error('Pixiu LMS API failed to initialize:', err); process.exit(1); } })();\n""")

index = SERVER / 'index.js'
it = index.read_text()
if "const compression = require('compression');" not in it:
    it = it.replace("const cors = require('cors');\n", "const cors = require('cors');\nconst compression = require('compression');\n", 1)
if "app.use(compression());" not in it:
    it = it.replace("app.use(express.json({ limit: '2mb' }));", "app.use(compression());\napp.use(express.json({ limit: '2mb' }));", 1)
index.write_text(it)

(SERVER / '.env.example').write_text("""DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME\n# Use sslmode=require for connections outside Render's private network.\nDB_POOL_MAX=10\nDB_STATEMENT_TIMEOUT_MS=10000\nJWT_SECRET=replace-with-a-random-secret-at-least-32-characters\nCORS_ORIGINS=https://portal.pixiutech.com,https://pixiutech.com,https://www.pixiutech.com\n""")

(SERVER.parent / 'render.yaml').write_text("""databases:\n  - name: pixiu-lms-db\n    plan: free\n    region: singapore\n    databaseName: pixiu_lms\n    postgresMajorVersion: \"17\"\n    connectionPool: none\n\nservices:\n  - type: web\n    name: pixiu-lms-api\n    runtime: node\n    region: singapore\n    plan: free\n    rootDir: pixiu-lms-portal/server\n    buildCommand: npm install\n    startCommand: node start.js\n    envVars:\n      - key: NODE_ENV\n        value: production\n      - key: PORT\n        value: 10000\n      - key: NODE_VERSION\n        value: 20.18.0\n      - key: JWT_SECRET\n        generateValue: true\n      - key: CORS_ORIGINS\n        value: https://portal.pixiutech.com,https://pixiutech.com,https://www.pixiutech.com\n      - key: DATABASE_URL\n        fromDatabase:\n          name: pixiu-lms-db\n          property: connectionString\n      - key: DB_POOL_MAX\n        value: 10\n      - key: DB_STATEMENT_TIMEOUT_MS\n        value: 10000\n""")

print(f'Prepared PostgreSQL schema from {len(blocks)} SQLite tables.')
