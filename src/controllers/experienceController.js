const Experience = require('../models/Experience');
const User = require('../models/User');
const PersonalStatement = require('../models/PersonalStatement');
const ResearchProduct = require('../models/ResearchProduct');
const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const ProgramPreference = require('../models/ProgramPreference');
const { extractExperiences, generateExpandedDescription } = require('../services/cvParsingService');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const pdf = require('pdf-parse');

// Get all experiences for a user
exports.getExperiences = async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user.id || req.user._id;
    console.log(`Experience controller: Getting experiences for user ${userId}`);

    // Find all experiences for the user
    const experiences = await Experience.find({ userId });

    return res.status(200).json({
      success: true,
      experiences
    });
  } catch (error) {
    console.error('Get experiences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving experiences',
      error: error.message
    });
  }
};

// Parse CV to extract experiences
exports.parseCV = async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user.id || req.user._id;
    console.log(`Experience extraction: Starting CV parsing for user ${userId}`);

    // Check if file is provided
    if (!req.file) {
      console.error('Experience extraction: No file provided');
      return res.status(400).json({
        success: false,
        message: 'No CV file provided'
      });
    }

    console.log("Experience extraction: File received:", {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Get the file path
    const filePath = req.file.path;
      
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.error('Experience extraction: File not found at path:', filePath);
      return res.status(500).json({
        success: false,
        message: 'Error: File not found after upload'
      });
    }

    // Read the file content
    let cvText;
    try {
      if (req.file.mimetype === 'application/pdf') {
        console.log('Experience extraction: Parsing PDF file');
        // Read PDF file
        const dataBuffer = await readFile(filePath);
        const data = await pdf(dataBuffer);
        cvText = data.text;
        
        if (!cvText || cvText.trim().length === 0) {
          console.error('Experience extraction: No text content extracted from PDF');
          throw new Error('No text content extracted from PDF');
        }
        
        console.log(`Experience extraction: Successfully extracted ${cvText.length} characters from PDF`);
      } else {
        // For text files
        console.log('Experience extraction: Reading text file');
        cvText = await readFile(filePath, 'utf8');
        console.log(`Experience extraction: Successfully read ${cvText.length} characters from text file`);
      }
    } catch (readError) {
      console.error('Experience extraction: Error reading file:', readError);
      return res.status(500).json({
        success: false,
        message: 'Error reading file content',
        error: readError.message
      });
    }

    // Extract experiences from CV text
    console.log('Experience extraction: Calling extractExperiences service');
    let extractedExperiences = [];
    try {
      extractedExperiences = await extractExperiences(cvText);
      console.log(`Experience extraction: Received ${extractedExperiences ? extractedExperiences.length : 0} experiences from service`);
      
      if (extractedExperiences && extractedExperiences.length > 0) {
        console.log('Experience extraction: First experience sample:', JSON.stringify(extractedExperiences[0]).substring(0, 200) + '...');
      }
    } catch (extractError) {
      console.error('Experience extraction: Error from OpenAI service:', extractError);
      // Continue execution to provide a fallback sample
    }

    if (!extractedExperiences || extractedExperiences.length === 0) {
      console.log('Experience extraction: No experiences extracted, returning sample data');
      
      // Try to extract manually using pattern matching
      console.log('Experience extraction: Attempting manual extraction from CV text');
      const experiencePatterns = [
        /(?:experience|work|employment|position)[\s\S]*?(organization|company|institution|employer|hospital|clinic|university):[\s\S]*?(\w[\w\s&.,'-]+)[\s\S]*?(position|title|role):[\s\S]*?(\w[\w\s&.,'-]+)/i,
        /(?:organization|company|institution|employer|hospital|clinic|university):[\s\S]*?(\w[\w\s&.,'-]+)[\s\S]*?(position|title|role):[\s\S]*?(\w[\w\s&.,'-]+)/i
      ];
      
      for (const pattern of experiencePatterns) {
        const match = cvText.match(pattern);
        if (match) {
          console.log('Experience extraction: Manual pattern match found:', match);
          
          // Create an experience from the matched data
          extractedExperiences = [{
            organization: match[2] || match[1] || 'Organization from CV',
            experienceType: 'Extracted from CV',
            positionTitle: match[4] || match[3] || 'Position from CV',
            startDate: new Date(),
            endDate: null,
            isCurrent: true,
            country: 'USA',
            state: 'CA',
            participationFrequency: 'Full-time',
            setting: 'Extracted from CV',
            focusArea: 'Extracted from CV',
            description: 'Experience extracted from CV. Please edit with accurate details.',
          }];
          console.log('Experience extraction: Created experiences from pattern match:', extractedExperiences);
          break;
        }
      }
      
      // If we still don't have experiences, use the default sample
      if (!extractedExperiences || extractedExperiences.length === 0) {
        // Return a sample experience if nothing was extracted
        return res.status(200).json({
          success: true,
          message: 'No experiences could be extracted from CV, returning sample data',
          experiences: [{
            userId,
            organization: 'Sample Organization',
            experienceType: 'Research',
            positionTitle: 'Research Assistant',
            startDate: new Date(),
            endDate: null,
            isCurrent: true,
            country: 'USA',
            state: 'CA',
            participationFrequency: 'Full-time',
            setting: 'Laboratory',
            focusArea: 'Medical Research',
            description: 'Sample experience description. Please edit with your actual experience details.',
            isComplete: true,
            _id: 'sample_' + Date.now()
          }]
        });
      }
    }

    // Save extracted experiences to database
    console.log('Experience extraction: Saving experiences to database');
    const savedExperiences = [];
    for (const exp of extractedExperiences) {
      try {
        // Date formatting
        let startDate;
        try {
          // Try to parse the date in various formats
          if (exp.startDate) {
            if (exp.startDate.toLowerCase().includes('present') || exp.startDate.toLowerCase().includes('current')) {
              // If 'present' is in startDate, it's likely incorrect
              startDate = new Date();
            } else if (/^\d{4}$/.test(exp.startDate.trim())) {
              // Just a year, e.g., "2015"
              startDate = new Date(exp.startDate.trim(), 0, 1); // January 1st of that year
            } else if (/^\d{4}-\d{2}$/.test(exp.startDate.trim()) || /^\d{1,2}\/\d{4}$/.test(exp.startDate.trim())) {
              // Format like "2015-05" or "5/2015" (MM/YYYY)
              const parts = exp.startDate.trim().includes('-') 
                ? exp.startDate.trim().split('-') 
                : exp.startDate.trim().split('/').reverse();
              startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            } else {
              // Attempt a standard parse for other formats
              startDate = new Date(exp.startDate);
            }
            
            // Check if the date is valid
            if (isNaN(startDate.getTime())) {
              // If parse failed, use current date
              console.log(`Experience extraction: Invalid start date format '${exp.startDate}', using current date`);
              startDate = new Date();
            }
          } else {
            startDate = new Date();
          }
        } catch (dateError) {
          console.error('Experience extraction: Error parsing start date:', dateError);
          startDate = new Date();
        }
        
        // End date and current status handling
        let endDate = null;
        let isCurrent = false;
        
        if (!exp.endDate || 
            exp.endDate.toLowerCase().includes('present') || 
            exp.endDate.toLowerCase().includes('current') || 
            exp.endDate.toLowerCase().includes('ongoing')) {
          // If end date is missing or indicates current position
          endDate = null;
          isCurrent = true;
        } else {
          try {
            // Similar date parsing logic for end date
            if (/^\d{4}$/.test(exp.endDate.trim())) {
              // Just a year, e.g., "2018"
              endDate = new Date(exp.endDate.trim(), 11, 31); // December 31st of that year
            } else if (/^\d{4}-\d{2}$/.test(exp.endDate.trim()) || /^\d{1,2}\/\d{4}$/.test(exp.endDate.trim())) {
              // Format like "2018-05" or "5/2018" (MM/YYYY)
              const parts = exp.endDate.trim().includes('-') 
                ? exp.endDate.trim().split('-') 
                : exp.endDate.trim().split('/').reverse();
              endDate = new Date(parseInt(parts[0]), parseInt(parts[1]), 0); // Last day of the month
            } else {
              // Attempt a standard parse
              endDate = new Date(exp.endDate);
            }
            
            // Check if the date is valid
            if (isNaN(endDate.getTime())) {
              console.log(`Experience extraction: Invalid end date format '${exp.endDate}', setting as current`);
              endDate = null;
              isCurrent = true;
            }
          } catch (dateError) {
            console.error('Experience extraction: Error parsing end date:', dateError);
            endDate = null;
            isCurrent = true;
          }
        }
        
        // Determine focus area (use department if available)
        let focusArea = exp.focusArea || exp.department || exp.field || 'Not specified';
        
        // Improve country detection if available
        let country = exp.country || 'Not specified';
        if (country === 'Not specified' && exp.location) {
          // Try to extract country from location field if present
          const locationParts = exp.location.split(',').map(part => part.trim());
          if (locationParts.length > 1) {
            // Last part might be country
            country = locationParts[locationParts.length - 1];
          } else {
            country = exp.location;
          }
        }
        
        // Improve state detection
        let state = exp.state || 'Not specified';
        if (state === 'Not specified' && exp.location) {
          // Try to extract state from location field if present
          const locationParts = exp.location.split(',').map(part => part.trim());
          if (locationParts.length > 1) {
            // Second last part might be state/province
            state = locationParts[locationParts.length - 2] || state;
          }
        }

        const newExperience = new Experience({
          userId,
          organization: exp.organization || 'Not specified',
          experienceType: exp.experienceType || exp.type || 'Not specified',
          positionTitle: exp.positionTitle || exp.position || exp.title || 'Not specified',
          startDate,
          endDate,
          isCurrent,
          country,
          state,
          participationFrequency: exp.participationFrequency || exp.frequency || 'Not specified',
          setting: exp.setting || 'Not specified',
          focusArea,
          description: exp.description || exp.responsibilities || 'Not specified',
          isComplete: true
        });

        await newExperience.save();
        savedExperiences.push(newExperience);
        console.log(`Experience extraction: Saved experience: ${exp.positionTitle || exp.position || 'Unknown position'} at ${exp.organization || 'Unknown organization'}`);
      } catch (saveError) {
        console.error(`Experience extraction: Error saving experience:`, saveError);
        // Continue with the next experience
      }
    }

    // Update user's application progress
    try {
      await updateUserProgress(userId);
      console.log('Experience extraction: Updated user progress');
    } catch (progressError) {
      console.error('Experience extraction: Error updating user progress:', progressError);
      // Continue execution, don't return
    }

    return res.status(200).json({
      success: true,
      message: `${savedExperiences.length} experiences extracted and saved`,
      experiences: savedExperiences
    });
  } catch (error) {
    console.error('Experience extraction: Parse CV error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error parsing CV',
      error: error.message
    });
  }
};

