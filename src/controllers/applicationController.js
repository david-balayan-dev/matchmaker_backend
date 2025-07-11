const User = require('../models/User');
const Application = require('../models/Application');
const Program = require('../models/Program');
const PersonalStatement = require('../models/PersonalStatement');
const ResearchProduct = require('../models/ResearchProduct');
const Experience = require('../models/Experience');
const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const { generateApplicationPDF } = require('../services/pdfService');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all applications (with filtering)
// @route   GET /api/v1/applications
// @route   GET /api/v1/programs/:programId/applications
// @access  Private
exports.getApplications = asyncHandler(async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude from filtering
  const removeFields = ['select', 'sort', 'page', 'limit'];
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  if (req.params.programId) {
    // If programId is specified, get applications for that program
    query = Application.find({ program: req.params.programId });
  } else {
    // Otherwise, get applications based on user role
    if (req.user.role === 'applicant') {
      // Applicants can only see their own applications
      query = Application.find({ applicant: req.user.id });
    } else if (req.user.role === 'program_manager') {
      // Program managers can see applications for programs they manage
      const managedPrograms = await Program.find({ manager: req.user.id }).select('_id');
      const programIds = managedPrograms.map(prog => prog._id);
      query = Application.find({ program: { $in: programIds } });
    } else if (req.user.role === 'admin') {
      // Admins can see all applications
      query = Application.find(JSON.parse(queryStr));
    } else {
      return next(new ErrorResponse('Not authorized to access applications', 403));
    }
  }

  // Select specific fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-applicationDate');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Application.countDocuments(query);

  query = query.skip(startIndex).limit(limit);

  // Add population for program and applicant details
  query = query.populate([
    {
      path: 'program',
      select: 'title description category difficulty'
    },
    {
      path: 'applicant',
      select: 'firstName lastName email profileImage'
    },
    {
      path: 'interviews.interviewers',
      select: 'firstName lastName email profileImage'
    },
    {
      path: 'notes.author',
      select: 'firstName lastName email profileImage'
    }
  ]);

  // Executing query
  const applications = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: applications.length,
    pagination,
    data: applications
  });
});

// @desc    Get single application
// @route   GET /api/v1/applications/:id
// @access  Private
exports.getApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id)
    .populate([
      {
        path: 'program',
        select: 'title description category difficulty requiredDocuments'
      },
      {
        path: 'applicant',
        select: 'firstName lastName email profileImage'
      },
      {
        path: 'interviews.interviewers',
        select: 'firstName lastName email profileImage'
      },
      {
        path: 'notes.author',
        select: 'firstName lastName email profileImage'
      }
    ]);

  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }

  // Check if user is authorized to view this application
  if (
    req.user.role !== 'admin' && 
    String(application.applicant._id) !== req.user.id &&
    !(req.user.role === 'program_manager' && application.program.manager === req.user.id)
  ) {
    return next(new ErrorResponse('Not authorized to view this application', 403));
  }

  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Create application
// @route   POST /api/v1/programs/:programId/applications
// @access  Private (applicant only)
exports.createApplication = asyncHandler(async (req, res, next) => {
  // Add program from URL params
  req.body.program = req.params.programId;
  
  // Add applicant as current user
  req.body.applicant = req.user.id;
  
  // Check if program exists
  const program = await Program.findById(req.params.programId);
  if (!program) {
    return next(new ErrorResponse(`Program not found with id of ${req.params.programId}`, 404));
  }
  
  // Check if application deadline has passed
  if (program.applicationDeadline && new Date(program.applicationDeadline) < new Date()) {
    return next(new ErrorResponse(`Application deadline has passed for this program`, 400));
  }
  
  // Check if user already has an application for this program
  const existingApplication = await Application.findOne({
    program: req.params.programId,
    applicant: req.user.id
  });
  
  if (existingApplication) {
    return next(new ErrorResponse(`User already has an application for this program`, 400));
  }
  
  // Create application
  const application = await Application.create(req.body);
  
  res.status(201).json({
    success: true,
    data: application
  });
});

// @desc    Update application
// @route   PUT /api/v1/applications/:id
// @access  Private
exports.updateApplication = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check ownership or admin status
  if (String(application.applicant) !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'program_manager') {
    return next(new ErrorResponse('Not authorized to update this application', 403));
  }
  
  // Applicants can only update applications in draft status
  if (req.user.role === 'applicant' && application.status !== 'draft') {
    return next(new ErrorResponse('Cannot update an application that has been submitted', 400));
  }
  
  // Set who updated the application
  req.body.updatedBy = req.user.id;
  
  // Update application
  application = await Application.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Delete application
