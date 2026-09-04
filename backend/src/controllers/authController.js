const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sendOtpEmail } = require('../utils/mailer');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, institutionId: user.institution_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

/**
 * STEP 1 of trainee login: email entry -> issue OTP.
 * Dispatches via SMTP (see backend/.env.example). If SMTP_* isn't
 * configured, falls back to logging the code server-side so the flow
 * stays testable in local dev without a mail provider.
 */
async function requestOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    let { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = rows[0];

    if (!user) {
      // auto-provision a trainee shell account on first login with a
      // university email; profile gets completed after verification.
      const insert = await db.query(
        `INSERT INTO users (email, full_name, role, is_verified)
         VALUES ($1, $2, 'trainee', false) RETURNING *`,
        [email, email.split('@')[0]]
      );
      user = insert.rows[0];
    }

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 8);
    const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60000);

    await db.query(
      `INSERT INTO otp_codes (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [user.id, email, codeHash, expiresAt]
    );

    const delivered = await sendOtpEmail(email, code, expiryMinutes);

    res.json({
      message: delivered ? 'OTP sent to registered email' : 'OTP generated (email delivery not configured on this server)',
      expiresInMinutes: expiryMinutes,
    });
  } catch (err) {
    next(err);
  }
}

/** STEP 2 of trainee login: verify OTP -> issue JWT */
async function verifyOtp(req, res, next) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

    const { rows } = await db.query(
      `SELECT * FROM otp_codes WHERE email = $1 AND consumed = false
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    const otp = rows[0];
    if (!otp || otp.expires_at < new Date()) {
      return res.status(400).json({ error: 'OTP expired or not found, please request a new one' });
    }

    const match = await bcrypt.compare(code, otp.code_hash);
    if (!match) return res.status(400).json({ error: 'Incorrect OTP' });

    await db.query('UPDATE otp_codes SET consumed = true WHERE id = $1', [otp.id]);
    await db.query('UPDATE users SET is_verified = true WHERE email = $1', [email]);

    const { rows: userRows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRows[0];

    res.json({ token: signToken(user), user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * NOTE: APAAR ID / Aadhaar login used to be handled by a "mock identity"
 * endpoint that issued a verified session for any email + client-supplied
 * reference string, with no actual government verification behind it.
 * That's both misleading to trainees (it looked like real ID verification)
 * and an auth bypass (anyone could self-verify any email address), so it
 * has been removed along with the buttons on the login page. Real APAAR
 * (Academic Bank of Credits) or Aadhaar/DigiLocker eKYC login needs
 * approved government sandbox access and can be wired back in here once
 * that's in place — email OTP is the supported trainee login method until
 * then.
 */

/** Trainer login: email + password (separate button in the UI) */
async function trainerLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const { rows } = await db.query(
      `SELECT * FROM users WHERE email = $1 AND role IN ('trainer','admin')`,
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user), user: sanitize(user) });
  } catch (err) {
    next(err);
  }
}

function sanitize(user) {
  const { password_hash, aadhaar_ref_token, ...safe } = user;
  return safe;
}

module.exports = { requestOtp, verifyOtp, trainerLogin };
