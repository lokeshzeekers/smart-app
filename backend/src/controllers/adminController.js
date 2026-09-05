const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendTrainerWelcomeEmail } = require('../utils/mailer');

function generateTempPassword() {
  // e.g. "K7F2-QX9M" - easy to read/type off an email, still high entropy
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${part()}-${part()}`;
}

/** Admin registers a trainer (trainer then signs in with email + this password) */
async function createTrainer(req, res, next) {
  try {
    const { email, fullName } = req.body;
    if (!email || !fullName) return res.status(400).json({ error: 'email and fullName are required' });

    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'A user with this email already exists' });

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_verified)
       VALUES ($1, $2, $3, 'trainer', true) RETURNING id, email, full_name, role, created_at`,
      [email, passwordHash, fullName]
    );

    const delivered = await sendTrainerWelcomeEmail(email, fullName, tempPassword);

    res.status(201).json({
      trainer: rows[0],
      message: delivered
        ? 'Trainer created and credentials emailed'
        : 'Trainer created (email delivery not configured on this server - temp password logged server-side)',
    });
  } catch (err) {
    next(err);
  }
}

/** List all trainers with a rollup of how many trainees each has registered */
async function listTrainers(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.email, t.full_name, t.created_at,
              count(tr.id)::int AS trainee_count
       FROM users t
       LEFT JOIN users tr ON tr.trainer_id = t.id AND tr.role = 'trainee'
       WHERE t.role = 'trainer'
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    res.json({ trainers: rows });
  } catch (err) {
    next(err);
  }
}

async function deactivateTrainer(req, res, next) {
  try {
    const { trainerId } = req.params;
    await db.query(`UPDATE users SET is_active = false WHERE id = $1 AND role = 'trainer'`, [trainerId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { createTrainer, listTrainers, deactivateTrainer };
