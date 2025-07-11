const express = require('express');
const router = express.Router({ mergeParams: true });
const applicationController = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

// Routes
router
  .route('/')
  .get(
    protect,
    applicationController.getApplications
  )
  .post(
    protect,
    authorize('applicant'),
    applicationController.createApplication
  );

router
  .route('/stats')
  .get(
    protect,
    authorize('admin', 'program_manager'),
    applicationController.getApplicationStats
  );

router
  .route('/batch')
  .put(
    protect,
    authorize('admin', 'program_manager'),
    applicationController.batchUpdateApplications
  );

router
  .route('/:id')
  .get(
    protect,
    applicationController.getApplication
  )
  .put(
    protect,
    applicationController.updateApplication
  )
  .delete(
    protect,
    applicationController.deleteApplication
  );

router
  .route('/:id/submit')
  .put(
    protect,
    authorize('applicant'),
    applicationController.submitApplication
  );

router
  .route('/:id/interviews')
  .post(
    protect,
    authorize('admin', 'program_manager'),
    applicationController.addInterview
  );

router
  .route('/:id/interviews/:interviewId')
  .put(
    protect,
    authorize('admin', 'program_manager'),
    applicationController.updateInterview
  );

router
  .route('/:id/notes')
  .post(
    protect,
    authorize('admin', 'program_manager'),
    applicationController.addNote
  );

module.exports = router; 