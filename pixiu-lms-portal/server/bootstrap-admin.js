const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

/**
 * Optional first-access bootstrap for a fresh/reset PostgreSQL database.
 * It never uses a hardcoded password. Set ADMIN_BOOTSTRAP_PASSWORD in the
 * server environment to create/update the designated admin account.
 *
 * Set ADMIN_BOOTSTRAP_FORCE=true only when intentionally recovering access to
 * an existing admin account. Remove/disable FORCE afterwards.
 */
async function bootstrapAdmin() {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!password) return;

  if (password.length < 12) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
  }

  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin').trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME must be 3-64 characters using letters, numbers, dot, underscore or hyphen.');
  }

  const existing = await db.get('SELECT id, role FROM users WHERE username = ?', [username]);
  const force = String(process.env.ADMIN_BOOTSTRAP_FORCE || '').toLowerCase() === 'true';

  if (existing && !force) {
    if (!['admin', 'superadmin'].includes(existing.role)) {
      throw new Error(`Bootstrap username "${username}" already belongs to role "${existing.role}".`);
    }
    console.log(`Admin bootstrap skipped; account "${username}" already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = existing?.id || `USR-${crypto.createHash('sha256').update(username).digest('hex').slice(0, 16)}`;

  if (existing) {
    await db.run(
      'UPDATE users SET password_hash = ?, role = ?, name = ? WHERE id = ?',
      [passwordHash, 'admin', 'PIXIU Tech Administrator', userId]
    );
    console.warn(`Admin bootstrap password reset for "${username}" because ADMIN_BOOTSTRAP_FORCE=true.`);
  } else {
    await db.run(
      'INSERT INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, username, passwordHash, 'admin', null, 'PIXIU Tech Administrator', null]
    );
    console.log(`Admin bootstrap account "${username}" created.`);
  }
}

module.exports = { bootstrapAdmin };
