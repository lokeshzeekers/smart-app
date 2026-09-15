require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// One-time bootstrap: there's no in-app way to create the very first admin
// (admin accounts can only be created by an existing admin), so this
// script exists to seed that first one directly.
//
// Usage:
//   node scripts/create-admin.js "you@example.com" "Your Name" "a-strong-password"
//
// Safe to re-run: if the email already exists, it updates that user's
// role to admin and resets the password to the one you pass, rather than
// creating a duplicate.

(async () => {
  const [, , email, fullName, password] = process.argv;

  if (!email || !fullName || !password) {
    console.error('Usage: node scripts/create-admin.js "<email>" "<full name>" "<password>"');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE users SET role = 'admin', password_hash = $2, full_name = $3, is_verified = true, is_active = true
         WHERE email = $1`,
        [email, passwordHash, fullName]
      );
      console.log(`Existing user ${email} updated to admin.`);
    } else {
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_verified)
         VALUES ($1, $2, $3, 'admin', true)`,
        [email, passwordHash, fullName]
      );
      console.log(`Admin account created: ${email}`);
    }

    console.log('Sign in at /trainer/login with this email and password.');
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
