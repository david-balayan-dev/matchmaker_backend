/**
 * Routes for OpenAI API integration
 */
const express = require('express');
const router = express.Router();
const openaiController = require('../controllers/openaiController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Generate thesis statements for personal statement
router.post('/thesis-statements', openaiController.generateThesisStatements);

// Generate complete personal statement
router.post('/personal-statement', openaiController.generatePersonalStatement);

module.exports = router; 