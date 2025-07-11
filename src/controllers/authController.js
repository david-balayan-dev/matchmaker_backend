const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const crypto = require('crypto');
const { uploadToS3 } = require('../config/aws');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  console.log('Register endpoint called');
  console.log('Request body:', req.body);
  
  if (req.files) {
    console.log('Files received:', Object.keys(req.files));
  }
  
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    address = {},
    specialties = [],
    geographicalPreferences = []
  } = req.body;
  
  // Validate required fields
  if (!firstName || !lastName || !email || !password) {
    console.error('Missing required fields:', { firstName, lastName, email, password: password ? 'provided' : 'missing' });
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Check for existing user
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    console.log(`Email ${email} already registered`);
    return res.status(400).json({
      success: false,
      error: 'Email already registered'
    });
  }

  // Handle file uploads if present
  let profilePhotoUrl = null;
  let resumeUrl = null;

  if (req.files) {
    console.log('Processing uploaded files');
    
    // Handle profile image if provided
    if (req.files.profileImage) {
      console.log('Processing profile image:', req.files.profileImage[0].filename);
      profilePhotoUrl = `/uploads/profileImages/${req.files.profileImage[0].filename}`;
      // If AWS S3 is configured, uncomment the following:
      // profilePhotoUrl = await uploadToS3(req.files.profileImage[0], 'profile-images');
    }

    // Handle CV if provided
    if (req.files.cv) {
      console.log('Processing CV:', req.files.cv[0].filename);
      resumeUrl = `/uploads/cvs/${req.files.cv[0].filename}`;
      // If AWS S3 is configured, uncomment the following:
      // resumeUrl = await uploadToS3(req.files.cv[0], 'resumes');
    }
  }

  try {
    // Create user
    console.log('Creating user in database');
    const user = await User.create({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      password,
      phoneNumber: phone,
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || ''
      },
      specialties,
      geographicalPreferences,
      specialty: req.body.specialty || '',
      profileImage: profilePhotoUrl || 'default-profile.jpg',
      resume: resumeUrl,
      role: 'applicant',
      emailVerificationToken: crypto.randomBytes(20).toString('hex')
    });

    // Generate verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;

    const message = `
      <h1>Email Verification</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}" target="_blank">Verify Email</a>
    `;

    try {
      // Uncomment to enable email verification
      // await sendEmail({
      //   email: user.email,
      //   subject: 'Email Verification',
      //   message
      // });
      console.log('User created successfully, would send email verification to:', email);

      // Generate token
      const token = user.getSignedJwtToken();

      // Remove password from response
      user.password = undefined;

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your email.',
        token,
        user
      });
    } catch (err) {
      console.error('Email could not be sent', err);

      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return next(new ErrorResponse(error.message || 'Error creating user', 400));
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phoneNumber: req.body.phone,
    bio: req.body.bio
  };

  // Filter out undefined fields
  Object.keys(fieldsToUpdate).forEach(key =>
    fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
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
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

  const message = `
    <h1>Password Reset</h1>
    <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}" target="_blank">Reset Password</a>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.error('Email could not be sent', err);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const emailVerificationToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken,
    emailVerificationExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set user as verified
  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
exports.resendVerificationEmail = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (user.isVerified) {
    return next(new ErrorResponse('Email already verified', 400));
  }

  // Generate verification token
  const verificationToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;

  const message = `
    <h1>Email Verification</h1>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}" target="_blank">Verify Email</a>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Email Verification',
      message
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.error('Email could not be sent', err);

    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, phoneNumber, bio, address, socialLinks, specialty } = req.body;

  const updates = {};

  // Update only provided fields
  if (firstName) updates.firstName = firstName;
  if (lastName) updates.lastName = lastName;
  if (phoneNumber) updates.phoneNumber = phoneNumber;
  if (bio) updates.bio = bio;
  if (address) updates.address = address;
  if (socialLinks) updates.socialLinks = socialLinks;
  if (specialty) updates.specialty = specialty;

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    user
  });
});

// @desc    Upload profile image
// @route   POST /api/auth/upload-profile-image
// @access  Private
exports.uploadProfileImage = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.profileImage) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const file = req.files.profileImage[0];

  // Make sure the file is an image
  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse('Please upload an image file', 400));
  }

  // Upload file to S3
  const profileImageUrl = await uploadToS3(file, 'profile-images');

  // Update user profile with new image URL
  await User.findByIdAndUpdate(req.user.id, { profilePhoto: profileImageUrl });

  res.status(200).json({
    success: true,
    data: profileImageUrl
  });
});

// @desc    Upload CV
// @route   POST /api/auth/upload-cv
// @access  Private
exports.uploadCV = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.cv) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const file = req.files.cv[0];

  // Make sure the file is a PDF
  if (file.mimetype !== 'application/pdf') {
    return next(new ErrorResponse('Please upload a PDF file', 400));
  }

  // Get the file path
  const filePath = file.path;

  // Update user profile with new CV path
  await User.findByIdAndUpdate(req.user.id, { resume: filePath });

  res.status(200).json({
    success: true,
    data: filePath
  });
});

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    user
  });
}; 