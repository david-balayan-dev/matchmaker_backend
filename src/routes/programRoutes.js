const express = require('express');
const {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramPreferences,
  saveProgramPreferences,
  getProgramRecommendations,
  searchPrograms,
  getFeaturedPrograms,
  saveProgram,
  unsaveProgram,
  getSavedPrograms
} = require('../controllers/programController');

const Program = require('../models/Program');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/search', searchPrograms);
router.get('/featured', getFeaturedPrograms);

// Protected routes (require authentication)
router.use(protect);

// Program preferences routes must come BEFORE the /:id route to avoid conflicts
router.get('/preferences/recommendations', getProgramRecommendations);
router.get('/preferences/saved', getSavedPrograms);
router.get('/preferences', getProgramPreferences);
router.post('/preferences', saveProgramPreferences);

// Program saving routes
router.post('/save/:id', saveProgram);
router.delete('/save/:id', unsaveProgram);

// Parameterized routes come after specific routes
router.get('/:id', getProgram);
router.get('/', advancedResults(Program, 'creator'), getPrograms);

// Admin and program manager only routes
router.use(authorize('admin', 'program_manager'));

router.post('/', createProgram);
router.put('/:id', updateProgram);
router.delete('/:id', deleteProgram);

module.exports = router; 