const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendTrainerWelcomeEmail } = require('../utils/mailer');

function generateTempPassword() {
  // e.g. "K7F2-QX9M" - easy to read/type off an email, still high entropy
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
  return `${part()}-${part()}`;
}

/** Admin registers a trainer. If `password` is given, that's set directly
 * (so you don't depend on email delivery working) - otherwise a random
 * temp password is generated and emailed, same as before. */
async function createTrainer(req, res, next) {
  try {
    const { email, fullName, password } = req.body;
    if (!email || !fullName) return res.status(400).json({ error: 'email and fullName are required' });
    if (password && password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { rows: existing } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = existing[0];

    const finalPassword = password || generateTempPassword();
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    if (existingUser) {
      // Same reasoning as re-registering a removed trainee: deactivating a
      // trainer just hides them from the roster and blocks login, so
      // "delete" is reversible by re-registering the same email.
      if (existingUser.role !== 'trainer' || existingUser.is_active) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }

      const { rows: reactivated } = await db.query(
        `UPDATE users SET is_active = true, password_hash = $2, full_name = $3
         WHERE id = $1 RETURNING id, email, full_name, role, created_at`,
        [existingUser.id, passwordHash, fullName]
      );

      const delivered = password ? false : await sendTrainerWelcomeEmail(email, fullName, finalPassword);
      return res.status(200).json({
        trainer: reactivated[0],
        // Only hand the plaintext password back in the response when the
        // admin chose to set it themselves - it's already theirs to know.
        // The auto-generated case never returns it over the API; it only
        // ever goes out by email (or the server log as a last resort).
        password: password ? finalPassword : undefined,
        message: password
          ? 'Trainer re-registered with the password you set'
          : delivered
            ? 'Trainer re-registered and credentials emailed'
            : 'Trainer re-registered (email delivery not configured)',
      });
    }

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_verified)
       VALUES ($1, $2, $3, 'trainer', true) RETURNING id, email, full_name, role, created_at`,
      [email, passwordHash, fullName]
    );

    const delivered = password ? false : await sendTrainerWelcomeEmail(email, fullName, finalPassword);

    res.status(201).json({
      trainer: rows[0],
      password: password ? finalPassword : undefined,
      message: password
        ? 'Trainer created with the password you set'
        : delivered
          ? 'Trainer created and credentials emailed'
          : 'Trainer created (email delivery not configured on this server - temp password logged server-side)',
    });
  } catch (err) {
    next(err);
  }
}

/** Admin resets a trainer's password directly (no need for the old one) */
async function resetTrainerPassword(req, res, next) {
  try {
    const { trainerId } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1 AND role = 'trainer' RETURNING id`,
      [trainerId, passwordHash]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Trainer not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** Active trainers, with a rollup of how many trainees each has registered */
async function listTrainers(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.email, t.full_name, t.created_at,
              count(tr.id)::int AS trainee_count
       FROM users t
       LEFT JOIN users tr ON tr.trainer_id = t.id AND tr.role = 'trainee' AND tr.is_active = true
       WHERE t.role = 'trainer' AND t.is_active = true
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    res.json({ trainers: rows });
  } catch (err) {
    next(err);
  }
}

/** "Delete" a trainer: deactivates rather than hard-deletes. Their
 * trainees' trainer_id is left pointing at them (not wiped) so re-
 * registering the same email restores the whole relationship; a hard
 * delete would SET NULL every one of those trainees' trainer_id instead. */
async function deactivateTrainer(req, res, next) {
  try {
    const { trainerId } = req.params;
    const { rows } = await db.query(
      `UPDATE users SET is_active = false WHERE id = $1 AND role = 'trainer' RETURNING id`,
      [trainerId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Trainer not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * Admin registers a physical manikin. Generates a device_uid + a plaintext
 * API key that is shown exactly once (only the bcrypt hash is stored) -
 * these two values get flashed into the ESP32 firmware so it can
 * authenticate itself. Optionally assigned to a trainer right away -
 * unassigned devices are visible to every trainee, assigned ones only to
 * that trainer's own trainees.
 */
async function createDevice(req, res, next) {
  try {
    const { label, assignedTrainerId } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });

    if (assignedTrainerId) {
      const { rows: trainerCheck } = await db.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'trainer' AND is_active = true`,
        [assignedTrainerId]
      );
      if (trainerCheck.length === 0) return res.status(400).json({ error: 'assignedTrainerId is not an active trainer' });
    }

    const deviceUid = `SMART-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const apiKey = crypto.randomBytes(24).toString('base64url');
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    const { rows } = await db.query(
      `INSERT INTO devices (device_uid, label, api_key_hash, assigned_trainer_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, device_uid, label, created_at`,
      [deviceUid, label, apiKeyHash, assignedTrainerId || null]
    );

    res.status(201).json({
      device: rows[0],
      apiKey, // shown once only - not retrievable again after this response
      message: 'Save this API key now - it cannot be shown again. Flash both deviceUid and apiKey into the firmware.',
    });
  } catch (err) {
    next(err);
  }
}

/** Active manikins, with which trainer (if any) they're assigned to */
async function listDevices(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.device_uid, d.label, d.last_seen_at, d.is_active, d.created_at,
              d.assigned_trainer_id, t.full_name AS assigned_trainer_name
       FROM devices d
       LEFT JOIN users t ON t.id = d.assigned_trainer_id
       WHERE d.is_active = true
       ORDER BY d.created_at DESC`
    );
    res.json({ devices: rows });
  } catch (err) {
    next(err);
  }
}

/** Assign (or unassign, with trainerId: null) a manikin to a trainer */
async function assignDevice(req, res, next) {
  try {
    const { deviceId } = req.params;
    const { trainerId } = req.body;

    if (trainerId) {
      const { rows: trainerCheck } = await db.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'trainer' AND is_active = true`,
        [trainerId]
      );
      if (trainerCheck.length === 0) return res.status(400).json({ error: 'trainerId is not an active trainer' });
    }

    const { rows } = await db.query(
      `UPDATE devices SET assigned_trainer_id = $2 WHERE id = $1 RETURNING id`,
      [deviceId, trainerId || null]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** "Delete" a manikin: deactivates rather than hard-deletes, since past
 * sessions reference device_id (ON DELETE SET NULL) and a real delete
 * would strip that link from historical training records. */
async function deactivateDevice(req, res, next) {
  try {
    const { deviceId } = req.params;
    const { rows } = await db.query(`UPDATE devices SET is_active = false WHERE id = $1 RETURNING id`, [deviceId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Device not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTrainer,
  listTrainers,
  deactivateTrainer,
  resetTrainerPassword,
  createDevice,
  listDevices,
  assignDevice,
  deactivateDevice,
};
