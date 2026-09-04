const bcrypt = require('bcryptjs');
const db = require('../config/db');

// ESP32 devices authenticate with a long-lived API key sent as a header,
// NOT a user JWT. This keeps manikin firmware simple (no login flow on-device).
async function requireDeviceAuth(req, res, next) {
  const deviceUid = req.headers['x-device-id'];
  const apiKey = req.headers['x-device-key'];

  if (!deviceUid || !apiKey) {
    return res.status(401).json({ error: 'Missing device credentials' });
  }

  try {
    const { rows } = await db.query(
      `SELECT id, api_key_hash, institution_id, is_active
       FROM devices WHERE device_uid = $1`,
      [deviceUid]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'Unknown or inactive device' });
    }

    const match = await bcrypt.compare(apiKey, rows[0].api_key_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid device key' });
    }

    req.device = { id: rows[0].id, institutionId: rows[0].institution_id };

    // fire-and-forget last_seen update
    db.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [rows[0].id]).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireDeviceAuth };
