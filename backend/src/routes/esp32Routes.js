const express = require('express');
const { requireDeviceAuth } = require('../middleware/deviceAuth');
const { pushStepEvent, completeSession, pushTelemetry } = require('../controllers/esp32Controller');

const router = express.Router();
router.use(requireDeviceAuth);

router.post('/sessions/:sessionId/steps', pushStepEvent);
router.post('/sessions/:sessionId/telemetry', pushTelemetry);
router.post('/sessions/:sessionId/complete', completeSession);

module.exports = router;
