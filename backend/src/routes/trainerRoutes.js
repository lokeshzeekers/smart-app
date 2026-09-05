const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getReviewQueue,
  getEvaluationDetail,
  submitReview,
  registerTrainee,
  listTrainees,
  getTraineePerformance,
} = require('../controllers/trainerController');

const router = express.Router();
router.use(requireAuth, requireRole('trainer', 'admin'));

router.get('/review-queue', getReviewQueue);
router.get('/evaluations/:evaluationId', getEvaluationDetail);
router.post('/evaluations/:evaluationId/review', submitReview);

router.post('/trainees', registerTrainee);
router.get('/trainees', listTrainees);
router.get('/trainees/:traineeId/performance', getTraineePerformance);

module.exports = router;
