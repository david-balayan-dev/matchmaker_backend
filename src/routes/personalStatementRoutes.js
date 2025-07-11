/**
 * Routes for Personal Statement
 */
const express = require('express');
const router = express.Router();
const personalStatementController = require('../controllers/personalStatementController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Get user's personal statement
router.get('/', personalStatementController.getPersonalStatement);

// Save/update personal statement
router.post('/', personalStatementController.savePersonalStatement);

// Generate thesis statements
router.post('/generate-thesis', personalStatementController.generateThesisStatements);

// Save selected thesis statement
router.put('/select-thesis', personalStatementController.saveSelectedThesis);

// Generate final statement
router.post('/generate-final', personalStatementController.generateFinalStatement);

// Save final statement (if user wants to edit the generated one)
router.put('/save-final', personalStatementController.saveFinalStatement);

// Download personal statement as PDF
router.get('/download-pdf', personalStatementController.downloadPersonalStatementPDF);

// Direct completion endpoint - use this to ensure completion is registered
router.post('/complete', personalStatementController.completePersonalStatement);

module.exports = router; 