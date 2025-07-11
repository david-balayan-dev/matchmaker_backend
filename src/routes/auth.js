const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Register user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Logout user
router.get('/logout', authController.logout);

// Get current logged in user
router.get('/me', protect, authController.getMe);

// Forgot password
router.post('/forgotpassword', authController.forgotPassword);

// Reset password
router.put('/resetpassword/:resettoken', authController.resetPassword);

// Update user details
router.put('/updatedetails', protect, authController.updateDetails);

// Update password
router.put('/updatepassword', protect, authController.updatePassword);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);

// Resend verification email
router.post('/resend-verification', protect, authController.resendVerificationEmail);

module.exports = router; 