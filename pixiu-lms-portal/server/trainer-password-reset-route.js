const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const originalListen = express.application.listen;

function patchTrainerPasswordResetRoute() {
  if (express.application.__pixiuTrainerPasswordResetPatched) return;
  express.application.__pixiuTrainerPasswordResetPatched = true;

  express.application.listen = function patchedListen(...args) {
    const app = this;

    app.post('/api/trainers/:id/reset-password', async (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      try {
        const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
        if (!['admin', 'superadmin'].includes(decoded.role)) {
          return res.status(403).json({ error: 'Only an admin can reset trainer passwords.' });
        }

        const trainerId = String(req.params.id || '').trim();
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (!trainerId) return res.status(400).json({ error: 'Trainer ID is required.' });
        if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters.' });

        const trainer = await db.get('SELECT id, name, assigned_schools, status FROM trainers WHERE id = ?', [trainerId]);
        if (!trainer) return res.status(404).json({ error: 'Trainer not found.' });

        const passwordHash = await bcrypt.hash(password, 12);
        const username = trainer.id;
        const existingUser = await db.get('SELECT id FROM users WHERE related_id = ? OR (username = ? AND role = \'trainer\') LIMIT 1', [trainer.id, username]);

        if (existingUser?.id) {
          const result = await db.run(
            'UPDATE users SET username = ?, password_hash = ?, role = \'trainer\', related_id = ?, name = ?, school_id = ? WHERE id = ?',
            [username, passwordHash, trainer.id, trainer.name, trainer.assigned_schools || '', existingUser.id]
          );
          if (!result || Number(result.changes ?? 0) < 1) {
            return res.status(500).json({ error: 'Password reset did not update the trainer account.' });
          }
        } else {
          const userId = `USR-${trainer.id}`;
          await db.run(
            'INSERT INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, \'trainer\', ?, ?, ?)',
            [userId, username, passwordHash, trainer.id, trainer.name, trainer.assigned_schools || '']
          );
        }

        return res.json({
          success: true,
          trainer_id: trainer.id,
          trainer_name: trainer.name,
          username,
          message: `Password reset successfully for ${trainer.name}.`
        });
      } catch (error) {
        console.error('Trainer password reset failed:', error);
        return res.status(500).json({ error: 'Unable to reset trainer password.' });
      }
    });

    return originalListen.apply(this, args);
  };
}

patchTrainerPasswordResetRoute();
module.exports = { patchTrainerPasswordResetRoute };
