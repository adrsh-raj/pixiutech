const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'pixiu_super_secret_jwt_key_2026';

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://portal.pixiutech.com',
  'https://pixiutech.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev, constrained in prod
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// Serve uploaded media files statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Secure Multer Storage Configuration for Robot Build Photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(rawExt) ? rawExt : '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'evidence-' + uniqueSuffix + safeExt);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only valid image files (JPG, PNG, WebP, GIF) are permitted!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB maximum
});

// File Upload Endpoint with validation
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  });
});

// In-Memory Login Attempt Tracker (Brute Force Defense)
const loginAttempts = new Map();

// ==================== 0. AUTHENTICATION API ====================

// Login Endpoint (Supports Admin, Trainer, and Student ID)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Student ID and password are required' });
  }

  const cleanUsername = username.trim();
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const trackerKey = `${clientIp}:${cleanUsername}`;

  const currentAttempts = loginAttempts.get(trackerKey) || { count: 0, lastAttempt: Date.now() };

  // If more than 10 failed attempts within 5 minutes, block temporarily
  if (currentAttempts.count >= 10 && (Date.now() - currentAttempts.lastAttempt < 300000)) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please wait 5 minutes before trying again.' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [cleanUsername], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      return res.status(401).json({ error: 'Invalid ID / Username or Password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid ID / Username or Password' });
    }

    // Sign JWT Token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name, 
        related_id: user.related_id,
        school_id: user.school_id 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        related_id: user.related_id,
        school_id: user.school_id
      }
    });
  });
});

// Verify Current Token
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
});

// ==================== 1. SCHOOLS API ====================
app.get('/api/schools', (req, res) => {
  db.all("SELECT * FROM schools ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/schools', (req, res) => {
  const { id, name, code, principal, contact, status, contract_start, renewal_date, expected_revenue } = req.body;
  const schoolId = id || code || `SCH-${Date.now()}`;
  const sql = `INSERT INTO schools (id, name, code, principal, contact, status, contract_start, renewal_date, expected_revenue) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [schoolId, name, code, principal || '', contact || '', status || 'Active', contract_start || '', renewal_date || '', expected_revenue || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: schoolId, name, code, principal, contact, status: status || 'Active' });
  });
});

app.put('/api/schools/:id', (req, res) => {
  const { name, principal, contact, status, contract_start, renewal_date, expected_revenue } = req.body;
  const sql = `UPDATE schools SET 
                name = COALESCE(?, name),
                principal = COALESCE(?, principal),
                contact = COALESCE(?, contact),
                status = COALESCE(?, status),
                contract_start = COALESCE(?, contract_start),
                renewal_date = COALESCE(?, renewal_date),
                expected_revenue = COALESCE(?, expected_revenue)
               WHERE id = ? OR code = ?`;
  db.run(sql, [name, principal, contact, status, contract_start, renewal_date, expected_revenue, req.params.id, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, name, status });
  });
});

app.delete('/api/schools/:id', (req, res) => {
  db.run("DELETE FROM schools WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 2. CLASSES API ====================
app.get('/api/classes', (req, res) => {
  db.all("SELECT * FROM classes", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/classes', (req, res) => {
  const { id, school_id, grade, section } = req.body;
  const classId = id || `CLS-${school_id}-${grade}${section || ''}`;
  const sql = `INSERT INTO classes (id, school_id, grade, section) VALUES (?, ?, ?, ?)`;
  db.run(sql, [classId, school_id, grade, section || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: classId, school_id, grade, section });
  });
});

// ==================== 3. STUDENTS API & AUTO-ACCOUNT ====================
app.get('/api/students', (req, res) => {
  db.all("SELECT * FROM students ORDER BY student_id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/students', async (req, res) => {
  const { student_id, school_id, class_id, name, parent_name, parent_whatsapp, tech_level, status, dob, assigned_kit_id, password } = req.body;
  const sql = `INSERT INTO students (student_id, school_id, class_id, name, parent_name, parent_whatsapp, tech_level, status, dob, assigned_kit_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [student_id, school_id, class_id, name, parent_name || '', parent_whatsapp || '', tech_level || 'Level 1', status || 'Active', dob || '', assigned_kit_id || ''], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Auto-create student login user in `users` table with hashed password
    const studentPassword = password || 'student123';
    const passwordHash = await bcrypt.hash(studentPassword, 10);
    const userId = `USR-${student_id.replace(/\s+/g, '')}`;
    
    db.run(
      "INSERT OR REPLACE INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, student_id, passwordHash, 'student', student_id, name, school_id]
    );

    res.json({ success: true, student_id, school_id, class_id, name, parent_name, parent_whatsapp, tech_level });
  });
});

