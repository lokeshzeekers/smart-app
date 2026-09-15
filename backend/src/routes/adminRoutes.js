const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  createTrainer,
  listTrainers,
  deactivateTrainer,
  resetTrainerPassword,
  createDevice,
  listDevices,
  assignDevice,
  deactivateDevice,
} = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.post('/trainers', createTrainer);
router.get('/trainers', listTrainers);
router.patch('/trainers/:trainerId/password', resetTrainerPassword);
router.delete('/trainers/:trainerId', deactivateTrainer);

router.post('/devices', createDevice);
router.get('/devices', listDevices);
router.patch('/devices/:deviceId/assign', assignDevice);
router.delete('/devices/:deviceId', deactivateDevice);

module.exports = router;
