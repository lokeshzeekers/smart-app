const nodemailer = require('nodemailer');

let transporter = null;
let transporterReady = false;

/**
 * Lazily builds the SMTP transporter from env vars.
 * Works with any SMTP provider - Gmail (free, with an App Password),
 * SendGrid, SES, Mailgun, Zoho, etc. Nothing here is provider-specific.
 */
function getTransporter() {
  if (transporterReady) return transporter;
  transporterReady = true;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // eslint-disable-next-line no-console
    console.warn(
      '[mailer] SMTP_* env vars are not fully configured — OTP emails will be logged to the console instead of sent. ' +
      'See backend/.env.example for setup instructions (a free Gmail App Password works fine).'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587/25 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

function otpEmailHtml(code, expiresInMinutes) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;background:#f4f6f5;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e3e8e5;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:36px;height:36px;border-radius:10px;background:#0f5b45;display:inline-block;text-align:center;line-height:36px;">
          <span style="color:#fff;font-size:18px;">&#9877;</span>
        </div>
        <span style="font-size:16px;font-weight:700;color:#0f172a;">SMArT Airway Training</span>
      </div>
      <p style="color:#334155;font-size:14px;margin:0 0 6px;">Your one-time verification code is:</p>
      <div style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f5b45;text-align:center;background:#f0f7f4;border-radius:10px;padding:16px 0;margin:16px 0;">
        ${code}
      </div>
      <p style="color:#64748b;font-size:12.5px;margin:0;">
        This code expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px;">
      SMArT — Simulation-based Management of Airway Training
    </p>
  </div>`;
}

/**
 * Sends the OTP email. Returns true if it was actually dispatched via SMTP,
 * false if it fell back to a console log (e.g. in local dev without
 * SMTP_* configured). Callers should not fail the request either way —
 * the OTP is already stored and valid, this only affects delivery.
 */
async function sendOtpEmail(to, code, expiresInMinutes) {
  const t = getTransporter();

  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`[DEV ONLY - email not configured] OTP for ${to}: ${code}`);
    return false;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || '"SMArT Airway Training" <no-reply@smart-airway.app>',
    to,
    subject: `${code} is your SMArT verification code`,
    html: otpEmailHtml(code, expiresInMinutes),
    text: `Your SMArT verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
  });

  return true;
}

module.exports = { sendOtpEmail };
