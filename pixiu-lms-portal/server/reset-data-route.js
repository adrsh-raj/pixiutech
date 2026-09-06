const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const DOMAIN_TABLES = [
  'attendance', 'sessions', 'quiz_submissions', 'quiz_questions', 'quizzes',
  'student_reviews', 'notification_reads', 'notifications', 'audit_logs',
  'alerts', 'projects', 'comms_logs', 'billing', 'inventory', 'curriculum',
  'content', 'leads', 'students', 'classes', 'trainers', 'schools'
];

const originalListen = express.application.listen;

function patchApplicationResetRoute() {
  if (express.application.__pixiuResetDataPatched) return;
  express.application.__pixiuResetDataPatched = true;

  express.application.listen = function patchedListen(...args) {
    const app = this;

    app.post('/api/admin/reset-application-data', async (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      let user;
      try {
        user = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Session expired or invalid' });
      }

      if (!['admin', 'superadmin'].includes(user?.role)) {
        return res.status(403).json({ error: 'Only an administrator can reset application data.' });
      }

      const confirmation = typeof req.body?.confirmation === 'string' ? req.body.confirmation.trim() : '';
      if (confirmation !== 'PIXIU_RESET') {
        return res.status(400).json({ error: 'Confirmation text must be PIXIU_RESET.' });
      }

      const databaseUrl = process.env.DATABASE_URL?.trim();
      if (!databaseUrl) {
        return res.status(500).json({ error: 'DATABASE_URL is not configured.' });
      }

      const pool = new Pool({ connectionString: databaseUrl, max: 1 });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`TRUNCATE TABLE ${DOMAIN_TABLES.map(name => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`);
        await client.query("DELETE FROM users WHERE role NOT IN ('admin', 'superadmin')");
        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Application data reset complete. Administrator accounts were preserved.'
        });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin application reset failed:', error);
        return res.status(500).json({ error: 'Application data reset failed.' });
      } finally {
        client.release();
        await pool.end();
      }
    });

    return originalListen.apply(this, args);
  };
}

patchApplicationResetRoute();

module.exports = { patchApplicationResetRoute };
