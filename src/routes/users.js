const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Routes
router
  .route('/')
  .get(
    protect,
    authorize('admin'),
    userController.getUsers
  )
  .post(
    protect,
    authorize('admin'),
    userController.createUser
  );

router
  .route('/:id')
  .get(
    protect,
    userController.getUser
  )
  .put(
    protect,
    authorize('admin'),
    userController.updateUser
  )
  .delete(
    protect,
    authorize('admin'),
    userController.deleteUser
  );

// Update current user profile
router.put(
  '/profile',
  protect,
  userController.updateProfile
);

// Update current user password
router.put(
  '/updatepassword',
  protect,
  userController.updatePassword
);

// Get current user applications
router.get(
  '/applications',
  protect,
  userController.getUserApplications
);

// Get application statistics for current user
router.get(
  '/stats',
  protect,
  userController.getUserStats
);

module.exports = router; 