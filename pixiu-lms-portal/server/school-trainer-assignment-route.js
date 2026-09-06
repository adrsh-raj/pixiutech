const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./database');

const originalListen = express.application.listen;

function splitAssignments(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
  } catch {}
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

function patchSchoolTrainerAssignmentRoute() {
  if (express.application.__pixiuSchoolTrainerAssignmentPatched) return;
  express.application.__pixiuSchoolTrainerAssignmentPatched = true;

  express.application.listen = function patchedListen(...args) {
    const app = this;

    app.post('/api/schools/:id/assign-trainer', async (req, res) => {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: No token provided' });

      try {
        const user = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
        if (!['admin', 'superadmin'].includes(user?.role)) {
          return res.status(403).json({ error: 'Only an admin can assign trainers to schools.' });
        }

        const schoolId = String(req.params.id || '').trim();
        const trainerId = String(req.body?.trainer_id || '').trim();
        if (!schoolId) return res.status(400).json({ error: 'School ID is required.' });

        const school = await db.get('SELECT id, code, name FROM schools WHERE id = ? OR code = ? LIMIT 1', [schoolId, schoolId]);
        if (!school) return res.status(404).json({ error: 'School not found.' });

        const schoolKey = String(school.code || school.id).trim();
        const trainers = await db.all('SELECT id, assigned_schools FROM trainers', []);

        // Remove this school from all trainers first so one school has one owner.
        for (const trainer of trainers) {
          const assignments = splitAssignments(trainer.assigned_schools)
            .filter(item => item !== school.id && item !== schoolKey);
          await db.run('UPDATE trainers SET assigned_schools = ? WHERE id = ?', [assignments.join(','), trainer.id]);
        }

        if (!trainerId) {
          return res.json({ success: true, school_id: school.id, trainer_id: null, trainer_name: null });
        }

        const trainer = trainers.find(item => item.id === trainerId);
        if (!trainer) return res.status(404).json({ error: 'Selected trainer not found.' });

        const assignments = [...new Set([...splitAssignments(trainer.assigned_schools), schoolKey])];
        await db.run('UPDATE trainers SET assigned_schools = ? WHERE id = ?', [assignments.join(','), trainer.id]);

        return res.json({
          success: true,
          school_id: school.id,
          trainer_id: trainer.id,
          trainer_name: (await db.get('SELECT name FROM trainers WHERE id = ? LIMIT 1', [trainer.id]))?.name || null
        });
      } catch (error) {
        console.error('School trainer assignment failed:', error);
        return res.status(500).json({ error: `Unable to assign trainer: ${error?.message || 'Unknown server error.'}` });
      }
    });

    return originalListen.apply(this, args);
  };
}

patchSchoolTrainerAssignmentRoute();
module.exports = { patchSchoolTrainerAssignmentRoute };
