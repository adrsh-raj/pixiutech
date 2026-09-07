const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_MUTATION_ROOTS = ['/leads', '/billing', '/logs', '/audit-logs', '/settings', '/data-reset'];
const matches = (pathValue, list) => list.some(prefix => pathValue === prefix || pathValue.startsWith(`${prefix}/`));
const same = (a, b) => a != null && b != null && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
const deny = (res, message) => res.status(403).json({ error: message || 'Forbidden' });
const parseIds = value => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
  } catch {}
  return raw.split(/[\s,;|]+/).map(v => v.trim()).filter(Boolean);
};

function filterQuizPayload(payload) {
  const redactQuestions = questions => Array.isArray(questions)
    ? questions.map(({ correct_option, explanation, ...question }) => question)
    : questions;
  if (Array.isArray(payload)) return payload.map(quiz => quiz && typeof quiz === 'object' ? { ...quiz, questions: redactQuestions(quiz.questions) } : quiz);
  if (payload && typeof payload === 'object' && Array.isArray(payload.questions)) return { ...payload, questions: redactQuestions(payload.questions) };
  return payload;
}

function scopeResponse(res, scope, route) {
  const original = res.json.bind(res);
  res.json = payload => {
    if (scope.role === 'admin' || scope.role === 'superadmin') return original(payload);
    let scoped = matches(route, ['/quizzes']) ? filterQuizPayload(payload) : payload;
    if (Array.isArray(scoped)) {
      scoped = scoped.filter(row => {
        if (!row || typeof row !== 'object') return true;
        if (scope.role === 'student') {
          if (row.student_id != null) return same(row.student_id, scope.studentId);
          if (row.school_id != null) return same(row.school_id, scope.schoolId);
          return matches(route, ['/content', '/curriculum', '/quizzes']);
        }
        if (matches(route, ['/trainer-materials'])) {
          return same(row.target_trainer_id, 'ALL') || same(row.target_trainer_id, scope.trainerId);
        }
        if (row.school_id != null) return scope.schoolIds.some(id => same(row.school_id, id));
        if (row.target_school_id != null) return same(row.target_school_id, 'ALL') || scope.schoolIds.some(id => same(row.target_school_id, id));
        if (row.student_id != null) return scope.studentIds.has(String(row.student_id));
        if (matches(route, ['/schools'])) return scope.schoolIds.some(id => same(row.id, id) || same(row.code, id));
        if (matches(route, ['/trainers'])) return scope.role === 'school' ? scope.trainerIds.some(id => same(row.id, id)) : Boolean(scope.trainerId) && same(row.id, scope.trainerId);
        if (matches(route, ['/alerts'])) return false;
        return true;
      });
    }
    return original(scoped);
  };
}

function loadSchoolIds(db, role, user) {
  if (role === 'school') return Promise.resolve(parseIds(user.school_id));
  const trainerId = user.related_id || user.id || user.username;
  return new Promise(resolve => db.get('SELECT assigned_schools FROM trainers WHERE id = ?', [trainerId], (err, row) => resolve(err ? [] : parseIds(row?.assigned_schools || user.school_id))));
}

function loadTrainerIds(db, schoolIds) {
  if (!schoolIds.length) return Promise.resolve([]);
  return new Promise(resolve => db.all('SELECT id, assigned_schools FROM trainers', [], (err, rows = []) => {
    if (err) return resolve([]);
    resolve(rows.filter(row => parseIds(row.assigned_schools).some(id => schoolIds.some(schoolId => same(id, schoolId)))).map(row => String(row.id)));
  }));
}

async function resourceSchoolId(db, route, objectName) {
  const id = decodeURIComponent(route.split('/')[2] || '');
  if (!id) return null;
  const tableMap = {
    inventory: 'SELECT school_id FROM inventory WHERE id = ?',
    projects: 'SELECT s.school_id FROM projects p JOIN students s ON s.student_id = p.student_id WHERE p.id = ?',
    'quiz-submissions': 'SELECT s.school_id FROM quiz_submissions q JOIN students s ON s.student_id = q.student_id WHERE q.id = ?',
    reviews: 'SELECT s.school_id FROM student_reviews r JOIN students s ON s.student_id = r.student_id WHERE r.id = ?',
    notifications: 'SELECT target_school_id FROM notifications WHERE id = ?',
    billing: 'SELECT school_id FROM billing WHERE id = ?'
  };
  const sql = tableMap[objectName];
  if (!sql) return null;
  return new Promise(resolve => db.get(sql, [id], (err, row) => resolve(err ? null : (row?.school_id ?? row?.target_school_id ?? null))));
}

