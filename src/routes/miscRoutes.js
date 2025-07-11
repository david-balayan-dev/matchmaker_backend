const express = require('express');
const router = express.Router();
const miscController = require('../controllers/miscController');
const { protect } = require('../middleware/auth');

// Get miscellaneous questions data
router.get('/', protect, miscController.getMiscData);

// Save professionalism issues
router.put('/professionalism', protect, miscController.saveProfessionalism);

// Save education information
router.put('/education', protect, miscController.saveEducation);

// Add honor/award
router.post('/honors', protect, miscController.addHonorAward);

// Update honor/award
router.put('/honors/:id', protect, miscController.updateHonorAward);

// Delete honor/award
router.delete('/honors/:id', protect, miscController.deleteHonorAward);

// Save impactful experience and hobbies
router.put('/impactful-hobbies', protect, miscController.saveImpactfulAndHobbies);

// Save all miscellaneous data at once
router.post('/', protect, miscController.saveAllMiscData);

module.exports = router; 