const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

/**
 * Optional first-access bootstrap for a fresh/reset PostgreSQL database.
 * It never uses a hardcoded password. Set ADMIN_BOOTSTRAP_PASSWORD in the
 * server environment to create/update the designated admin account.
 *
 * Existing malformed rows are repaired so a username collision cannot prevent
 * the API from starting. Set ADMIN_BOOTSTRAP_FORCE=true only when intentionally
 * recovering access to an existing admin account; remove/disable it afterwards.
 */
async function bootstrapAdmin() {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!password) return;

  if (password.length < 12) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
  }

  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || 'adarshraj').trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME must be 3-64 characters using letters, numbers, dot, underscore or hyphen.');
  }

  // db.get() without a callback resolves to the PostgreSQL QueryResult, so
  // explicitly read the first row here.
  const existingResult = await db.get('SELECT id, role, name FROM users WHERE username = ?', [username]);
  const existing = existingResult?.rows?.[0] || null;
  const force = String(process.env.ADMIN_BOOTSTRAP_FORCE || '').toLowerCase() === 'true';
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = existing?.id || `USR-${crypto.createHash('sha256').update(username).digest('hex').slice(0, 16)}`;

  if (existing) {
    const existingRole = String(existing.role || '').trim().toLowerCase();
    if (!['admin', 'superadmin'].includes(existingRole) || force) {
      const result = await db.run(
        'UPDATE users SET password_hash = ?, role = ?, name = ?, related_id = NULL, school_id = NULL WHERE id = ?',
        [passwordHash, 'admin', 'PIXIU Tech Administrator', userId]
      );
      if (result?.rowCount !== 1) {
        throw new Error(`Admin bootstrap could not update existing account "${username}".`);
      }
      console.warn(`Admin bootstrap repaired account "${username}"${force ? ' and reset its password' : ''}.`);
      return;
    }

    if (force) {
      const result = await db.run(
        'UPDATE users SET password_hash = ?, role = ?, name = ?, related_id = NULL, school_id = NULL WHERE id = ?',
        [passwordHash, 'admin', 'PIXIU Tech Administrator', userId]
      );
      if (result?.rowCount !== 1) {
        throw new Error(`Admin bootstrap could not reset account "${username}".`);
      }
      console.warn(`Admin bootstrap repaired account "${username}" and reset its password.`);
      return;
    }

    console.log(`Admin bootstrap skipped; account "${username}" already exists.`);
    return;
  }

  const result = await db.run(
    'INSERT INTO users (id, username, password_hash, role, related_id, name, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, username, passwordHash, 'admin', null, 'PIXIU Tech Administrator', null]
  );
  if (result?.rowCount !== 1) {
    throw new Error(`Admin bootstrap could not create account "${username}".`);
  }
  console.log(`Admin bootstrap account "${username}" created.`);
}

module.exports = { bootstrapAdmin };
