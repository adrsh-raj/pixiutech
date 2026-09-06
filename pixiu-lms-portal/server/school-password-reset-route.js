const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const originalListen = express.application.listen;

function patchSchoolPasswordResetRoute() {
  if (express.application.__pixiuSchoolPasswordResetPatched) return;
  express.application.__pixiuSchoolPasswordResetPatched = true;

  express.application.listen = function patchedListen(...args) {
    const app = this;

    app.post('/api/schools/:id/reset-password', async (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      try {
        const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
        if (!['admin', 'superadmin'].includes(decoded.role)) {
          return res.status(403).json({ error: 'Only an admin can manage school passwords.' });
        }

        const schoolId = String(req.params.id || '').trim();
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (!schoolId) return res.status(400).json({ error: 'School ID is required.' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

        const school = await db.get(
          'SELECT id, name, code, status FROM schools WHERE id = ? OR code = ? LIMIT 1',
          [schoolId, schoolId]
        );
        if (!school) return res.status(404).json({ error: 'School not found.' });

        const username = String(school.code || school.id).trim();
        const passwordHash = await bcrypt.hash(password, 12);
        const existingUser = await db.get(
          "SELECT id, role, username FROM users WHERE (related_id = ? AND role = 'school') OR (username = ? AND role = 'school') LIMIT 1",
          [school.id, username]
        );

        if (existingUser?.id) {
          await db.run(
            "UPDATE users SET username = ?, password_hash = ?, role = 'school', related_id = ?, name = ?, school_id = ? WHERE id = ?",
            [username, passwordHash, school.id, school.name, school.id, existingUser.id]
          );
        } else {
          const conflictingUser = await db.get('SELECT id, role FROM users WHERE username = ? LIMIT 1', [username]);
          if (conflictingUser?.id) {
            return res.status(409).json({ error: `School username ${username} is already assigned to another account.` });
          }

          const userId = `USR-SCHOOL-${school.id}`;
          await db.run(
            "INSERT INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, 'school', ?, ?, ?)",
            [userId, username, passwordHash, school.id, school.name, school.id]
          );
        }

        return res.json({
          success: true,
          school_id: school.id,
          school_name: school.name,
          username,
          message: `School password saved successfully for ${school.name}.`
        });
      } catch (error) {
        console.error('School password reset failed:', error);
        return res.status(500).json({ error: 'Unable to save school password.' });
      }
    });

    return originalListen.apply(this, args);
  };
}

patchSchoolPasswordResetRoute();
module.exports = { patchSchoolPasswordResetRoute };
