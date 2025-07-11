const express = require('express');
const router = express.Router();
const experienceController = require('../controllers/experienceController');
const { protect } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// Debug log for router
console.log("Experience routes registered");

// Get all experiences
router.get('/', protect, (req, res, next) => {
  console.log("GET /api/experiences route hit");
  return experienceController.getExperiences(req, res, next);
});

// Parse CV to extract experiences
router.post('/parse-cv', protect, uploadSingle('cv'), (req, res, next) => {
  console.log("POST /api/experiences/parse-cv route hit");
  return experienceController.parseCV(req, res, next);
});

// Add a new experience
router.post('/', protect, (req, res, next) => {
  console.log("POST /api/experiences route hit");
  return experienceController.addExperience(req, res, next);
});

// Bulk save experiences
router.post('/bulk', protect, (req, res, next) => {
  console.log("POST /api/experiences/bulk route hit");
  return experienceController.saveMultipleExperiences(req, res, next);
});

// Update an experience
router.put('/:id', protect, (req, res, next) => {
  console.log(`PUT /api/experiences/${req.params.id} route hit`);
  return experienceController.updateExperience(req, res, next);
});

// Delete an experience
router.delete('/:id', protect, (req, res, next) => {
  console.log(`DELETE /api/experiences/${req.params.id} route hit`);
  return experienceController.deleteExperience(req, res, next);
});

// Mark experience as most meaningful (existing route still available)
router.put('/meaningful/set', protect, (req, res, next) => {
  console.log("PUT /api/experiences/meaningful/set route hit");
  return experienceController.setMostMeaningful(req, res, next);
});

// Mark individual experience as most meaningful (to match frontend API call)
router.put('/:id/most-meaningful', protect, (req, res, next) => {
  console.log(`PUT /api/experiences/${req.params.id}/most-meaningful route hit`);
  return experienceController.markAsMostMeaningful(req, res, next);
});

// Generate expanded description for a most meaningful experience
router.post('/:id/expand', protect, (req, res, next) => {
  console.log(`POST /api/experiences/${req.params.id}/expand route hit`);
  return experienceController.generateExpandedDescription(req, res, next);
});

module.exports = router; 