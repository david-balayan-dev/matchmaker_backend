const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const { protect, authorize } = require('../middleware/auth');
const applicationRouter = require('./applications');

// Search programs
router.get('/search', programController.searchPrograms);

// Featured programs
router.get('/featured', programController.getFeaturedPrograms);

// Program Preferences Routes - must come before parameterized routes
router
  .route('/preferences')
  .get(protect, programController.getProgramPreferences)
  .post(protect, programController.saveProgramPreferences);

router.get('/preferences/recommendations', protect, programController.getProgramRecommendations);
router.get('/preferences/saved', protect, programController.getSavedPrograms);

// Get user's saved programs
router.get(
  '/saved',
  protect,
  programController.getSavedPrograms
);

// Re-route into other resource routers - move after specific routes
router.use('/:programId/applications', applicationRouter);

// Routes
router
  .route('/')
  .get(programController.getPrograms)
  .post(
    protect,
    authorize('admin', 'program_manager'),
    programController.createProgram
  );

// Parameterized routes should come last
router
  .route('/:id')
  .get(programController.getProgram)
  .put(
    protect,
    authorize('admin', 'program_manager'),
    programController.updateProgram
  )
  .delete(
    protect,
    authorize('admin'),
    programController.deleteProgram
  );

// Save program to user's saved list
router.put(
  '/:id/save',
  protect,
  programController.saveProgram
);

// Remove program from user's saved list
router.delete(
  '/:id/save',
  protect,
  programController.unsaveProgram
);

module.exports = router; 