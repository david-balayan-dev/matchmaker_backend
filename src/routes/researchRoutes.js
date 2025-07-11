const express = require('express');
const router = express.Router();
const researchController = require('../controllers/researchController');
const { protect } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Get research products for authenticated user
router.get('/products', protect, researchController.getResearchProducts);

// Parse CV to extract research products
router.post('/parse-cv', protect, uploadSingle('cv'), researchController.parseCV);

// Save research products
router.post('/save-products', protect, researchController.saveResearchProducts);

// Add a single research product manually
router.post('/product', protect, researchController.addResearchProduct);

// Update a research product
router.put('/product/:id', protect, researchController.updateResearchProduct);

// Delete a research product
router.delete('/product/:id', protect, researchController.deleteResearchProduct);

// Complete research section
router.post('/complete-section', protect, researchController.completeResearchSection);

module.exports = router; 