const express = require('express');
const { requireDeviceAuth } = require('../middleware/deviceAuth');
const { pushStepEvent, completeSession } = require('../controllers/esp32Controller');

const router = express.Router();
router.use(requireDeviceAuth);

router.post('/sessions/:sessionId/steps', pushStepEvent);
router.post('/sessions/:sessionId/complete', completeSession);

module.exports = router;
