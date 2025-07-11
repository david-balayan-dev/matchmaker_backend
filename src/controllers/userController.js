const User = require('../models/User');
const Application = require('../models/Application');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Users can view their own profile or admins can view any profile
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this user', 403));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Delete user
  await user.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Update profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  // Fields to update
  const fieldsToUpdate = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phoneNumber: req.body.phoneNumber,
    bio: req.body.bio,
    address: req.body.address,
    education: req.body.education,
    experience: req.body.experience,
    skills: req.body.skills,
    languages: req.body.languages,
    certifications: req.body.certifications,
    socialLinks: req.body.socialLinks
  };

  // Remove undefined fields
  Object.keys(fieldsToUpdate).forEach(
    key => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
  );

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update password
// @route   PUT /api/users/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});

// @desc    Get current user's applications
// @route   GET /api/users/applications
// @access  Private
exports.getUserApplications = asyncHandler(async (req, res, next) => {
  const applications = await Application.find({ applicant: req.user.id })
    .populate({
      path: 'program',
      select: 'title institution department type status'
    });

  res.status(200).json({
    success: true,
    count: applications.length,
    data: applications
  });
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private
exports.getUserStats = asyncHandler(async (req, res, next) => {
  // Get application statistics
  const applicationStats = await Application.aggregate([
    { $match: { applicant: req.user._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Format the results
  const formattedStats = {};
  applicationStats.forEach(stat => {
    formattedStats[stat._id] = stat.count;
  });

  // Get total applications
  const totalApplications = await Application.countDocuments({ applicant: req.user._id });

  // Get recently updated applications
  const recentApplications = await Application.find({ applicant: req.user._id })
    .sort('-lastUpdated')
    .limit(5)
    .populate({
      path: 'program',
      select: 'title institution'
    });

  res.status(200).json({
    success: true,
    data: {
      applicationStats: {
        ...formattedStats,
        total: totalApplications
      },
      recentApplications
    }
  });
}); 