// Add a single experience manually
exports.addExperience = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      organization,
      experienceType,
      positionTitle,
      startDate,
      endDate,
      isCurrent,
      country,
      state,
      participationFrequency,
      setting,
      focusArea,
      description
    } = req.body;

    // Validate required fields
    if (!organization || !experienceType || !positionTitle || !startDate || !country || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create new experience
    const experience = new Experience({
      userId,
      organization,
      experienceType,
      positionTitle,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      isCurrent: isCurrent || false,
      country,
      state,
      participationFrequency,
      setting,
      focusArea,
      description,
      isComplete: true
    });

    // Save to database
    await experience.save();

    // Update user's application progress
    await updateUserProgress(userId);

    return res.status(201).json({
      success: true,
      message: 'Experience added successfully',
      experience
    });
  } catch (error) {
    console.error('Add experience error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding experience',
      error: error.message
    });
  }
};

// Update an experience
exports.updateExperience = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const experienceId = req.params.id;
    const updateData = req.body;

    // Find the experience
    const experience = await Experience.findOne({ _id: experienceId, userId });
    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'userId' && key !== '_id') {
        if (key === 'startDate' || key === 'endDate') {
          experience[key] = updateData[key] ? new Date(updateData[key]) : null;
        } else {
          experience[key] = updateData[key];
        }
      }
    });

    // Save updated experience
    await experience.save();

    return res.status(200).json({
      success: true,
      message: 'Experience updated successfully',
      experience
    });
  } catch (error) {
    console.error('Update experience error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating experience',
      error: error.message
    });
  }
};