// @route   DELETE /api/v1/applications/:id
// @access  Private
exports.deleteApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check ownership or admin status
  if (String(application.applicant) !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this application', 403));
  }
  
  // Only applications in draft status can be deleted
  if (application.status !== 'draft') {
    return next(new ErrorResponse('Cannot delete an application that has been submitted', 400));
  }
  
  await application.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get application statistics
// @route   GET /api/v1/applications/stats
// @access  Private (Admin/Program Manager)
exports.getApplicationStats = asyncHandler(async (req, res, next) => {
  let matchStage = {};
  
  // Program managers can only see stats for their programs
  if (req.user.role === 'program_manager') {
    const managedPrograms = await Program.find({ manager: req.user.id }).select('_id');
    const programIds = managedPrograms.map(prog => prog._id);
    matchStage.program = { $in: programIds };
  }
  
  // Aggregate to get statistics
  const stats = await Application.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Format stats into an object
  const formattedStats = stats.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});
  
  res.status(200).json({
    success: true,
    data: formattedStats
  });
});

// @desc    Batch update applications (for bulk status changes)
// @route   PUT /api/v1/applications/batch
// @access  Private (Admin/Program Manager)
exports.batchUpdateApplications = asyncHandler(async (req, res, next) => {
  const { ids, updates } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorResponse('Please provide an array of application IDs', 400));
  }
  
  if (!updates || typeof updates !== 'object') {
    return next(new ErrorResponse('Please provide update data', 400));
  }
  
  // Add updater information
  updates.updatedBy = req.user.id;
  
  // For program managers, verify they can update these applications
  if (req.user.role === 'program_manager') {
    const managedPrograms = await Program.find({ manager: req.user.id }).select('_id');
    const managedProgramIds = managedPrograms.map(p => p._id.toString());
    
    // Check if all applications belong to managed programs
    const applications = await Application.find({ _id: { $in: ids } }).select('program');
    const unauthorized = applications.some(app => !managedProgramIds.includes(app.program.toString()));
    
    if (unauthorized) {
      return next(new ErrorResponse('Not authorized to update some of these applications', 403));
    }
  }
  
  // Update applications
  const result = await Application.updateMany(
    { _id: { $in: ids } },
    { $set: updates }
  );
  
  res.status(200).json({
    success: true,
    count: result.nModified,
    data: { modified: result.nModified }
  });
});

