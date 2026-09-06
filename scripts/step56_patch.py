from pathlib import Path
import json
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / 'pixiu-lms-portal' / 'server'
SQLITE = SERVER / 'pixiu_lms.db'

if not SQLITE.exists():
    raise SystemExit('Committed SQLite migration source is missing.')

conn = sqlite3.connect(SQLITE)
rows = conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
conn.close()
sql_by_table = {name: sql for name, sql in rows if sql}

preferred = [
    'users', 'schools', 'classes', 'students', 'trainers', 'sessions', 'attendance', 'leads',
    'content', 'curriculum', 'inventory', 'billing', 'comms_logs', 'projects', 'alerts',
    'notifications', 'audit_logs', 'student_reviews', 'notification_reads', 'quizzes',
    'quiz_questions', 'quiz_submissions'
]
missing = [name for name in preferred if name not in sql_by_table]
if missing:
    raise SystemExit(f'Missing expected SQLite tables: {missing}')
unknown = [name for name in sql_by_table if name not in preferred]
if unknown:
    raise SystemExit(f'Unexpected SQLite tables require explicit migration mapping: {unknown}')

schema_parts = []
for name in preferred:
    sql = sql_by_table[name]
    sql = sql.replace('DATETIME', 'TIMESTAMPTZ')
    sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'BIGSERIAL PRIMARY KEY')
    schema_parts.append(sql.strip() + ';')

schema_parts.append('''
CREATE TABLE IF NOT EXISTS _pixiu_migrations (
  id TEXT PRIMARY KEY,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
'''.strip())

indexes = [
    ('idx_users_school_role', 'users', 'school_id, role'),
    ('idx_classes_school', 'classes', 'school_id'),
    ('idx_students_school_class', 'students', 'school_id, class_id'),
    ('idx_sessions_school_date', 'sessions', 'school_id, date'),
    ('idx_sessions_class_date', 'sessions', 'class_id, date'),
    ('idx_attendance_student', 'attendance', 'student_id'),
    ('idx_attendance_session', 'attendance', 'session_id'),
    ('idx_leads_stage', 'leads', 'stage'),
    ('idx_content_grade_level', 'content', 'class_grade, level'),
    ('idx_inventory_school_status', 'inventory', 'school_id, status'),
    ('idx_inventory_student', 'inventory', 'assigned_student_id'),
    ('idx_billing_school_status', 'billing', 'school_id, status'),
    ('idx_comms_student_sent', 'comms_logs', 'student_id, sent_at'),
    ('idx_projects_student', 'projects', 'student_id'),
    ('idx_alerts_read_created', 'alerts', 'is_read, created_at'),
    ('idx_notifications_school_status', 'notifications', 'target_school_id, status'),
    ('idx_notifications_schedule', 'notifications', 'scheduled_date, scheduled_time'),
    ('idx_audit_user_created', 'audit_logs', 'user_id, created_at'),
    ('idx_audit_school_created', 'audit_logs', 'school_id, created_at'),
    ('idx_reviews_student_created', 'student_reviews', 'student_id, created_at'),
    ('idx_notification_reads_user', 'notification_reads', 'user_key, created_at'),
    ('idx_quiz_questions_quiz_order', 'quiz_questions', 'quiz_id, question_order'),
    ('idx_quiz_submissions_student', 'quiz_submissions', 'student_id, completed_at'),
]
for idx, table, cols in indexes:
    schema_parts.append(f'CREATE INDEX IF NOT EXISTS {idx} ON {table} ({cols});')
(SERVER / 'schema.sql').write_text('\n\n'.join(schema_parts) + '\n')

(SERVER / 'database.js').write_text(r'''const fs = require('fs');
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
  const client = await pool.connect();
  let sqlite = null;
  try {
    const marker = await client.query("SELECT 1 FROM _pixiu_migrations WHERE id = 'sqlite-to-postgres-v1'");
    if (marker.rowCount) return;

    const candidates = [
      process.env.SQLITE_MIGRATION_PATH,
      '/opt/render/project/src/data/pixiu_lms.db',
      path.join(__dirname, 'pixiu_lms.db')
    ].filter(Boolean);
    const sqlitePath = candidates.find(file => fs.existsSync(file));
    if (!sqlitePath) {
      console.warn('No legacy SQLite database found; using existing PostgreSQL data.');
      return;
    }

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
''')

pkg = SERVER / 'package.json'
data = json.loads(pkg.read_text())
data['scripts']['start'] = 'node start.js'
data['dependencies']['pg'] = '^8.16.3'
data['dependencies']['compression'] = '^1.8.1'
data['dependencies']['better-sqlite3'] = '^11.0.0'
pkg.write_text(json.dumps(data, indent=2) + '\n')

(SERVER / 'start.js').write_text("""// Production entrypoint: database must initialize before HTTP traffic starts.\nif (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters before the Pixiu LMS API can start.');\nif (!process.env.CORS_ORIGINS || !process.env.CORS_ORIGINS.trim()) throw new Error('CORS_ORIGINS must be configured before the Pixiu LMS API can start.');\nif (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) throw new Error('DATABASE_URL must be configured before the Pixiu LMS API can start.');\nif (process.env.NODE_ENV !== 'production') console.warn('Pixiu LMS API is starting outside NODE_ENV=production.');\n(async () => {\n  try {\n    const db = require('./database');\n    await db.ready;\n    require('./index.js');\n  } catch (err) {\n    console.error('Pixiu LMS API failed to initialize:', err);\n    process.exit(1);\n  }\n})();\n""")

index = SERVER / 'index.js'
text = index.read_text()
if "const compression = require('compression');" not in text:
    text = text.replace("const cors = require('cors');\n", "const cors = require('cors');\nconst compression = require('compression');\n", 1)
if "app.use(compression());" not in text:
    text = text.replace("app.use(express.json({ limit: '2mb' }));", "app.use(compression());\napp.use(express.json({ limit: '2mb' }));", 1)
index.write_text(text)

(SERVER / '.env.example').write_text("""DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME\nDB_POOL_MAX=10\nDB_STATEMENT_TIMEOUT_MS=10000\nJWT_SECRET=replace-with-a-random-secret-at-least-32-characters\nCORS_ORIGINS=https://portal.pixiutech.com,https://pixiutech.com,https://www.pixiutech.com\n""")

(SERVER.parent / 'render.yaml').write_text("""databases:\n  - name: pixiu-lms-db\n    plan: free\n    region: singapore\n    databaseName: pixiu_lms\n    postgresMajorVersion: \"17\"\n    connectionPool: none\n\nservices:\n  - type: web\n    name: pixiu-lms-api\n    runtime: node\n    region: singapore\n    plan: free\n    rootDir: pixiu-lms-portal/server\n    buildCommand: npm install\n    startCommand: node start.js\n    envVars:\n      - key: NODE_ENV\n        value: production\n      - key: PORT\n        value: 10000\n      - key: NODE_VERSION\n        value: 20.18.0\n      - key: JWT_SECRET\n        generateValue: true\n      - key: CORS_ORIGINS\n        value: https://portal.pixiutech.com,https://pixiutech.com,https://www.pixiutech.com\n      - key: DATABASE_URL\n        fromDatabase:\n          name: pixiu-lms-db\n          property: connectionString\n      - key: DB_POOL_MAX\n        value: 10\n      - key: DB_STATEMENT_TIMEOUT_MS\n        value: 10000\n""")

print(f'Prepared PostgreSQL schema for {len(preferred)} tables and {len(indexes)} performance indexes.')