// Delete an experience
exports.deleteExperience = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const experienceId = req.params.id;

    // Find and delete the experience
    const experience = await Experience.findOneAndDelete({ _id: experienceId, userId });
    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found'
      });
    }

    // Update user's application progress
    await updateUserProgress(userId);

    return res.status(200).json({
      success: true,
      message: 'Experience deleted successfully'
    });
  } catch (error) {
    console.error('Delete experience error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting experience',
      error: error.message
    });
  }
};

// Mark experiences as most meaningful
exports.setMostMeaningful = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { experienceIds } = req.body;

    // Validate input
    if (!experienceIds || !Array.isArray(experienceIds)) {
      return res.status(400).json({
        success: false,
        message: 'Experience IDs must be provided as an array'
      });
    }

    // Set most meaningful experiences
    await Experience.setMostMeaningful(userId, experienceIds);

    // Get updated experiences
    const experiences = await Experience.find({ userId });

    return res.status(200).json({
      success: true,
      message: 'Most meaningful experiences updated successfully',
      experiences
    });
  } catch (error) {
    console.error('Set most meaningful error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating most meaningful experiences',
      error: error.message
    });
  }
};

// Generate expanded description for a most meaningful experience
exports.generateExpandedDescription = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const experienceId = req.params.id;

    // Find the experience
    const experience = await Experience.findOne({ _id: experienceId, userId });
    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found'
      });
    }

    // Check if it's marked as most meaningful
    if (!experience.isMostMeaningful) {
      return res.status(400).json({
        success: false,
        message: 'Only most meaningful experiences can have expanded descriptions'
      });
    }

    // Generate expanded description
    const expandedDescription = await generateExpandedDescription(experience);

    // Update experience with expanded description
    experience.expandedDescription = expandedDescription;
    await experience.save();

    return res.status(200).json({
      success: true,
      message: 'Expanded description generated successfully',
      expandedDescription,
      experience
    });
  } catch (error) {
    console.error('Generate expanded description error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating expanded description',
      error: error.message
    });
  }
};

