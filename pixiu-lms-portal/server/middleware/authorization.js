const fs = require('fs');
const path = require('path');

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_ONLY = [
  '/leads', '/billing', '/audit-logs', '/logs', '/trainers',
  '/schools', '/comms', '/settings', '/data-reset'
];
const matches = (pathValue, list) => list.some(prefix => pathValue === prefix || pathValue.startsWith(`${prefix}/`));
const same = (a, b) => a != null && b != null && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
const deny = (res, message) => res.status(403).json({ error: message || 'Forbidden' });
const parseIds = value => String(value || '').split(/[\s,;|]+/).map(v => v.trim()).filter(Boolean);

function filterQuizPayload(payload) {
  const redactQuestions = questions => Array.isArray(questions)
    ? questions.map(({ correct_option, explanation, ...question }) => question)
    : questions;
  if (Array.isArray(payload)) {
    return payload.map(quiz => quiz && typeof quiz === 'object' ? { ...quiz, questions: redactQuestions(quiz.questions) } : quiz);
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.questions)) {
    return { ...payload, questions: redactQuestions(payload.questions) };
  }
  return payload;
}

function scopeResponse(res, scope, route) {
  const original = res.json.bind(res);
  res.json = payload => {
    if (scope.role === 'admin') return original(payload);
    let scoped = payload;

    if (matches(route, ['/quizzes'])) {
      scoped = filterQuizPayload(scoped);
    }

    if (Array.isArray(scoped)) {
      scoped = scoped.filter(row => {
        if (!row || typeof row !== 'object') return true;
        if (scope.role === 'student') {
          if (row.student_id != null) return same(row.student_id, scope.studentId);
          if (row.school_id != null) return same(row.school_id, scope.schoolId);
          return matches(route, ['/content', '/curriculum', '/quizzes']);
        }
        if (row.school_id != null) return scope.schoolIds.some(id => same(row.school_id, id));
        if (row.target_school_id != null) {
          return row.target_school_id == null || same(row.target_school_id, 'ALL') || scope.schoolIds.some(id => same(row.target_school_id, id));
        }
        if (row.student_id != null) return scope.studentIds.has(String(row.student_id));
        if (matches(route, ['/schools'])) return scope.schoolIds.some(id => same(row.id, id) || same(row.code, id));
        if (matches(route, ['/trainers'])) return scope.trainerId ? same(row.id, scope.trainerId) : false;
        if (matches(route, ['/alerts'])) return scope.schoolIds.length === 0;
        return true;
      });
    }
    return original(scoped);
  };
}

function loadSchoolIds(db, role, user) {
  if (role === 'school') return Promise.resolve(parseIds(user.school_id));
  const trainerId = user.related_id || user.id || user.username;
  return new Promise(resolve => db.get('SELECT assigned_schools FROM trainers WHERE id = ?', [trainerId], (err, row) => {
    resolve(err ? [] : parseIds(row?.assigned_schools || user.school_id));
  }));
}

async function resourceSchoolId(db, route, paramName) {
  const id = decodeURIComponent(route.split('/')[2] || '');
  if (!id) return null;
  const tableMap = {
    inventory: 'SELECT school_id FROM inventory WHERE id = ?',
    projects: 'SELECT school_id FROM projects p JOIN students s ON s.student_id = p.student_id WHERE p.id = ?',
    'quiz-submissions': 'SELECT s.school_id FROM quiz_submissions q JOIN students s ON s.student_id = q.student_id WHERE q.id = ?',
    reviews: 'SELECT s.school_id FROM student_reviews r JOIN students s ON s.student_id = r.student_id WHERE r.id = ?',
    notifications: 'SELECT target_school_id FROM notifications WHERE id = ?',
  };
  const sql = tableMap[paramName];
  if (!sql) return null;
  return new Promise(resolve => db.get(sql, [id], (err, row) => resolve(err ? null : (row?.school_id ?? row?.target_school_id ?? null))));
}

