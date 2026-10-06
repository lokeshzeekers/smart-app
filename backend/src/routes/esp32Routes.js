const express = require('express');
const db = require('../config/db');
const { requireDeviceAuth } = require('../middleware/deviceAuth');
const { pushStepEvent, completeSession, pushTelemetry, getActiveSession } = require('../controllers/esp32Controller');

const router = express.Router();
router.use(requireDeviceAuth);

// Any registered manikin used to be able to write into ANY session id. Now a
// device may only report against an open session that was started on it.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('sessionId', async (req, res, next, sessionId) => {
  try {
    if (!UUID_RE.test(sessionId)) return res.status(404).json({ error: 'Session not found' });
    const { rows } = await db.query(
      `SELECT id FROM sessions WHERE id = $1 AND device_id = $2 AND completed_at IS NULL`,
      [sessionId, req.device.id]
    );
    if (rows.length === 0) {
      return res.status(409).json({ error: 'Session is not open on this manikin' });
    }
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/active', getActiveSession);
router.post('/sessions/:sessionId/steps', pushStepEvent);
router.post('/sessions/:sessionId/telemetry', pushTelemetry);
router.post('/sessions/:sessionId/complete', completeSession);

module.exports = router;