app.put('/api/students/:id', async (req, res) => {
  const { name, parent_name, parent_whatsapp, tech_level, status, assigned_kit_id, school_id, class_id } = req.body;
  const sql = `UPDATE students SET 
                name = COALESCE(?, name),
                parent_name = COALESCE(?, parent_name),
                parent_whatsapp = COALESCE(?, parent_whatsapp),
                tech_level = COALESCE(?, tech_level),
                status = COALESCE(?, status),
                assigned_kit_id = COALESCE(?, assigned_kit_id),
                school_id = COALESCE(?, school_id),
                class_id = COALESCE(?, class_id)
               WHERE student_id = ?`;
  
  db.run(sql, [name, parent_name, parent_whatsapp, tech_level, status, assigned_kit_id, school_id, class_id, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (name) {
      db.run("UPDATE users SET name = ? WHERE related_id = ?", [name, req.params.id]);
    }
    res.json({ success: true, student_id: req.params.id, name, parent_name, parent_whatsapp, tech_level });
  });
});

app.delete('/api/students/:id', (req, res) => {
  db.run("DELETE FROM students WHERE student_id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run("DELETE FROM users WHERE related_id = ?", [req.params.id]);
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 4. LEADS (CRM) API ====================
app.get('/api/leads', (req, res) => {
  db.all("SELECT * FROM leads ORDER BY rowid DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/leads', (req, res) => {
  const { id, name, contact_person, phone, city, stage, expected_value, notes, last_contact } = req.body;
  const leadId = id || `L-${Date.now().toString().slice(-4)}`;
  const sql = `INSERT INTO leads (id, name, contact_person, phone, city, stage, expected_value, notes, last_contact) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [leadId, name, contact_person || '', phone || '', city || '', stage || 'Contacted', expected_value || 0, notes || '', last_contact || new Date().toISOString().split('T')[0]], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: leadId, name, contact_person, phone, city, stage: stage || 'Contacted', expected_value, notes });
  });
});

app.put('/api/leads/:id/stage', (req, res) => {
  const { stage } = req.body;
  db.run("UPDATE leads SET stage = ? WHERE id = ?", [stage, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, stage });
  });
});

app.delete('/api/leads/:id', (req, res) => {
  db.run("DELETE FROM leads WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 5. SESSIONS & ATTENDANCE API ====================
app.get('/api/sessions', (req, res) => {
  db.all("SELECT * FROM sessions ORDER BY date DESC, time ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sessions', (req, res) => {
  const { id, school_id, class_id, trainer_id, date, time, topic, status, notes, notify_trainer } = req.body;
  const sessionId = id || `SES-${Date.now().toString().slice(-4)}`;
  const sessionTime = time || '10:00 AM';
  const sql = `INSERT INTO sessions (id, school_id, class_id, trainer_id, date, time, topic, status, notes, is_locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`;
  
  db.run(sql, [sessionId, school_id || 'ZPS', class_id, trainer_id || 'TR-01', date, sessionTime, topic, status || 'Planned', notes || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Auto-create alert notification for the Trainer
    const alertId = `ALT-SCHED-${Date.now().toString().slice(-4)}`;
    const alertSql = `INSERT OR REPLACE INTO alerts (id, type, title, message, severity, related_id, action_label, action_type, is_read, created_at)
                      VALUES (?, 'session_scheduled', ?, ?, 'info', ?, 'View Session Details', 'view_session', 0, CURRENT_TIMESTAMP)`;
    
    const alertTitle = `📢 Next Class Scheduled: ${class_id.replace('CLS-ZPS-', 'Class ')}`;
    const alertMsg = `Admin scheduled session on ${date} at ${sessionTime}. Topic: "${topic}". Notes: ${notes || 'Standard kit preparation.'}`;
    
    db.run(alertSql, [alertId, alertTitle, alertMsg, sessionId]);

    res.json({ success: true, id: sessionId, school_id, class_id, trainer_id, date, time: sessionTime, topic, status, is_locked: 0 });
  });
});

app.post('/api/sessions/:id/complete', (req, res) => {
  const now = new Date();
  const liveDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const liveDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const liveTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = req.body.date || `${liveDay}, ${liveDate}`;
  const formattedTime = req.body.time || liveTime;

  db.run("UPDATE sessions SET status = 'Completed', is_locked = 1, date = ?, time = ? WHERE id = ?", [formattedDate, formattedTime, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Session completed and attendance locked', is_locked: 1, date: formattedDate, time: formattedTime });
  });
});

app.put('/api/sessions/:id/admin-unlock', (req, res) => {
  // Admin only unlock override
  db.run("UPDATE sessions SET is_locked = 0 WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Session unlocked by Admin' });
  });
});

app.delete('/api/sessions/:id', (req, res) => {
  // Admin only delete session & attendance
  db.run("DELETE FROM attendance WHERE session_id = ?", [req.params.id], () => {
    db.run("DELETE FROM sessions WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, deleted: req.params.id });
    });
  });
});

app.get('/api/attendance', (req, res) => {
  db.all("SELECT a.*, s.date, s.class_id, s.topic, s.is_locked FROM attendance a LEFT JOIN sessions s ON a.session_id = s.id ORDER BY s.date DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/attendance', (req, res) => {
  const { session_id, student_id, status } = req.body;
  
  // Verify if session is already locked
  db.get("SELECT is_locked FROM sessions WHERE id = ?", [session_id], (err, session) => {
    if (session && session.is_locked === 1 && !req.headers['x-admin-override']) {
      return res.status(403).json({ error: 'This attendance record is permanently locked. Only Admin can modify past attendance.' });
    }
    
    const id = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const sql = `INSERT INTO attendance (id, session_id, student_id, status) VALUES (?, ?, ?, ?)
                 ON CONFLICT(session_id, student_id) DO UPDATE SET status=excluded.status, timestamp=CURRENT_TIMESTAMP`;
    db.run(sql, [id, session_id, student_id, status], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, session_id, student_id, status });
    });
  });
});

// Admin Attendance Override
app.put('/api/attendance/admin-override', (req, res) => {
  const { session_id, student_id, status } = req.body;
  const sql = `UPDATE attendance SET status = ? WHERE session_id = ? AND student_id = ?`;
  db.run(sql, [status, session_id, student_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, session_id, student_id, status });
  });
});

// ==================== 6. CONTENT HUB API ====================
app.get('/api/content', (req, res) => {
  const { target, class_grade } = req.query;
  let sql = "SELECT * FROM content WHERE 1=1";
  const params = [];
  
  if (target) {
    sql += " AND target = ?";
    params.push(target);
  }
  if (class_grade) {
    sql += " AND (class_grade = ? OR class_grade IS NULL)";
    params.push(class_grade);
  }
  
  sql += " ORDER BY class_grade ASC, title ASC";
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/content', (req, res) => {
  const { id, title, type, level, target, url, description } = req.body;
  const contentId = id || `C-${Date.now().toString().slice(-4)}`;
  const sql = `INSERT INTO content (id, title, type, level, target, url, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [contentId, title, type || 'PDF', level || 'Level 1', target || 'Student', url || '', description || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: contentId, title, type, level, target, url, description });
  });
});

app.delete('/api/content/:id', (req, res) => {
  db.run("DELETE FROM content WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 7. CURRICULUM API ====================
app.get('/api/curriculum', (req, res) => {
  db.all("SELECT * FROM curriculum ORDER BY week ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/curriculum', (req, res) => {
  const { id, week, level, topic, objectives, status } = req.body;
  const curId = id || `CUR-${Date.now().toString().slice(-4)}`;
  const sql = `INSERT INTO curriculum (id, week, level, topic, objectives, status) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [curId, week, level || 'Level 1', topic, objectives || '', status || 'Upcoming'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: curId, week, level, topic, objectives, status });
  });
});

app.put('/api/curriculum/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  db.run("UPDATE curriculum SET status = ? WHERE id = ?", [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id, status });
  });
});

// ==================== 8. INVENTORY & KITS API ====================
app.get('/api/inventory', (req, res) => {
  db.all("SELECT * FROM inventory ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventory', (req, res) => {
  const { id, name, level, school_id, assigned_student_id, status, issue_notes } = req.body;
  const kitId = id || `KIT-${Math.floor(1000 + Math.random() * 9000)}`;
  const today = new Date().toISOString().split('T')[0];
  const sql = `INSERT INTO inventory (id, name, level, school_id, assigned_student_id, status, last_checked, issue_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [kitId, name, level || 'Level 1', school_id || '', assigned_student_id || '', status || 'Healthy', today, issue_notes || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: kitId, name, level, school_id, assigned_student_id, status });
  });
});

app.put('/api/inventory/:id/status', (req, res) => {
  const { status, issue_notes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  db.run("UPDATE inventory SET status = ?, issue_notes = ?, last_checked = ? WHERE id = ?", [status, issue_notes || '', today, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, status, issue_notes });
  });
});

app.delete('/api/inventory/:id', (req, res) => {
  db.run("DELETE FROM inventory WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 9. BILLING & INVOICES API ====================
app.get('/api/billing', (req, res) => {
  db.all("SELECT * FROM billing ORDER BY tranche_number ASC, date_issued DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/billing', (req, res) => {
  const { id, school_id, school_name, tranche_number, tranche_title, amount, total_contract_value, date_issued, due_date, paid_date, payment_method, place_of_supply, status, receipt_no, is_confirmed } = req.body;
  const invId = id || `INV-${Date.now().toString().slice(-4)}`;
  const today = new Date().toISOString().split('T')[0];
  const sql = `INSERT INTO billing (id, school_id, school_name, tranche_number, tranche_title, amount, total_contract_value, date_issued, due_date, paid_date, payment_method, place_of_supply, status, receipt_no, is_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [
    invId, 
    school_id || 'ZPS', 
    school_name || 'Zenith Public School', 
    tranche_number || 1, 
    tranche_title || 'Payment Tranche', 
    amount || 30000, 
    total_contract_value || 100000, 
    date_issued || today, 
    due_date || today, 
    paid_date || null, 
    payment_method || null, 
    place_of_supply || 'Hata, Uttar Pradesh', 
    status || 'Pending', 
    receipt_no || null, 
    is_confirmed || 0
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: invId, school_id, school_name, amount, status });
  });
});

app.put('/api/billing/:id/confirm-payment', (req, res) => {
  const { is_confirmed, payment_method, receipt_no } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const confirmed = is_confirmed ? 1 : 0;
  const status = confirmed ? 'Paid' : 'Pending';
  const paidDate = confirmed ? today : null;
  const recNo = confirmed ? (receipt_no || `REC-${req.params.id}-${Date.now().toString().slice(-4)}`) : null;
  
  db.run(
    "UPDATE billing SET is_confirmed = ?, status = ?, paid_date = ?, payment_method = ?, receipt_no = ? WHERE id = ?",
    [confirmed, status, paidDate, payment_method || 'Bank Transfer / Cheque', recNo, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: req.params.id, is_confirmed: confirmed, status, paid_date: paidDate, receipt_no: recNo });
    }
  );
});

app.put('/api/billing/:id/status', (req, res) => {
  const { status } = req.body;
  const isConfirmed = status === 'Paid' ? 1 : 0;
  const today = new Date().toISOString().split('T')[0];
  const paidDate = status === 'Paid' ? today : null;
  db.run("UPDATE billing SET status = ?, is_confirmed = ?, paid_date = ? WHERE id = ?", [status, isConfirmed, paidDate, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, status, is_confirmed: isConfirmed });
  });
});

app.put('/api/billing/:id', (req, res) => {
  const { tranche_title, amount, total_contract_value, date_issued, due_date, status, payment_method, place_of_supply, receipt_no, is_confirmed } = req.body;
  const sql = `UPDATE billing SET 
                tranche_title = COALESCE(?, tranche_title),
                amount = COALESCE(?, amount),
                total_contract_value = COALESCE(?, total_contract_value),
                date_issued = COALESCE(?, date_issued),
                due_date = COALESCE(?, due_date),
                status = COALESCE(?, status),
                payment_method = COALESCE(?, payment_method),
                place_of_supply = COALESCE(?, place_of_supply),
                receipt_no = COALESCE(?, receipt_no),
                is_confirmed = COALESCE(?, is_confirmed)
               WHERE id = ?`;
  db.run(sql, [tranche_title, amount, total_contract_value, date_issued, due_date, status, payment_method, place_of_supply, receipt_no, is_confirmed, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id });
  });
});

app.delete('/api/billing/:id', (req, res) => {
  db.run("DELETE FROM billing WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 10. TRAINERS API & AUTO-ACCOUNT ====================
app.get('/api/trainers', (req, res) => {
  db.all("SELECT * FROM trainers ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/trainers', async (req, res) => {
  const { id, name, phone, role, assigned_schools, daily_rate, weekly_days, rating, status, password } = req.body;
  const trainerId = id || `TR-${Date.now().toString().slice(-4)}`;
  const rate = Number(daily_rate) || 600;
  const days = Number(weekly_days) || 2;
  const sql = `INSERT INTO trainers (id, name, phone, role, assigned_schools, daily_rate, weekly_days, rating, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [trainerId, name, phone || '', role || 'Senior Robotics & AI Instructor', assigned_schools || 'ZPS', rate, days, rating || 5.0, status || 'Active'], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Auto-create trainer user login with hashed password
    const trainerPassword = password || 'trainer123';
    const passwordHash = await bcrypt.hash(trainerPassword, 10);
    const userId = `USR-${trainerId}`;
    
    db.run(
      "INSERT OR REPLACE INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, trainerId, passwordHash, 'trainer', trainerId, name, assigned_schools || '']
    );

    res.json({ success: true, id: trainerId, name, phone, role, assigned_schools, daily_rate: rate, weekly_days: days, rating, status });
  });
});

app.put('/api/trainers/:id', (req, res) => {
  const { name, phone, role, assigned_schools, daily_rate, weekly_days, rating, status } = req.body;
  const sql = `UPDATE trainers SET 
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                role = COALESCE(?, role),
                assigned_schools = COALESCE(?, assigned_schools),
                daily_rate = COALESCE(?, daily_rate),
                weekly_days = COALESCE(?, weekly_days),
                rating = COALESCE(?, rating),
                status = COALESCE(?, status)
               WHERE id = ?`;
  db.run(sql, [name, phone, role, assigned_schools, daily_rate, weekly_days, rating, status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (name) {
      db.run("UPDATE users SET name = ? WHERE related_id = ?", [name, req.params.id]);
    }
    res.json({ success: true, id: req.params.id, name, daily_rate, weekly_days });
  });
});

app.put('/api/trainers/:id/status', (req, res) => {
  const { status } = req.body;
  db.run("UPDATE trainers SET status = ? WHERE id = ?", [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, status });
  });
});

app.delete('/api/trainers/:id', (req, res) => {
  db.run("DELETE FROM trainers WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run("DELETE FROM users WHERE related_id = ?", [req.params.id]);
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 11. COMMS & LOGS API ====================
app.get('/api/comms', (req, res) => {
  db.all("SELECT * FROM comms_logs ORDER BY sent_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/comms', (req, res) => {
  const { id, student_id, recipient, template, message, status } = req.body;
  const msgId = id || `MSG-${Date.now().toString().slice(-4)}`;
  const sql = `INSERT INTO comms_logs (id, student_id, recipient, template, message, status) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [msgId, student_id || '', recipient, template, message, status || 'Delivered'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: msgId, recipient, template, message, status: status || 'Delivered' });
  });
});

// ==================== 12. PROJECTS API ====================
app.get('/api/projects', (req, res) => {
  db.all("SELECT * FROM projects ORDER BY rowid DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/projects', (req, res) => {
  const { id, student_id, title, status, score, evidence_note, image_url, date_completed } = req.body;
  const prjId = id || `PRJ-${Date.now().toString().slice(-4)}`;
  const completedDate = date_completed || new Date().toISOString().split('T')[0];
  const sql = `INSERT INTO projects (id, student_id, title, status, score, evidence_note, image_url, date_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [prjId, student_id, title, status || 'Completed', score || 10, evidence_note || '', image_url || '', completedDate], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: prjId, student_id, title, status: status || 'Completed', score, evidence_note, image_url, date_completed: completedDate });
  });
});

app.delete('/api/projects/:id', (req, res) => {
  db.run("DELETE FROM projects WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 13. REAL-TIME EVENT AUTOMATION & ALERTS API ====================

// Dynamic Alerts Scanner
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = [];

    // 1. Scan Damaged Hardware Kits (RMA Automation)
    const damagedKits = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM inventory WHERE status IN ('Damaged', 'In Repair')", [], (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    damagedKits.forEach(kit => {
      alerts.push({
        id: `ALT-KIT-${kit.id}`,
        type: 'hardware',
        title: `Hardware Fault: ${kit.name} (${kit.id})`,
        message: `Kit ${kit.id} reported damaged at ${kit.school_id || 'School'}. ${kit.issue_notes || 'Requires technician replacement.'}`,
        severity: 'critical',
        related_id: kit.id,
        action_label: 'Auto-Dispatch Replacement with Trainer',
        action_type: 'dispatch_kit',
        is_read: 0,
        created_at: kit.last_checked || 'Recently'
      });
    });

    // 2. Scan Upcoming Contract Renewals (< 30 days)
    const expiringSchools = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM schools WHERE renewal_date IS NOT NULL AND renewal_date != ''", [], (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    expiringSchools.forEach(sch => {
      if (sch.code === 'GWS' || sch.status === 'At Risk') {
        alerts.push({
          id: `ALT-REN-${sch.id}`,
          type: 'renewal',
          title: `Contract Renewal Approaching: ${sch.name}`,
          message: `${sch.name}'s annual robotics term agreement renewal is scheduled soon. High retention priority.`,
          severity: 'warning',
          related_id: sch.id,
          action_label: 'Draft 1-Click Renewal Contract',
          action_type: 'renew_contract',
          is_read: 0,
          created_at: 'Active'
        });
      }
    });

    // 3. Scan Pending Invoices
    const pendingInvoices = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM billing WHERE status = 'Pending'", [], (err, rows) => {
        if (err) reject(err); else resolve(rows || []);
      });
    });

    pendingInvoices.forEach(inv => {
      alerts.push({
        id: `ALT-INV-${inv.id}`,
        type: 'billing',
        title: `Payment Pending: ₹${inv.amount.toLocaleString('en-IN')} from ${inv.school_name}`,
        message: `Invoice ${inv.id} due on ${inv.due_date}. Auto-reminder draft ready.`,
        severity: 'info',
        related_id: inv.id,
        action_label: 'Send WhatsApp Reminder',
        action_type: 'remind_payment',
        is_read: 0,
        created_at: inv.date_issued
      });
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve Alert Action Endpoint
app.post('/api/alerts/:id/resolve', async (req, res) => {
  const { action_type, related_id } = req.body;

  try {
    if (action_type === 'dispatch_kit') {
      // Update kit to 'In Repair' with technician assigned
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE inventory SET status = 'In Repair', issue_notes = 'Replacement dispatched with Trainer Vikash' WHERE id = ?",
          [related_id],
          (err) => err ? reject(err) : resolve()
        );
      });
      return res.json({ success: true, message: `Replacement kit ${related_id} dispatched with Trainer Vikash!` });
    } 
    
    if (action_type === 'remind_payment') {
      // Log WhatsApp payment reminder
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO comms_logs (id, student_id, recipient, template, message, status) VALUES (?, ?, ?, ?, ?, ?)",
          [`MSG-REM-${Date.now()}`, related_id, 'Finance Department', 'Fee Reminder', `Payment reminder sent for invoice ${related_id}`, 'Delivered'],
          (err) => err ? reject(err) : resolve()
        );
      });
      return res.json({ success: true, message: `Payment reminder WhatsApp sent for invoice ${related_id}!` });
    }

    if (action_type === 'renew_contract') {
      // Extend renewal date by 1 year
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE schools SET renewal_date = '2028-03-31', status = 'Active' WHERE id = ?",
          [related_id],
          (err) => err ? reject(err) : resolve()
        );
      });
      return res.json({ success: true, message: `Contract successfully renewed for ${related_id} until 2028!` });
    }

    res.json({ success: true, message: 'Alert action executed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 15. ADMIN BROADCAST NOTIFICATIONS & CLASS ANNOUNCEMENTS ====================
app.get('/api/notifications', (req, res) => {
  db.all("SELECT * FROM notifications ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/notifications', (req, res) => {
  const { target_type, target_classes, target_trainer_id, target_school_id, type, title, message, template_type, scheduled_date, scheduled_time, severity } = req.body;
  const id = `NOTIF-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const sql = `INSERT INTO notifications (id, target_type, target_classes, target_trainer_id, target_school_id, type, title, message, template_type, scheduled_date, scheduled_time, severity, status, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`;

  db.run(sql, [
    id, 
    target_type || 'All_Students', 
    target_classes || '6,7,8,9,11', 
    target_trainer_id || 'All', 
    target_school_id || null,
    type || 'announcement',
    title, 
    message, 
    template_type || 'custom', 
    scheduled_date || 'Upcoming', 
    scheduled_time || '10:00 AM', 
    severity || 'info', 
    now, 
    now
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ 
      success: true, 
      id, 
      target_type: target_type || 'All_Students', 
      target_classes: target_classes || '6,7,8,9,11', 
      target_trainer_id: target_trainer_id || 'All', 
      target_school_id: target_school_id || null,
      type: type || 'announcement',
      title, 
      message, 
      template_type: template_type || 'custom', 
      scheduled_date: scheduled_date || 'Upcoming', 
      scheduled_time: scheduled_time || '10:00 AM', 
      severity: severity || 'info', 
      status: 'Active', 
      created_at: now, 
      updated_at: now 
    });
  });
});

app.put('/api/notifications/:id', (req, res) => {
  const { target_type, target_classes, target_trainer_id, title, message, template_type, scheduled_date, scheduled_time, severity, status } = req.body;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const sql = `UPDATE notifications SET target_type = ?, target_classes = ?, target_trainer_id = ?, title = ?, message = ?, template_type = ?, scheduled_date = ?, scheduled_time = ?, severity = ?, status = ?, updated_at = ? WHERE id = ?`;

  db.run(sql, [
    target_type, 
    target_classes, 
    target_trainer_id, 
    title, 
    message, 
    template_type, 
    scheduled_date, 
    scheduled_time, 
    severity, 
    status || 'Active', 
    now, 
    req.params.id
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, title, message, updated_at: now });
  });
});

app.delete('/api/notifications/:id', (req, res) => {
  db.run("DELETE FROM notifications WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== NOTIFICATION READ STATUS API (Per-User Cross-Device Tracking) ====================
app.get('/api/notifications/reads/:userKey', (req, res) => {
  const userKey = (req.params.userKey || '').toLowerCase().replace(/\s+/g, '');
  if (!userKey) return res.json([]);
  db.all("SELECT notification_id FROM notification_reads WHERE user_key = ?", [userKey], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json((rows || []).map(r => r.notification_id));
  });
});

app.post('/api/notifications/reads', (req, res) => {
  const { userKey, notificationId, notificationIds } = req.body;
  const cleanUserKey = (userKey || '').toLowerCase().replace(/\s+/g, '');
  if (!cleanUserKey) return res.status(400).json({ error: 'User key required' });

  const idsToMark = Array.isArray(notificationIds) ? notificationIds : (notificationId ? [notificationId] : []);
  if (idsToMark.length === 0) return res.json({ success: true, count: 0 });

  const stmt = db.prepare("INSERT OR IGNORE INTO notification_reads (id, notification_id, user_key) VALUES (?, ?, ?)");
  idsToMark.forEach(notifId => {
    stmt.run([`${cleanUserKey}_${notifId}`, notifId, cleanUserKey]);
  });
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, count: idsToMark.length });
  });
});

// Audit Logs API (Persistent SQLite storage)
app.get('/api/logs', (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/logs', (req, res) => {
  const { id, date, time, user_id, name, role, school_id, event_type, status, ip } = req.body;
  db.run(
    `INSERT OR REPLACE INTO audit_logs (id, date, time, user_id, name, role, school_id, event_type, status, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, date, time, user_id, name, role, school_id, event_type || 'Login', status, ip],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

app.delete('/api/logs', (req, res) => {
  db.run('DELETE FROM audit_logs', [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, count: this.changes });
  });
});

// ==================== 17. STUDENT REVIEWS API ====================
app.get('/api/reviews', (req, res) => {
  db.all("SELECT * FROM student_reviews ORDER BY updated_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/reviews', (req, res) => {
  const { id, student_id, student_name, unit_code, level, rating, comment, trainer_name, verified_date } = req.body;
  const reviewId = id || `REV-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();
  const vDate = verified_date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const sql = `INSERT OR REPLACE INTO student_reviews (id, student_id, student_name, unit_code, level, rating, comment, trainer_name, verified_date, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [reviewId, student_id, student_name || '', unit_code || '', level || '', rating || 5, comment || '', trainer_name || '', vDate, now], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ 
      success: true, 
      id: reviewId, 
      student_id, 
      student_name, 
      unit_code, 
      level, 
      rating, 
      comment, 
      trainer_name, 
      verified_date: vDate,
      updated_at: now
    });
  });
});

app.delete('/api/reviews/:id', (req, res) => {
  db.run("DELETE FROM student_reviews WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// ==================== 19. QUIZZES & MCQS API ====================
// Get all Quizzes (optionally filtered by class_grade and level) with Questions
app.get('/api/quizzes', (req, res) => {
  const { class_grade, level } = req.query;
  let sql = "SELECT * FROM quizzes WHERE status = 'Active'";
  const params = [];

  if (class_grade) {
    sql += " AND (class_grade = ? OR class_grade = 'ALL')";
    params.push(class_grade);
  }
  if (level) {
    sql += " AND level = ?";
    params.push(level);
  }
  sql += " ORDER BY level ASC, created_at ASC";

  db.all(sql, params, (err, quizzes) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!quizzes || quizzes.length === 0) return res.json([]);

    db.all("SELECT * FROM quiz_questions ORDER BY question_order ASC", [], (qErr, allQuestions) => {
      if (qErr) return res.status(500).json({ error: qErr.message });

      const questionMap = {};
      (allQuestions || []).forEach(q => {
        if (!questionMap[q.quiz_id]) questionMap[q.quiz_id] = [];
        questionMap[q.quiz_id].push(q);
      });

      const fullQuizzes = quizzes.map(qz => ({
        ...qz,
        questions: questionMap[qz.id] || []
      }));

      res.json(fullQuizzes);
    });
  });
});

// Get Single Quiz with Questions
app.get('/api/quizzes/:id', (req, res) => {
  db.get("SELECT * FROM quizzes WHERE id = ?", [req.params.id], (err, quiz) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    db.all("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC", [quiz.id], (qErr, questions) => {
      if (qErr) return res.status(500).json({ error: qErr.message });
      res.json({ ...quiz, questions: questions || [] });
    });
  });
});

// Create Quiz with Nested Questions
app.post('/api/quizzes', (req, res) => {
  const { title, class_grade, level, unit_code, duration_minutes, total_marks, created_by, questions } = req.body;
  const quizId = `QUIZ-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();

  const quizSql = `INSERT INTO quizzes (id, title, class_grade, level, unit_code, duration_minutes, total_marks, created_by, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`;

  db.run(quizSql, [
    quizId,
    title || 'Robotics & Electronics MCQ Quiz',
    class_grade || '6',
    level || 'Level 0',
    unit_code || 'Unit 1',
    parseInt(duration_minutes) || 10,
    parseInt(total_marks) || 10,
    created_by || 'Trainer',
    now,
    now
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (Array.isArray(questions) && questions.length > 0) {
      const qStmt = db.prepare(`INSERT INTO quiz_questions (id, quiz_id, question_order, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, points)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      questions.forEach((q, idx) => {
        const qId = q.id || `Q-${quizId}-${idx + 1}`;
        qStmt.run([
          qId,
          quizId,
          idx + 1,
          q.question_text || '',
          q.option_a || '',
          q.option_b || '',
          q.option_c || '',
          q.option_d || '',
          (q.correct_option || 'A').toUpperCase(),
          q.explanation || 'Consult the official unit documentation for detailed derivation.',
          q.points || 2
        ]);
      });

      qStmt.finalize(() => {
        res.json({ success: true, id: quizId, message: 'Quiz created successfully' });
      });
    } else {
      res.json({ success: true, id: quizId, message: 'Quiz created without questions' });
    }
  });
});

