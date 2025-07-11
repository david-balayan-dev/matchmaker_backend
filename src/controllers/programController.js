const Program = require('../models/Program');
const User = require('../models/User');
const ProgramPreference = require('../models/ProgramPreference');
const PersonalStatement = require('../models/PersonalStatement');
const ResearchProduct = require('../models/ResearchProduct');
const Experience = require('../models/Experience');
const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { generateProgramRecommendations } = require('../services/programRecommendationService');

// @desc    Get all programs
// @route   GET /api/v1/programs
// @access  Public
exports.getPrograms = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single program
// @route   GET /api/v1/programs/:id
// @access  Public
exports.getProgram = asyncHandler(async (req, res, next) => {
  const program = await Program.findById(req.params.id).populate('creator');

  if (!program) {
    return next(new ErrorResponse(`Program not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: program
  });
});

// @desc    Create new program
// @route   POST /api/v1/programs
// @access  Private (Admin & Program Manager)
exports.createProgram = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.creator = req.user.id;
  
  const program = await Program.create(req.body);

  res.status(201).json({
    success: true,
    data: program
  });
});

// @desc    Update program
// @route   PUT /api/v1/programs/:id
// @access  Private (Admin & Program Manager)
exports.updateProgram = asyncHandler(async (req, res, next) => {
  let program = await Program.findById(req.params.id);

  if (!program) {
    return next(new ErrorResponse(`Program not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is program creator or admin
  if (program.creator.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this program`, 401));
  }

  program = await Program.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: program
  });
});

// @desc    Delete program
// @route   DELETE /api/v1/programs/:id
// @access  Private (Admin & Program Manager)
exports.deleteProgram = asyncHandler(async (req, res, next) => {
  const program = await Program.findById(req.params.id);

  if (!program) {
    return next(new ErrorResponse(`Program not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is program creator or admin
  if (program.creator.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this program`, 401));
  }

  await program.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get user program preferences
// @route   GET /api/v1/programs/preferences
// @access  Private
exports.getProgramPreferences = asyncHandler(async (req, res, next) => {
  // Find program preferences for the user
  let preferences = await ProgramPreference.findOne({ userId: req.user.id });

  // If no preferences found, return empty object
  if (!preferences) {
    return res.status(200).json({
      success: true,
      data: {}
    });
  }

  res.status(200).json({
    success: true,
    data: preferences
  });
});

// @desc    Save user program preferences
// @route   POST /api/v1/programs/preferences
// @access  Private
exports.saveProgramPreferences = asyncHandler(async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Validate required fields
    const { primarySpecialty, preferredStates, hospitalPreference, residentCountPreference, valuedCharacteristics } = req.body;
    
    // Set completion flag
    req.body.isComplete = true;
    req.body.userId = userId;
    
    // Find and update program preferences or create new
    const preferences = await ProgramPreference.findOneAndUpdate(
      { userId },
      req.body,
      { 
        new: true, 
        upsert: true, 
        runValidators: true,
        setDefaultsOnInsert: true
      }
  );
    
    // Update dashboard progress through helper function
    await updateDashboardProgress(userId);

  res.status(200).json({
    success: true,
      data: preferences
  });
  } catch (error) {
    console.error('Error saving program preferences:', error);
    
    // If validation error, return appropriate message
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error while saving program preferences',
      error: error.message
    });
  }
});

// @desc    Get program recommendations based on user preferences
// @route   GET /api/v1/programs/preferences/recommendations
// @access  Private
exports.getProgramRecommendations = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.programPreferences) {
    return next(new ErrorResponse('No program preferences found', 404));
  }

  // Build query based on user preferences
  const { interests, difficulty, duration, format } = user.programPreferences;
  
  let query = {};
  
  if (interests && interests.length > 0) {
    query.tags = { $in: interests };
  }
  
  if (difficulty) {
    query.difficulty = difficulty;
  }
  
  if (duration) {
    query.duration = duration;
  }
  
  if (format) {
    query.format = format;
  }

  const programs = await Program.find(query).populate('creator');

  res.status(200).json({
    success: true,
    count: programs.length,
    data: programs
  });
});

// @desc    Search programs
// @route   GET /api/v1/programs/search
// @access  Public
exports.searchPrograms = asyncHandler(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  // Search in title, description and tags
  const programs = await Program.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  }).populate('creator');

  res.status(200).json({
    success: true,
    count: programs.length,
    data: programs
  });
});

// @desc    Get featured programs
// @route   GET /api/v1/programs/featured
// @access  Public
exports.getFeaturedPrograms = asyncHandler(async (req, res, next) => {
  const programs = await Program.find({ featured: true }).populate('creator');

  res.status(200).json({
    success: true,
    count: programs.length,
    data: programs
  });
});

// @desc    Save a program to user's saved programs
// @route   POST /api/v1/programs/save/:id
// @access  Private
exports.saveProgram = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const program = await Program.findById(req.params.id);

  if (!program) {
    return next(new ErrorResponse(`Program not found with id of ${req.params.id}`, 404));
  }

  // Check if already saved
  if (user.savedPrograms.includes(req.params.id)) {
    return next(new ErrorResponse('Program already saved', 400));
  }

  // Add to saved programs
  user.savedPrograms.push(req.params.id);
  await user.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Remove a program from user's saved programs
// @route   DELETE /api/v1/programs/save/:id
// @access  Private
exports.unsaveProgram = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  // Remove from saved programs
  user.savedPrograms = user.savedPrograms.filter(
    id => id.toString() !== req.params.id
  );
  
  await user.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get user's saved programs
// @route   GET /api/v1/programs/preferences/saved
// @access  Private
exports.getSavedPrograms = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('savedPrograms');

  res.status(200).json({
    success: true,
    count: user.savedPrograms.length,
    data: user.savedPrograms
  });
});

// Helper function to update user progress
const updateUserProgress = async (userId) => {
  try {
    const user = await User.findById(userId);
    
    // This functionality would depend on your complete application structure
    // Here's a simplified implementation
    user.applicationProgress.completedSections += 1;
    user.applicationProgress.percentageComplete = 
      Math.round((user.applicationProgress.completedSections / user.applicationProgress.totalSections) * 100);
    
    await user.save();
  } catch (err) {
    console.error('Error updating user progress:', err);
  }
};

// Helper function to update dashboard progress
const updateDashboardProgress = async (userId) => {
  try {
    // Get all section models
    const personalStatement = await PersonalStatement.findOne({ user: userId }).select('isComplete');
    const researchProducts = await ResearchProduct.find({ userId }).select('isComplete');
    const experiences = await Experience.find({ userId }).select('isComplete');
    const miscellaneous = await MiscellaneousQuestion.findOne({ userId }).select('isComplete');
    const programPreference = await ProgramPreference.findOne({ userId }).select('isComplete');
    
    // Count completed sections
    let completedSections = 0;
    const totalSections = 5;
    
    if (personalStatement && personalStatement.isComplete) completedSections++;
    if (researchProducts.length > 0 && researchProducts.every(p => p.isComplete)) completedSections++;
    if (experiences.length > 0 && experiences.every(e => e.isComplete)) completedSections++;
    if (miscellaneous && miscellaneous.isComplete) completedSections++;
    if (programPreference && programPreference.isComplete) completedSections++;
    
    // Calculate percentage
    const percentageComplete = Math.round((completedSections / totalSections) * 100);
    
    // Update user progress
    const user = await User.findById(userId);
    if (user) {
      user.applicationProgress = {
        totalSections,
        completedSections,
        percentageComplete
      };
      await user.save();
    }
  } catch (err) {
    console.error('Error updating dashboard progress:', err);
  }
}; 