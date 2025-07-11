const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

// Get dashboard data
router.get('/', protect, dashboardController.getDashboardData);

// Check if application is ready for program recommendations
router.get('/check-readiness', protect, dashboardController.checkApplicationReadiness);

// Update section progress
router.put('/:sectionName', protect, dashboardController.updateSectionProgress);

// Add route to download user data as PDF
router.get('/download-pdf', protect, dashboardController.generateUserDataPdf);

module.exports = router; 