async function servePrivateTeacherMaterial(req, res) {
  const filename = decodeURIComponent(req.params?.filename || '');
  if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(filename)) return res.status(400).json({ error: 'Invalid material filename.' });
  const privateMaterialsDir = path.join(__dirname, '..', 'private', 'materials');
  const filePath = path.join(privateMaterialsDir, filename);
  const resolvedRoot = path.resolve(privateMaterialsDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) return res.status(400).json({ error: 'Invalid material path.' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Material not found.' });
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('application/pdf');
  return res.sendFile(filePath);
}

function authorizationMiddleware(db) {
  return async (req, res, next) => {
    const user = req.user;
    const role = user?.role;
    const route = req.path;
    if (!user || !role) return deny(res, 'Authenticated role is required');

    if (route.startsWith('/materials/')) {
      if (!READ_ONLY.has(req.method)) return deny(res, 'Material access is read-only');
      if (!['admin', 'trainer'].includes(role)) return deny(res, 'Teacher master materials are restricted.');
      return servePrivateTeacherMaterial(req, res);
    }

    if (role === 'admin' || role === 'superadmin') return next();
    if (!['trainer', 'school', 'student'].includes(role)) return deny(res, 'Unsupported role');

    // Students can only read learning data and submit their own quiz attempts.
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

    // School/trainer accounts are tenant-scoped. Trainer school assignments are stored as a list.
    const schoolIds = await loadSchoolIds(db, role, user);
    if (!schoolIds.length) return deny(res, 'School scope is required for this account');
    const schoolIdSet = new Set(schoolIds.map(id => String(id).toUpperCase()));
    const studentIds = new Set();
    await new Promise(resolve => db.all('SELECT student_id FROM students WHERE school_id = ANY(?)', [schoolIds], (err, rows = []) => {
      if (!err) rows.forEach(row => studentIds.add(String(row.student_id)));
      resolve();
    }));

    // Resource capability rules. Management resources stay admin-only; trainers operate academic/kit workflows.
    if (matches(route, ['/schools', '/leads', '/billing', '/logs', '/audit-logs', '/settings', '/data-reset'])) return deny(res, 'Administrator access required');
    if (role === 'school' && matches(route, ['/trainers', '/comms'])) return deny(res, 'Restricted for school accounts');
    if (role === 'trainer' && route === '/trainers' && !READ_ONLY.has(req.method)) return deny(res, 'Trainer management is restricted to administrators');
    if (role === 'trainer' && matches(route, ['/notifications']) && !READ_ONLY.has(req.method) && req.body?.target_school_id && !schoolIds.some(id => same(id, req.body.target_school_id)) && !same(req.body.target_school_id, 'ALL')) return deny(res, 'Notification target is outside trainer scope');

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

    // Protect object routes that do not carry school_id in the request body.
    const objectNames = ['inventory', 'projects', 'quiz-submissions', 'reviews', 'notifications'];
    for (const objectName of objectNames) {
      if (route.startsWith(`/${objectName}/`) && req.params?.id) {
        const objectSchool = await resourceSchoolId(db, route, objectName);
        if (objectSchool && !schoolIds.some(id => same(id, objectSchool)) && !same(objectSchool, 'ALL')) return deny(res, 'Object is outside your school scope');
      }
    }

    // Attendance must belong to a session in one of the caller's schools.
    if (route.startsWith('/attendance') && req.body?.session_id) {
      const sessionAllowed = await new Promise(resolve => db.get('SELECT school_id, class_id FROM sessions WHERE id = ?', [req.body.session_id], (err, row) => resolve(!err && row && schoolIds.some(id => same(id, row.school_id)))));
      if (!sessionAllowed) return deny(res, 'Attendance session is outside your school scope');
    }

    // School accounts are read-only except explicitly supported operational submissions.
    if (role === 'school' && !READ_ONLY.has(req.method) && !matches(route, ['/attendance', '/notifications/reads', '/reviews'])) return deny(res, 'School account is read-only for this resource');

    const trainerId = user.related_id || user.id || user.username;
    scopeResponse(res, { role, schoolId: schoolIds[0], schoolIds, studentIds, trainerId }, route);
    return next();
  };
}

module.exports = { authorizationMiddleware };