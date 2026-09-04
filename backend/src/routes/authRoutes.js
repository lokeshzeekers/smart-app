const express = require('express');
const rateLimit = require('express-rate-limit');
const { requestOtp, verifyOtp, mockIdentityLogin, trainerLogin } = require('../controllers/authController');

const router = express.Router();

const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Too many OTP requests, try again later' } });

router.post('/otp/request', otpLimiter, requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/identity/mock', mockIdentityLogin);
router.post('/trainer/login', trainerLogin);

module.exports = router;
