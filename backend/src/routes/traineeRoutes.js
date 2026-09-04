const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { startSession, getSessionSteps, getMyCertifications } = require('../controllers/traineeController');

const router = express.Router();
router.use(requireAuth, requireRole('trainee'));

router.post('/sessions', startSession);
router.get('/sessions/:sessionId/steps', getSessionSteps);
router.get('/certifications', getMyCertifications);

module.exports = router;