// @desc    Submit application
// @route   PUT /api/v1/applications/:id/submit
// @access  Private (applicant only)
exports.submitApplication = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check ownership
  if (String(application.applicant) !== req.user.id) {
    return next(new ErrorResponse('Not authorized to submit this application', 403));
  }
  
  // Check if already submitted
  if (application.status !== 'draft') {
    return next(new ErrorResponse('This application has already been submitted', 400));
  }
  
  // Get program to check requirements
  const program = await Program.findById(application.program);
  if (!program) {
    return next(new ErrorResponse(`Program not found`, 404));
  }
  
  // Check if program is still accepting applications
  if (program.applicationDeadline && new Date(program.applicationDeadline) < new Date()) {
    return next(new ErrorResponse(`Application deadline has passed for this program`, 400));
  }
  
  // Validate that required documents are uploaded
  if (program.requiredDocuments) {
    const missingDocuments = [];
    
    if (program.requiredDocuments.resume && !application.resume) {
      missingDocuments.push('Resume');
    }
    
    // Check for other required documents
    if (program.requiredDocuments.coverLetter && !application.coverLetter) {
      missingDocuments.push('Cover Letter');
    }
    
    // Check for required custom fields
    // ... additional validation logic based on program requirements
    
    if (missingDocuments.length > 0) {
      return next(new ErrorResponse(`Missing required documents: ${missingDocuments.join(', ')}`, 400));
    }
  }
  
  // Update application status to submitted
  application = await Application.findByIdAndUpdate(
    req.params.id,
    { 
      status: 'submitted',
      submissionDate: Date.now(),
      updatedBy: req.user.id
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Add interview to application
// @route   POST /api/v1/applications/:id/interviews
// @access  Private (admin, program_manager)
exports.addInterview = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check authorization
  if (req.user.role !== 'admin' && req.user.role !== 'program_manager') {
    return next(new ErrorResponse('Not authorized to add interviews', 403));
  }
  
  // Program managers can only add interviews for their programs
  if (req.user.role === 'program_manager') {
    const program = await Program.findById(application.program);
    if (!program || String(program.manager) !== req.user.id) {
      return next(new ErrorResponse('Not authorized to manage this program', 403));
    }
  }
  
  // Validate interview data
  if (!req.body.round || !req.body.scheduledDate) {
    return next(new ErrorResponse('Please provide round number and scheduled date', 400));
  }
  
  // Update application with new interview
  const newInterview = {
    round: req.body.round,
    scheduledDate: req.body.scheduledDate,
    interviewers: req.body.interviewers || [],
    status: 'scheduled'
  };
  
  application = await Application.findByIdAndUpdate(
    req.params.id,
    { 
      $push: { interviews: newInterview },
      status: 'interview', // Update application status
      updatedBy: req.user.id
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Update interview
// @route   PUT /api/v1/applications/:id/interviews/:interviewId
// @access  Private (admin, program_manager)
exports.updateInterview = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check authorization
  if (req.user.role !== 'admin' && req.user.role !== 'program_manager') {
    return next(new ErrorResponse('Not authorized to update interviews', 403));
  }
  
  // Program managers can only update interviews for their programs
  if (req.user.role === 'program_manager') {
    const program = await Program.findById(application.program);
    if (!program || String(program.manager) !== req.user.id) {
      return next(new ErrorResponse('Not authorized to manage this program', 403));
    }
  }
  
  // Find the interview
  const interview = application.interviews.id(req.params.interviewId);
  if (!interview) {
    return next(new ErrorResponse(`Interview not found with id of ${req.params.interviewId}`, 404));
  }
  
  // Update interview fields
  if (req.body.scheduledDate) interview.scheduledDate = req.body.scheduledDate;
  if (req.body.interviewers) interview.interviewers = req.body.interviewers;
  if (req.body.status) interview.status = req.body.status;
  if (req.body.feedback) interview.feedback = req.body.feedback;
  if (req.body.rating) interview.rating = req.body.rating;
  
  // Add updater information
  application.updatedBy = req.user.id;
  
  // Save the application
  await application.save();
  
  res.status(200).json({
    success: true,
    data: application
  });
});

// @desc    Add note to application
// @route   POST /api/v1/applications/:id/notes
// @access  Private (admin, program_manager)
exports.addNote = asyncHandler(async (req, res, next) => {
  let application = await Application.findById(req.params.id);
  
  if (!application) {
    return next(new ErrorResponse(`Application not found with id of ${req.params.id}`, 404));
  }
  
  // Check authorization
  if (req.user.role !== 'admin' && req.user.role !== 'program_manager') {
    return next(new ErrorResponse('Not authorized to add notes', 403));
  }
  
  // Program managers can only add notes for their programs
  if (req.user.role === 'program_manager') {
    const program = await Program.findById(application.program);
    if (!program || String(program.manager) !== req.user.id) {
      return next(new ErrorResponse('Not authorized to manage this program', 403));
    }
  }
  
  // Validate note data
  if (!req.body.content) {
    return next(new ErrorResponse('Please provide note content', 400));
  }
  
  // Update application with new note
  const newNote = {
    content: req.body.content,
    author: req.user.id,
    visibility: req.body.visibility || 'team'
  };
  
  application = await Application.findByIdAndUpdate(
    req.params.id,
    { 
      $push: { notes: newNote },
      updatedBy: req.user.id
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    success: true,
    data: application
  });
});

// Generate application PDF
exports.generateApplication = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if application is at least 85% complete
    if (user.applicationProgress.percentageComplete < 85) {
      return res.status(400).json({
        success: false,
        message: 'Application must be at least 85% complete to generate PDF',
        percentageComplete: user.applicationProgress.percentageComplete
      });
    }

    // Get all application data
    const personalStatement = await PersonalStatement.findOne({ userId });
    const researchProducts = await ResearchProduct.find({ userId });
    const experiences = await Experience.find({ userId });
    const miscellaneous = await MiscellaneousQuestion.findOne({ userId });

    // Prepare data for PDF generation
    const userData = {
      // User details
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      demographics: user.demographics,
      profileImage: user.profileImage,
      
      // Personal statement
      personalStatement: personalStatement ? {
        finalStatement: personalStatement.finalStatement || 'No personal statement available',
        wordCount: personalStatement.wordCount || 0
      } : {
        finalStatement: 'No personal statement available',
        wordCount: 0
      },
      
      // Research products
      researchProducts: researchProducts || [],
      
      // Experiences
      experiences: experiences || [],
      
      // Miscellaneous data
      miscellaneous: miscellaneous ? {
        professionalism: miscellaneous.professionalism,
        education: miscellaneous.education,
        honorsAwards: miscellaneous.honorsAwards,
        impactfulExperience: miscellaneous.impactfulExperience,
        hobbiesInterests: miscellaneous.hobbiesInterests
      } : {
        professionalism: { hasIssues: false, explanation: null },
        education: { undergraduate: [], graduate: [] },
        honorsAwards: [],
        impactfulExperience: null,
        hobbiesInterests: null
      }
    };

    // Generate PDF
    const pdfBuffer = await generateApplicationPDF(userData);

    // Set response headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="MatchMaker_Application_${user.lastName}_${user.firstName}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    // Send PDF
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate application error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating application PDF',
      error: error.message
    });
  }
}; 