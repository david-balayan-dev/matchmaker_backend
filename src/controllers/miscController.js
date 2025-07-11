const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const User = require('../models/User');
const PersonalStatement = require('../models/PersonalStatement');
const ResearchProduct = require('../models/ResearchProduct');
const Experience = require('../models/Experience');
const ProgramPreference = require('../models/ProgramPreference');

// Get miscellaneous questions data
exports.getMiscData = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find miscellaneous data for the user
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    
    // If no data exists, create a new entry
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
      await miscData.save();
    }

    return res.status(200).json({
      success: true,
      miscData
    });
  } catch (error) {
    console.error('Get miscellaneous data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving miscellaneous data',
      error: error.message
    });
  }
};

// Save professionalism issues
exports.saveProfessionalism = async (req, res) => {
  try {
    const userId = req.user.id;
    const { hasIssues, explanation } = req.body;

    // Validate input
    if (hasIssues === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // If has issues, explanation is required
    if (hasIssues && !explanation) {
      return res.status(400).json({
        success: false,
        message: 'Explanation is required when professionalism issues are present'
      });
    }

    // Find or create miscellaneous data
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
    }

    // Update professionalism fields
    miscData.professionalism = {
      hasIssues,
      explanation: hasIssues ? explanation : null
    };

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(200).json({
      success: true,
      message: 'Professionalism data saved successfully',
      professionalism: miscData.professionalism
    });
  } catch (error) {
    console.error('Save professionalism error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving professionalism data',
      error: error.message
    });
  }
};

// Save education information
exports.saveEducation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { undergraduate, graduate } = req.body;

    // Validate input
    if (!undergraduate && !graduate) {
      return res.status(400).json({
        success: false,
        message: 'At least one education entry is required'
      });
    }

    // Find or create miscellaneous data
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
    }

    // Update education fields
    if (undergraduate) {
      miscData.education.undergraduate = undergraduate;
    }
    
    if (graduate) {
      miscData.education.graduate = graduate;
    }

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(200).json({
      success: true,
      message: 'Education data saved successfully',
      education: miscData.education
    });
  } catch (error) {
    console.error('Save education error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving education data',
      error: error.message
    });
  }
};

// Add honor/award
exports.addHonorAward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, date, description } = req.body;

    // Validate input
    if (!title || !date || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find or create miscellaneous data
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
    }

    // Add honor/award
    miscData.honorsAwards.push({
      title,
      date: new Date(date),
      description
    });

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(201).json({
      success: true,
      message: 'Honor/Award added successfully',
      honorsAwards: miscData.honorsAwards
    });
  } catch (error) {
    console.error('Add honor/award error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding honor/award',
      error: error.message
    });
  }
};

// Update honor/award
exports.updateHonorAward = async (req, res) => {
  try {
    const userId = req.user.id;
    const honorId = req.params.id;
    const { title, date, description } = req.body;

    // Validate input
    if (!title || !date || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find miscellaneous data
    const miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      return res.status(404).json({
        success: false,
        message: 'Miscellaneous data not found'
      });
    }

    // Find honor/award by ID
    const honorIndex = miscData.honorsAwards.findIndex(
      honor => honor._id.toString() === honorId
    );

    if (honorIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Honor/Award not found'
      });
    }

    // Update honor/award
    miscData.honorsAwards[honorIndex] = {
      _id: miscData.honorsAwards[honorIndex]._id, // Preserve the ID
      title,
      date: new Date(date),
      description
    };

    // Save data
    await miscData.save();

    return res.status(200).json({
      success: true,
      message: 'Honor/Award updated successfully',
      honorsAwards: miscData.honorsAwards
    });
  } catch (error) {
    console.error('Update honor/award error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating honor/award',
      error: error.message
    });
  }
};

// Delete honor/award
exports.deleteHonorAward = async (req, res) => {
  try {
    const userId = req.user.id;
    const honorId = req.params.id;

    // Find miscellaneous data
    const miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      return res.status(404).json({
        success: false,
        message: 'Miscellaneous data not found'
      });
    }

    // Filter out the honor/award to delete
    const originalLength = miscData.honorsAwards.length;
    miscData.honorsAwards = miscData.honorsAwards.filter(
      honor => honor._id.toString() !== honorId
    );

    // Check if honor was found and deleted
    if (miscData.honorsAwards.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: 'Honor/Award not found'
      });
    }

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(200).json({
      success: true,
      message: 'Honor/Award deleted successfully',
      honorsAwards: miscData.honorsAwards
    });
  } catch (error) {
    console.error('Delete honor/award error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting honor/award',
      error: error.message
    });
  }
};

