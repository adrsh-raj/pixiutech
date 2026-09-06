const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

const ALLOWED_ORIGINS = new Set([
  'https://pixiutech.com',
  'https://www.pixiutech.com',
  'https://portal.pixiutech.com'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

const uploadsBase = '/opt/render/project/src/data/uploads';
const uploadsDir = uploadsBase;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Pixiu LMS API', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Pixiu Tech Backend API is running', docs: '/api/health' });
});

// Require a valid production JWT for all authenticated application APIs.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// File Upload Endpoint requires authentication.
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  });
});

const loginAttempts = new Map();

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Student ID and password are required' });
  }

  const cleanUsername = username.trim();
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const trackerKey = `${clientIp}:${cleanUsername}`;
  const currentAttempts = loginAttempts.get(trackerKey) || { count: 0, lastAttempt: Date.now() };

  if (currentAttempts.count >= 10 && (Date.now() - currentAttempts.lastAttempt < 300000)) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please wait 5 minutes before trying again.' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [cleanUsername], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Authentication service error' });
    if (!user) return res.status(401).json({ error: 'Invalid ID / Username or Password' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const next = currentAttempts.count + 1;
      loginAttempts.set(trackerKey, { count: next, lastAttempt: Date.now() });
      return res.status(401).json({ error: 'Invalid ID / Username or Password' });
    }

    loginAttempts.delete(trackerKey);

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

    return res.json({
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

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  return res.json({ success: true });
});

// The remaining /api routes are defined below. Authenticated route groups are
// wrapped explicitly near their section so read/write operations are server-authorized.
