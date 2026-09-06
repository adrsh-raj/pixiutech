const fs = require('fs');
const path = require('path');

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_ONLY = ['/leads', '/billing', '/audit-logs', '/trainers'];
const matches = (pathValue, list) => list.some(prefix => pathValue === prefix || pathValue.startsWith(`${prefix}/`));
const same = (a, b) => a != null && b != null && String(a).trim() === String(b).trim();
const deny = (res, message) => res.status(403).json({ error: message || 'Forbidden' });

function scopeResponse(res, scope) {
  const original = res.json.bind(res);
  res.json = payload => {
    if (scope.role === 'admin' || !Array.isArray(payload)) return original(payload);
    const rows = payload.filter(row => {
      if (!row || typeof row !== 'object') return true;
      if (scope.role === 'student') {
        if (row.student_id != null) return same(row.student_id, scope.studentId);
        if (row.school_id != null) return same(row.school_id, scope.schoolId);
        return true;
      }
      if (row.school_id != null) return same(row.school_id, scope.schoolId);
      if (row.target_school_id != null) return same(row.target_school_id, scope.schoolId);
      if (row.student_id != null) return scope.studentIds.has(String(row.student_id));
      return true;
    });
    return original(rows);
  };
}

async function servePrivateTeacherMaterial(req, res) {
  const filename = decodeURIComponent(req.params?.filename || '');
  if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(filename)) {
    return res.status(400).json({ error: 'Invalid material filename.' });
  }

  const privateMaterialsDir = path.join(__dirname, '..', 'private', 'materials');
  const filePath = path.join(privateMaterialsDir, filename);
  const resolvedRoot = path.resolve(privateMaterialsDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return res.status(400).json({ error: 'Invalid material path.' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Material not found.' });
  }

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

    // Teacher master PDFs are private server assets and only available to admins/trainers.
    if (route.startsWith('/materials/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return deny(res, 'Material access is read-only');
      if (!['admin', 'trainer'].includes(role)) return deny(res, 'Teacher master materials are restricted.');
      return servePrivateTeacherMaterial(req, res);
    }

    if (role === 'admin') return next();
    if (!['trainer', 'school', 'student'].includes(role)) return deny(res, 'Unsupported role');
    if (matches(route, ADMIN_ONLY)) return deny(res, 'Administrator access required');

    if (role === 'student') {
      const readable = ['/students', '/classes', '/sessions', '/attendance', '/content', '/curriculum', '/projects', '/reviews', '/notifications', '/quizzes', '/quiz-submissions'];
      const canRead = READ_ONLY.has(req.method) && matches(route, readable);
      const canSubmit = req.method === 'POST' && matches(route, ['/quiz-submissions']);
      if (!canRead && !canSubmit) return deny(res, 'Students are not permitted to modify this resource');
      const studentId = user.related_id || user.username;
      const schoolId = user.school_id || null;
      if (route.startsWith('/students/')) {
        const id = decodeURIComponent(route.split('/')[2] || '');
        if (!same(id, studentId)) return deny(res, 'Students can access only their own profile');
      }
      if (req.body?.student_id && !same(req.body.student_id, studentId)) return deny(res, 'Student scope violation');
      if (req.body?.school_id && schoolId && !same(req.body.school_id, schoolId)) return deny(res, 'School scope violation');
      scopeResponse(res, { role, studentId, schoolId, studentIds: new Set([String(studentId)]) });
      return next();
    }

    if (!user.school_id) return deny(res, 'School scope is required for this account');
    const schoolId = String(user.school_id);
    const studentIds = new Set();
    await new Promise(resolve => db.all('SELECT student_id FROM students WHERE school_id = ?', [schoolId], (err, rows = []) => {
      if (!err) rows.forEach(row => studentIds.add(String(row.student_id)));
      resolve();
    }));

    if (role === 'school' && matches(route, ['/trainers', '/leads', '/billing', '/comms'])) return deny(res, 'Restricted for school accounts');
    if (role === 'trainer' && matches(route, ['/trainers'])) return deny(res, 'Trainer management is restricted to administrators');

    const requestSchool = req.body?.school_id || req.query?.school_id;
    if (requestSchool && !same(requestSchool, schoolId)) return deny(res, 'Cross-school access is not permitted');
    if (req.body?.student_id && !studentIds.has(String(req.body.student_id))) return deny(res, 'Student is outside your school scope');
    if (route.startsWith('/students/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      if (!studentIds.has(String(id))) return deny(res, 'Student is outside your school scope');
    }
    if (route.startsWith('/schools/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      if (!same(id, schoolId)) return deny(res, 'School is outside your account scope');
    }
    if (role === 'school' && !READ_ONLY.has(req.method) && !matches(route, ['/attendance', '/notifications', '/reviews', '/quiz-submissions'])) return deny(res, 'School account is read-only for this resource');

    scopeResponse(res, { role, schoolId, studentIds });
    return next();
  };
}
module.exports = { authorizationMiddleware };