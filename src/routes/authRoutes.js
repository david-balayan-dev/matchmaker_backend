const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadFields } = require('../middleware/upload');

// Register new user
router.post('/register', 
  uploadFields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'cv', maxCount: 1 }
  ]), 
  (req, res, next) => authController.register(req, res, next)
);

// Login user
router.post('/login', authController.login);

// Logout user
router.get('/logout', authController.logout);

// Protected routes (require authentication)
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/upload-profile-image', protect, uploadFields([{ name: 'profileImage', maxCount: 1 }]), (req, res, next) => authController.uploadProfileImage(req, res, next));
router.post('/upload-cv', protect, uploadFields([{ name: 'cv', maxCount: 1 }]), (req, res, next) => authController.uploadCV(req, res, next));

module.exports = router; 