// Save impactful experience and hobbies
exports.saveImpactfulAndHobbies = async (req, res) => {
  try {
    const userId = req.user.id;
    const { impactfulExperience, hobbiesInterests } = req.body;

    // Find or create miscellaneous data
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
    }

    // Update fields if provided
    if (impactfulExperience !== undefined) {
      miscData.impactfulExperience = impactfulExperience;
    }
    
    if (hobbiesInterests !== undefined) {
      miscData.hobbiesInterests = hobbiesInterests;
    }

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(200).json({
      success: true,
      message: 'Impactful experience and hobbies data saved successfully',
      impactfulExperience: miscData.impactfulExperience,
      hobbiesInterests: miscData.hobbiesInterests
    });
  } catch (error) {
    console.error('Save impactful and hobbies error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving impactful experience and hobbies data',
      error: error.message
    });
  }
};

// Save all miscellaneous data at once
exports.saveAllMiscData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      professionalism,
      education,
      honorsAwards,
      impactfulExperience,
      hobbiesInterests
    } = req.body;

    // Validate professionalism if provided
    if (professionalism && professionalism.hasIssues && !professionalism.explanation) {
      return res.status(400).json({
        success: false,
        message: 'Explanation is required when professionalism issues are present'
      });
    }

    // Find or create miscellaneous data
    let miscData = await MiscellaneousQuestion.findOne({ userId });
    if (!miscData) {
      miscData = new MiscellaneousQuestion({ userId });
    }

    // Update fields if provided
    if (professionalism) {
      miscData.professionalism = professionalism;
    }
    
    if (education) {
      if (education.undergraduate) {
        miscData.education.undergraduate = education.undergraduate;
      }
      
      if (education.graduate) {
        miscData.education.graduate = education.graduate;
      }
    }
    
    if (honorsAwards) {
      miscData.honorsAwards = honorsAwards;
    }
    
    if (impactfulExperience !== undefined) {
      miscData.impactfulExperience = impactfulExperience;
    }
    
    if (hobbiesInterests !== undefined) {
      miscData.hobbiesInterests = hobbiesInterests;
    }

    // Save data
    await miscData.save();

    // Check for completeness
    await checkCompletion(userId, miscData);

    return res.status(200).json({
      success: true,
      message: 'All miscellaneous data saved successfully',
      miscData
    });
  } catch (error) {
    console.error('Save all misc data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving all miscellaneous data',
      error: error.message
    });
  }
};

// Helper function to check if miscellaneous section is complete and update user progress
const checkCompletion = async (userId, miscData) => {
  try {
    // Check if all required sections have data
    const hasEducation = 
      (miscData.education.undergraduate && miscData.education.undergraduate.length > 0) ||
      (miscData.education.graduate && miscData.education.graduate.length > 0);
    
    // Section is complete if has education data and professionalism is answered
    const isComplete = 
      hasEducation && 
      miscData.professionalism.hasIssues !== undefined;
    
    // Update completion status
    miscData.isComplete = isComplete;
    await miscData.save();

    // If complete, update user's application progress
    if (isComplete) {
      await updateUserProgress(userId);
    }

    return isComplete;
  } catch (error) {
    console.error('Check completion error:', error);
    return false;
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
    const experiencesComplete = await Experience.exists({ userId, isComplete: true });
    const programPrefsComplete = await ProgramPreference.exists({ userId, isComplete: true });

    // Count completed sections
    let completedSections = 1; // Misc questions are complete
    if (personalStatementComplete) completedSections++;
    if (researchComplete) completedSections++;
    if (experiencesComplete) completedSections++;
    if (programPrefsComplete) completedSections++;

    // Update user's progress
    user.calculateProgress(completedSections);
    await user.save();
  } catch (error) {
    console.error('Update user progress error:', error);
  }
}; 