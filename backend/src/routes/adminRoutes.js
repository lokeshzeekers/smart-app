const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createTrainer, listTrainers, deactivateTrainer, createDevice, listDevices, deactivateDevice } = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.post('/trainers', createTrainer);
router.get('/trainers', listTrainers);
router.post('/trainers/:trainerId/deactivate', deactivateTrainer);

router.post('/devices', createDevice);
router.get('/devices', listDevices);
router.post('/devices/:deviceId/deactivate', deactivateDevice);

module.exports = router;
