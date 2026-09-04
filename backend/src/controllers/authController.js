const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');

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
 * In production, wire an SMTP/SES provider here. For now the OTP is logged
 * server-side so the flow is fully testable without a mail provider.
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
    const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES || 5) * 60000));

    await db.query(
      `INSERT INTO otp_codes (user_id, email, code_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [user.id, email, codeHash, expiresAt]
    );

    // TODO: replace with real email dispatch (SES/SendGrid) using SMTP_* env vars
    // eslint-disable-next-line no-console
    console.log(`[DEV ONLY] OTP for ${email}: ${code}`);

    res.json({ message: 'OTP sent to registered email', expiresInMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5) });
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
 * Mocked APAAR ID / Aadhaar continue button.
 * Real integration requires government sandbox approval (DigiLocker/UIDAI
 * eKYC APIs) which is out of scope here - this endpoint simulates the
 * successful-verification callback so the rest of the app (JWT issuance,
 * profile linking) is production-ready and just needs the real provider
 * swapped in later.
 */
async function mockIdentityLogin(req, res, next) {
  try {
    const { email, provider, identityRef } = req.body; // provider: 'apaar' | 'aadhaar'
    if (!email || !provider || !identityRef) {
      return res.status(400).json({ error: 'email, provider and identityRef are required' });
    }

    const refHash = crypto.createHash('sha256').update(identityRef).digest('hex');
    let { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = rows[0];

    if (!user) {
      const insert = await db.query(
        `INSERT INTO users (email, full_name, role, is_verified, apaar_id, aadhaar_ref_token)
         VALUES ($1, $2, 'trainee', true, $3, $4) RETURNING *`,
        [
          email,
          email.split('@')[0],
          provider === 'apaar' ? identityRef : null,
          provider === 'aadhaar' ? refHash : null,
        ]
      );
      user = insert.rows[0];
    } else {
      await db.query('UPDATE users SET is_verified = true WHERE id = $1', [user.id]);
    }

    res.json({ token: signToken(user), user: sanitize(user), mocked: true });
  } catch (err) {
    next(err);
  }
}

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

module.exports = { requestOtp, verifyOtp, mockIdentityLogin, trainerLogin };
