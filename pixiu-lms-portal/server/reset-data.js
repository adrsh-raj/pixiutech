const { Pool } = require('pg');

if (process.env.CONFIRM_RESET !== 'PIXIU_RESET') {
  console.error('Refusing to reset data. Set CONFIRM_RESET=PIXIU_RESET to continue.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

const domainTables = [
  'attendance', 'sessions', 'quiz_submissions', 'quiz_questions', 'quizzes',
  'student_reviews', 'notification_reads', 'notifications', 'audit_logs',
  'alerts', 'projects', 'comms_logs', 'billing', 'inventory', 'curriculum',
  'content', 'leads', 'students', 'classes', 'trainers', 'schools'
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of domainTables) {
      await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
    // Preserve administrator accounts so the fresh system remains accessible.
    await client.query("DELETE FROM users WHERE role NOT IN ('admin', 'superadmin')");
    await client.query("DELETE FROM _pixiu_migrations WHERE id = 'sqlite-to-postgres-v1'");
    await client.query('COMMIT');
    console.log('PIXIU application data reset complete. Administrator accounts were preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('PIXIU data reset failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
