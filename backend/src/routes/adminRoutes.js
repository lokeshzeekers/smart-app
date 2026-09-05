const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createTrainer, listTrainers, deactivateTrainer } = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.post('/trainers', createTrainer);
router.get('/trainers', listTrainers);
router.post('/trainers/:trainerId/deactivate', deactivateTrainer);

module.exports = router;
