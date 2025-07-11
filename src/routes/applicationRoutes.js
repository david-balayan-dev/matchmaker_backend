const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const authenticate = require('../middleware/auth');

// Generate application PDF
router.get('/generate', authenticate, applicationController.generateApplication);

module.exports = router; 