const materialDir = (process.env.RENDER && fs.existsSync('/opt/render/project/src/data'))
  ? '/opt/render/project/src/data/uploads'
  : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(materialDir)) fs.mkdirSync(materialDir, { recursive: true });

const materialStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, materialDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const token = crypto.randomBytes(12).toString('hex');
    cb(null, `trainer-material-${Date.now()}-${token}${ext}`);
  }
});
const materialUpload = multer({
  storage: materialStorage,
  fileFilter: (_, file, cb) => cb(null, file.mimetype === 'application/pdf' && path.extname(file.originalname || '').toLowerCase() === '.pdf'),
  limits: { fileSize: 20 * 1024 * 1024 }
});

function materialFilePath(fileName) {
  if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(String(fileName || ''))) return null;
  const candidate = path.resolve(path.join(materialDir, fileName));
  const root = path.resolve(materialDir);
  return candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

function handleTrainerMaterials(db, req, res) {
  const route = req.path;
  const role = req.user?.role;
  const trainerId = req.user?.related_id || req.user?.id || req.user?.username;

  if (route === '/trainer-materials' && req.method === 'GET') {
    const sql = role === 'admin' || role === 'superadmin'
      ? 'SELECT * FROM trainer_materials ORDER BY created_at DESC'
      : 'SELECT * FROM trainer_materials WHERE target_trainer_id = ? OR target_trainer_id = \'ALL\' ORDER BY created_at DESC';
    const params = role === 'admin' || role === 'superadmin' ? [] : [trainerId];
    return db.all(sql, params, (err, rows = []) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(rows);
    });
  }

  if (route.startsWith('/trainer-materials/') && route.endsWith('/file') && req.method === 'GET') {
    const id = decodeURIComponent(route.split('/')[2] || '');
    return db.get('SELECT * FROM trainer_materials WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Material not found.' });
      if (role !== 'admin' && role !== 'superadmin' && !same(row.target_trainer_id, 'ALL') && !same(row.target_trainer_id, trainerId)) return deny(res, 'Material is not assigned to this trainer');
      const filePath = materialFilePath(row.file_name);
      if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Material file is unavailable.' });
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `inline; filename="${String(row.title || 'Trainer Material').replace(/[^A-Za-z0-9._ -]/g, '')}.pdf"`);
      res.type('application/pdf');
      return res.sendFile(filePath);
    });
  }

  if (route === '/trainer-materials' && req.method === 'POST') {
    if (role !== 'admin' && role !== 'superadmin') return deny(res, 'Administrator access required to send trainer materials');
    return materialUpload.single('file')(req, res, async err => {
      if (err) return res.status(400).json({ error: err.message || 'PDF upload failed.' });
      const { title, description, class_grade, level } = req.body || {};
      let targetTrainerId = String(req.body?.target_trainer_id || '').trim();
      if (!title?.trim()) {
        if (req.file) fs.rmSync(req.file.path, { force: true });
        return res.status(400).json({ error: 'Material title is required.' });
      }
      if (!req.file) return res.status(400).json({ error: 'A PDF file is required.' });
      if (!targetTrainerId) targetTrainerId = 'ALL';
      if (!same(targetTrainerId, 'ALL')) {
        const trainer = await db.get('SELECT id FROM trainers WHERE id = ?', [targetTrainerId]);
        if (!trainer) {
          fs.rmSync(req.file.path, { force: true });
          return res.status(400).json({ error: 'Selected trainer does not exist.' });
        }
      }
      const id = `TM-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const fileUrl = `/api/trainer-materials/${encodeURIComponent(id)}/file`;
      db.run(
        'INSERT INTO trainer_materials (id, title, description, type, class_grade, level, target_trainer_id, file_name, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, title.trim(), description || '', 'PDF', class_grade || '', level || '', targetTrainerId, path.basename(req.file.path), fileUrl, req.user?.name || req.user?.username || 'Admin'],
        function (insertErr) {
          if (insertErr) {
            fs.rmSync(req.file.path, { force: true });
            return res.status(500).json({ error: insertErr.message });
          }
          return res.status(201).json({ success: true, id, target_trainer_id: targetTrainerId, file_url: fileUrl });
        }
      );
    });
  }

  if (route.startsWith('/trainer-materials/') && req.method === 'DELETE') {
    if (role !== 'admin' && role !== 'superadmin') return deny(res, 'Administrator access required');
    const id = decodeURIComponent(route.split('/')[2] || '');
    return db.get('SELECT file_name FROM trainer_materials WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Material not found.' });
      db.run('DELETE FROM trainer_materials WHERE id = ?', [id], function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: deleteErr.message });
        const filePath = materialFilePath(row.file_name);
        if (filePath) fs.rmSync(filePath, { force: true });
        return res.json({ success: true, deleted: id });
      });
    });
  }

  return false;
}

function authorizationMiddleware(db) {
  return async (req, res, next) => {
    const user = req.user;
    const role = user?.role;
    const route = req.path;
    if (!user || !role) return deny(res, 'Authenticated role is required');

    if (route.startsWith('/trainer-materials')) {
      const handled = handleTrainerMaterials(db, req, res);
      if (handled !== false) return;
    }

    if (role === 'admin' || role === 'superadmin') return next();
    if (!['trainer', 'school', 'student'].includes(role)) return deny(res, 'Unsupported role');

    if (role === 'student') {
      const readable = ['/students', '/classes', '/sessions', '/attendance', '/content', '/curriculum', '/projects', '/reviews', '/notifications', '/quizzes', '/quiz-submissions'];
      const canRead = READ_ONLY.has(req.method) && matches(route, readable);
      const canSubmit = req.method === 'POST' && route === '/quiz-submissions';
      if (!canRead && !canSubmit) return deny(res, 'Students are not permitted to modify this resource');
      const studentId = user.related_id || user.username;
      const schoolId = user.school_id || null;
      if (route.startsWith('/students/')) {
        const id = decodeURIComponent(route.split('/')[2] || '');
        if (!same(id, studentId)) return deny(res, 'Students can access only their own profile');
      }
      if (req.body?.student_id && !same(req.body.student_id, studentId)) return deny(res, 'Student scope violation');
      if (req.body?.school_id && schoolId && !same(req.body.school_id, schoolId)) return deny(res, 'School scope violation');
      if (route.startsWith('/notifications/reads/')) {
        const userKey = decodeURIComponent(route.split('/')[3] || '');
        if (!same(userKey, user.username) && !same(userKey, studentId)) return deny(res, 'Notification read scope violation');
      }
      scopeResponse(res, { role, studentId, schoolId, studentIds: new Set([String(studentId)]), schoolIds: [schoolId].filter(Boolean) }, route);
      return next();
    }

    const schoolIds = await loadSchoolIds(db, role, user);
    if (!schoolIds.length) return deny(res, 'School scope is required for this account');
    const studentIds = new Set();
    await new Promise(resolve => db.all('SELECT student_id FROM students WHERE school_id = ANY(?::text[])', [schoolIds], (err, rows = []) => {
      if (!err) rows.forEach(row => studentIds.add(String(row.student_id)));
      resolve();
    }));
    const trainerIds = await loadTrainerIds(db, schoolIds);

    const isScopedSchoolRead = role === 'school' && READ_ONLY.has(req.method) && matches(route, ['/schools', '/billing', '/trainers']);
    const isTrainerSchoolRead = role === 'trainer' && READ_ONLY.has(req.method) && matches(route, ['/schools', '/trainers']);
    const isSchoolPaymentClaim = role === 'school' && route.startsWith('/billing/') && req.method === 'PUT';
    if (matches(route, ADMIN_MUTATION_ROOTS) && !(isScopedSchoolRead || isTrainerSchoolRead || isSchoolPaymentClaim)) return deny(res, 'Administrator access required');

    if (role === 'school' && matches(route, ['/comms'])) return deny(res, 'Restricted for school accounts');
    if (role === 'trainer' && route === '/trainers' && !READ_ONLY.has(req.method)) return deny(res, 'Trainer management is restricted to administrators');
    if (role === 'trainer' && matches(route, ['/billing'])) return deny(res, 'Billing is restricted to administrators');

    if (isSchoolPaymentClaim) {
      const invoiceSchool = await resourceSchoolId(db, route, 'billing');
      if (!invoiceSchool || !schoolIds.some(id => same(id, invoiceSchool))) return deny(res, 'Invoice is outside your school scope');
      const allowedFields = new Set(['status', 'school_claimed_payment', 'transaction_id', 'receipt_no', 'payment_method', 'paid_date', 'proof_url', 'payment_notes', 'claimed_at']);
      const bodyKeys = Object.keys(req.body || {});
      if (bodyKeys.some(key => !allowedFields.has(key))) return deny(res, 'School payment claim contains restricted fields');
      if (req.body?.status && !['Pending', 'Pending Verification'].includes(String(req.body.status))) return deny(res, 'Invalid school payment claim status');
      if (req.body?.school_claimed_payment !== true && req.body?.school_claimed_payment !== false) return deny(res, 'Payment claim flag is required');
    }

    if (role === 'school' && route === '/notifications' && req.method === 'POST') {
      if (!same(req.body?.target_school_id, 'ADMIN') || req.body?.type !== 'payment_claim') return deny(res, 'Schools may only submit payment claims');
    }
    if (role === 'school' && matches(route, ['/notifications']) && !READ_ONLY.has(req.method) && !(route === '/notifications' && req.method === 'POST')) return deny(res, 'School notification mutations are restricted');
    if (role === 'trainer' && matches(route, ['/notifications']) && !READ_ONLY.has(req.method)) {
      if (!(route === '/notifications' && req.method === 'POST')) return deny(res, 'Trainer notification management is restricted');
      if (req.body?.target_school_id && !same(req.body.target_school_id, 'ALL') && !schoolIds.some(id => same(id, req.body.target_school_id))) return deny(res, 'Notification target is outside trainer scope');
    }

    const requestSchool = req.body?.school_id || req.query?.school_id;
    if (requestSchool && !schoolIds.some(id => same(requestSchool, id))) return deny(res, 'Cross-school access is not permitted');
    if (req.body?.student_id && !studentIds.has(String(req.body.student_id))) return deny(res, 'Student is outside your school scope');
    if (route.startsWith('/students/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      if (!studentIds.has(String(id))) return deny(res, 'Student is outside your school scope');
    }
    if (route.startsWith('/schools/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      if (!schoolIds.some(s => same(id, s))) return deny(res, 'School is outside your account scope');
    }

    const objectNames = ['inventory', 'projects', 'quiz-submissions', 'reviews', 'notifications', 'billing'];
    for (const objectName of objectNames) {
      if (route.startsWith(`/${objectName}/`) && req.params?.id) {
        const objectSchool = await resourceSchoolId(db, route, objectName);
        if (objectSchool && !schoolIds.some(id => same(id, objectSchool)) && !same(objectSchool, 'ALL')) return deny(res, 'Object is outside your school scope');
      }
    }

    if (route.startsWith('/attendance') && req.body?.session_id) {
      const sessionAllowed = await new Promise(resolve => db.get('SELECT school_id FROM sessions WHERE id = ?', [req.body.session_id], (err, row) => resolve(!err && row && schoolIds.some(id => same(id, row.school_id)))));
      if (!sessionAllowed) return deny(res, 'Attendance session is outside your school scope');
    }

    if (role === 'school' && !READ_ONLY.has(req.method) && !matches(route, ['/attendance', '/notifications/reads', '/reviews', '/notifications', '/billing/'])) return deny(res, 'School account is read-only for this resource');

    const trainerId = user.related_id || user.id || user.username;
    scopeResponse(res, { role, schoolIds, studentIds, trainerId, trainerIds }, route);
    return next();
  };
}

module.exports = { authorizationMiddleware };