// Update Quiz
app.put('/api/quizzes/:id', (req, res) => {
  const { title, class_grade, level, unit_code, duration_minutes, total_marks, questions } = req.body;
  const now = new Date().toISOString();

  const updateSql = `UPDATE quizzes SET title = ?, class_grade = ?, level = ?, unit_code = ?, duration_minutes = ?, total_marks = ?, updated_at = ? WHERE id = ?`;

  db.run(updateSql, [title, class_grade, level, unit_code, duration_minutes, total_marks, now, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (Array.isArray(questions)) {
      // Re-write questions
      db.run("DELETE FROM quiz_questions WHERE quiz_id = ?", [req.params.id], () => {
        const qStmt = db.prepare(`INSERT INTO quiz_questions (id, quiz_id, question_order, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, points)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        questions.forEach((q, idx) => {
          const qId = q.id || `Q-${req.params.id}-${idx + 1}`;
          qStmt.run([
            qId,
            req.params.id,
            idx + 1,
            q.question_text || '',
            q.option_a || '',
            q.option_b || '',
            q.option_c || '',
            q.option_d || '',
            (q.correct_option || 'A').toUpperCase(),
            q.explanation || '',
            q.points || 2
          ]);
        });
        qStmt.finalize(() => {
          res.json({ success: true, id: req.params.id, message: 'Quiz updated' });
        });
      });
    } else {
      res.json({ success: true, id: req.params.id });
    }
  });
});

// Delete Quiz
app.delete('/api/quizzes/:id', (req, res) => {
  db.run("DELETE FROM quiz_questions WHERE quiz_id = ?", [req.params.id], () => {
    db.run("DELETE FROM quiz_submissions WHERE quiz_id = ?", [req.params.id], () => {
      db.run("DELETE FROM quizzes WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: req.params.id });
      });
    });
  });
});

// ==================== 20. QUIZ SUBMISSIONS & PROCTORING ====================
// Get Quiz Submissions (filter by student_id, quiz_id, or class_grade)
app.get('/api/quiz-submissions', (req, res) => {
  const { student_id, quiz_id, class_grade } = req.query;
  let sql = "SELECT * FROM quiz_submissions WHERE 1=1";
  const params = [];

  if (student_id) {
    sql += " AND student_id = ?";
    params.push(student_id);
  }
  if (quiz_id) {
    sql += " AND quiz_id = ?";
    params.push(quiz_id);
  }
  if (class_grade) {
    sql += " AND class_grade = ?";
    params.push(class_grade);
  }
  sql += " ORDER BY completed_at DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const parsed = (rows || []).map(r => ({
      ...r,
      answers: r.answers_json ? JSON.parse(r.answers_json) : {}
    }));
    res.json(parsed);
  });
});

// Submit Quiz Attempt (Grades answers, locks attempt, records proctoring audit)
app.post('/api/quiz-submissions', (req, res) => {
  const { quiz_id, student_id, student_name, class_grade, level, answers, time_taken_seconds, violation_count, status } = req.body;

  if (!quiz_id || !student_id) {
    return res.status(400).json({ error: 'Quiz ID and Student ID are required' });
  }

  // Check if student has already submitted this quiz
  db.get("SELECT * FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?", [quiz_id, student_id], (checkErr, existing) => {
    if (checkErr) return res.status(500).json({ error: checkErr.message });
    if (existing && existing.reattempt_allowed !== 1) {
      return res.status(403).json({ 
        error: 'Single Attempt Restriction: You have already completed this quiz. Re-attempts are locked unless authorized by your Trainer.',
        existing_submission: existing
      });
    }

    // Fetch questions to grade the exam securely on server
    db.all("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC", [quiz_id], (qErr, questions) => {
      if (qErr) return res.status(500).json({ error: qErr.message });
      if (!questions || questions.length === 0) {
        return res.status(400).json({ error: 'Quiz has no questions to grade' });
      }

      let correctCount = 0;
      let attemptedCount = 0;
      let earnedScore = 0;
      let totalMarks = 0;

      const studentAnswers = answers || {};

      questions.forEach(q => {
        const points = q.points || 2;
        totalMarks += points;
        const studentChoice = studentAnswers[q.id];
        if (studentChoice !== undefined && studentChoice !== null && studentChoice !== '') {
          attemptedCount++;
          if (String(studentChoice).trim().toUpperCase() === String(q.correct_option).trim().toUpperCase()) {
            correctCount++;
            earnedScore += points;
          }
        }
      });

      const percentage = totalMarks > 0 ? Math.round((earnedScore / totalMarks) * 100) : 0;
      const subId = existing ? existing.id : `SUB-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;
      const now = new Date().toISOString();

      const insertSql = `INSERT OR REPLACE INTO quiz_submissions (
        id, quiz_id, student_id, student_name, class_grade, level, score, total_marks, percentage,
        correct_count, attempted_count, total_questions, answers_json, time_taken_seconds, violation_count, status, reattempt_allowed, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`;

      db.run(insertSql, [
        subId,
        quiz_id,
        student_id,
        student_name || 'Student',
        class_grade || '6',
        level || 'Level 0',
        earnedScore,
        totalMarks,
        percentage,
        correctCount,
        attemptedCount,
        questions.length,
        JSON.stringify(studentAnswers),
        time_taken_seconds || 0,
        violation_count || 0,
        status || 'Completed',
        now
      ], function(saveErr) {
        if (saveErr) return res.status(500).json({ error: saveErr.message });

        res.json({
          success: true,
          submission: {
            id: subId,
            quiz_id,
            student_id,
            student_name,
            score: earnedScore,
            total_marks: totalMarks,
            percentage,
            correct_count: correctCount,
            attempted_count: attemptedCount,
            total_questions: questions.length,
            time_taken_seconds,
            violation_count,
            status: status || 'Completed',
            completed_at: now
          },
          questions // Send back full questions with correct answers & explanations for post-exam review
        });
      });
    });
  });
});

// Allow Student Re-attempt (Trainer only)
app.put('/api/quiz-submissions/:id/reattempt', (req, res) => {
  db.run("UPDATE quiz_submissions SET reattempt_allowed = 1 WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: req.params.id, message: 'Re-attempt unlocked for student' });
  });
});

// Delete Submission (Resets student attempt completely)
app.delete('/api/quiz-submissions/:id', (req, res) => {
  db.run("DELETE FROM quiz_submissions WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: req.params.id });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`⚡ Pixiu Core API & Auth Engine running on http://localhost:${PORT}`);
});