// Helper function to update user's application progress
const updateUserProgress = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Check completion of other sections
    const personalStatementComplete = await PersonalStatement.exists({ userId, isComplete: true });
    const researchComplete = await ResearchProduct.exists({ userId, isComplete: true });
    const miscComplete = await MiscellaneousQuestion.exists({ userId, isComplete: true });
    const programPrefsComplete = await ProgramPreference.exists({ userId, isComplete: true });

    // Check that at least one experience has been marked as most meaningful
    const experiencesCount = await Experience.countDocuments({ userId });
    const mostMeaningfulCount = await Experience.countDocuments({ userId, isMostMeaningful: true });

    // Experiences are complete if there are experiences and at least one is most meaningful
    const experiencesComplete = experiencesCount > 0 && mostMeaningfulCount > 0;
    
    // Count completed sections
    let completedSections = experiencesComplete ? 1 : 0;
    if (personalStatementComplete) completedSections++;
    if (researchComplete) completedSections++;
    if (miscComplete) completedSections++;
    if (programPrefsComplete) completedSections++;

    // Update user's progress
    user.calculateProgress(completedSections);
    await user.save();
  } catch (error) {
    console.error('Update user progress error:', error);
  }
};

// Bulk save multiple experiences
exports.saveMultipleExperiences = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { experiences } = req.body;

    if (!experiences || !Array.isArray(experiences)) {
      return res.status(400).json({
        success: false,
        message: 'Experiences must be provided as an array'
      });
    }

    console.log(`Experience controller: Saving ${experiences.length} experiences for user ${userId}`);

    const savedExperiences = [];
    for (const exp of experiences) {
      try {
        const startDate = exp.startDate ? new Date(exp.startDate) : new Date();
        const endDate = exp.endDate && exp.endDate !== 'Current' ? new Date(exp.endDate) : null;
        const isCurrent = !endDate || exp.endDate === 'Current';

        const newExperience = new Experience({
          userId,
          organization: exp.organization || 'Not specified',
          experienceType: exp.experienceType || 'Not specified',
          positionTitle: exp.positionTitle || 'Not specified',
          startDate,
          endDate,
          isCurrent,
          country: exp.country || 'Not specified',
          state: exp.state || 'Not specified',
          participationFrequency: exp.participationFrequency || 'Not specified',
          setting: exp.setting || 'Not specified',
          focusArea: exp.focusArea || 'Not specified',
          description: exp.description || 'Not specified',
          isComplete: true
        });

        await newExperience.save();
        savedExperiences.push(newExperience);
      } catch (saveError) {
        console.error('Error saving experience:', saveError);
      }
    }

    // Update user's application progress
    try {
      await updateUserProgress(userId);
    } catch (progressError) {
      console.error('Error updating user progress:', progressError);
    }

    return res.status(201).json({
      success: true,
      message: `${savedExperiences.length} experiences saved successfully`,
      experiences: savedExperiences
    });
  } catch (error) {
    console.error('Save multiple experiences error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving experiences',
      error: error.message
    });
  }
};

// Mark individual experience as most meaningful
exports.markAsMostMeaningful = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const experienceId = req.params.id;

    console.log(`Experience controller: Marking experience ${experienceId} as most meaningful for user ${userId}`);

    // Find the experience
    const experience = await Experience.findOne({ _id: experienceId, userId });
    if (!experience) {
      return res.status(404).json({
        success: false,
        message: 'Experience not found'
      });
    }

    // Update the experience
    experience.isMostMeaningful = true;
    await experience.save();

    return res.status(200).json({
      success: true,
      message: 'Experience marked as most meaningful',
      experience
    });
  } catch (error) {
    console.error('Mark most meaningful error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error marking experience as most meaningful',
      error: error.message
    });
  }
}; 