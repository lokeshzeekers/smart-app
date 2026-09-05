const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { startSession, getSessionSteps, getMyCertifications, getMySummary, exportMyRecords, listDevices } = require('../controllers/traineeController');

const router = express.Router();
router.use(requireAuth, requireRole('trainee'));

router.post('/sessions', startSession);
router.get('/sessions/:sessionId/steps', getSessionSteps);
router.get('/certifications', getMyCertifications);
router.get('/summary', getMySummary);
router.get('/records/export', exportMyRecords);
router.get('/devices', listDevices);

module.exports = router;
