const PersonalStatement = require('../models/PersonalStatement');
const User = require('../models/User');
const ResearchProduct = require('../models/ResearchProduct');
const Experience = require('../models/Experience');
const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const ProgramPreference = require('../models/ProgramPreference');
const { generateThesisStatements, generateFinalStatement } = require('../services/personalStatementService');
const { generatePersonalStatementPDF } = require('../services/pdfService');

// Get personal statement data
exports.getPersonalStatement = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find personal statement for the user
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: personalStatement
    });
  } catch (error) {
    console.error('Error retrieving personal statement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving personal statement'
    });
  }
};

// Save initial personal statement data
exports.savePersonalStatementData = async (req, res) => {
  try {
    const userId = req.user._id;
    const { specialties, motivation, characteristics, characteristicStories } = req.body;

    // Validate input
    if (!specialties || !specialties.length || !motivation || !characteristics || !characteristics.length || !characteristicStories) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if characteristics and stories match
    if (characteristics.length !== characteristicStories.length) {
      return res.status(400).json({
        success: false,
        message: 'Number of characteristics and stories must match'
      });
    }

    // Check if user already has a personal statement
    let personalStatement = await PersonalStatement.findOne({ user: userId });
    
    if (personalStatement) {
      // Update existing personal statement
      personalStatement.specialties = specialties;
      personalStatement.motivation = motivation;
      personalStatement.characteristics = characteristics;
      personalStatement.characteristicStories = characteristicStories;
    } else {
      // Create new personal statement
      personalStatement = new PersonalStatement({
        user: userId,
        specialties,
        motivation,
        characteristics,
        characteristicStories
      });
    }

    // Save personal statement
    await personalStatement.save();

    return res.status(200).json({
      success: true,
      message: 'Personal statement data saved successfully',
      data: personalStatement
    });
  } catch (error) {
    console.error('Error saving personal statement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error saving personal statement'
    });
  }
};

// Generate thesis statements
exports.generateThesisStatements = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get personal statement data
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }

    // Check if required fields are available
    if (!personalStatement.specialties.length || !personalStatement.motivation || 
        !personalStatement.characteristics.length || !personalStatement.characteristicStories.length) {
      return res.status(400).json({
        success: false,
        message: 'Personal statement data incomplete'
      });
    }

    // Generate thesis statements
    const thesisStatements = await generateThesisStatements(
      personalStatement.specialties,
      personalStatement.motivation,
      personalStatement.characteristics,
      personalStatement.characteristicStories
    );

    // Update personal statement with thesis statements
    personalStatement.thesisStatements = thesisStatements;
    await personalStatement.save();

    return res.status(200).json({
      success: true,
      message: 'Thesis statements generated successfully',
      thesisStatements
    });
  } catch (error) {
    console.error('Generate thesis statements error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating thesis statements',
      error: error.message
    });
  }
};

// Save selected thesis statement
exports.saveSelectedThesis = async (req, res) => {
  try {
    const userId = req.user._id;
    const { selectedThesisStatement } = req.body;

    // Validate input
    if (!selectedThesisStatement) {
      return res.status(400).json({
        success: false,
        message: 'Selected thesis statement is required'
      });
    }

    // Get personal statement data
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }

    // Check if the selected thesis is one of the generated ones
    if (personalStatement.thesisStatements.length > 0 && 
        !personalStatement.thesisStatements.includes(selectedThesisStatement)) {
      return res.status(400).json({
        success: false,
        message: 'Selected thesis statement is not one of the generated options'
      });
    }

    // Update personal statement with selected thesis
    personalStatement.selectedThesisStatement = selectedThesisStatement;
    await personalStatement.save();

    return res.status(200).json({
      success: true,
      message: 'Thesis statement selected successfully',
      selectedThesisStatement
    });
  } catch (error) {
    console.error('Save selected thesis error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving selected thesis',
      error: error.message
    });
  }
};

// Generate final personal statement
exports.generateFinalStatement = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get personal statement data
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }

    // Check if a thesis statement has been selected
    if (!personalStatement.selectedThesisStatement) {
      return res.status(400).json({
        success: false,
        message: 'No thesis statement selected'
      });
    }

    // Generate final statement
    const { finalStatement, wordCount } = await generateFinalStatement(
      personalStatement.specialties,
      personalStatement.motivation,
      personalStatement.characteristics,
      personalStatement.characteristicStories,
      personalStatement.selectedThesisStatement
    );

    // Update personal statement with final statement
    personalStatement.finalStatement = finalStatement;
    personalStatement.wordCount = wordCount;
    personalStatement.isComplete = true;
    await personalStatement.save();

    // Update user's application progress
    await updateUserProgress(userId);

    return res.status(200).json({
      success: true,
      message: 'Final personal statement generated successfully',
      finalStatement,
      wordCount
    });
  } catch (error) {
    console.error('Generate final statement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating final statement',
      error: error.message
    });
  }
};

// Save final personal statement (if user wants to edit the generated one)
exports.saveFinalStatement = async (req, res) => {
  try {
    const userId = req.user._id;
    const { finalStatement } = req.body;

    // Validate input
    if (!finalStatement) {
      return res.status(400).json({
        success: false,
        message: 'Final statement is required'
      });
    }

    // Get personal statement data
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }

    // Calculate word count
    const wordCount = finalStatement.split(/\s+/).length;

    // Update personal statement with final statement
    personalStatement.finalStatement = finalStatement;
    personalStatement.wordCount = wordCount;
    personalStatement.isComplete = true;
    await personalStatement.save();

    // Update user's application progress
    await updateUserProgress(userId);

    return res.status(200).json({
      success: true,
      message: 'Final personal statement saved successfully',
      finalStatement,
      wordCount
    });
  } catch (error) {
    console.error('Save final statement error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error saving final statement',
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
    const researchComplete = await ResearchProduct.exists({ userId, isComplete: true });
    const experiencesComplete = await Experience.exists({ userId, isComplete: true });
    const miscComplete = await MiscellaneousQuestion.exists({ userId, isComplete: true });
    const programPrefsComplete = await ProgramPreference.exists({ userId, isComplete: true });

    // Count completed sections
    let completedSections = 1; // Personal statement is complete
    if (researchComplete) completedSections++;
    if (experiencesComplete) completedSections++;
    if (miscComplete) completedSections++;
    if (programPrefsComplete) completedSections++;

    // Update user's progress
    user.calculateProgress(completedSections);
    await user.save();
  } catch (error) {
    console.error('Update user progress error:', error);
  }
};

/**
 * Save a personal statement
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.savePersonalStatement = async (req, res) => {
  try {
    const { 
      specialties, 
      reason, 
      characteristics, 
      experiences,
      selectedThesis,
      thesisStatements, 
      personalStatement 
    } = req.body;
    
    // Validate required fields
    if (!specialties || !reason || !characteristics || !experiences || 
        !selectedThesis || !thesisStatements || !personalStatement) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Get user ID from authenticated request
    const userId = req.user._id;
    
    // Check if user already has a personal statement
    let userPersonalStatement = await PersonalStatement.findOne({ user: userId });
    
    if (userPersonalStatement) {
      // Update existing personal statement
      userPersonalStatement.specialties = specialties;
      userPersonalStatement.reason = reason;
      userPersonalStatement.characteristics = characteristics;
      userPersonalStatement.experiences = experiences;
      userPersonalStatement.selectedThesis = selectedThesis;
      userPersonalStatement.thesisStatements = thesisStatements;
      userPersonalStatement.personalStatement = personalStatement;
      
      await userPersonalStatement.save();
    } else {
      // Create new personal statement
      userPersonalStatement = await PersonalStatement.create({
        user: userId,
        specialties,
        reason,
        characteristics,
        experiences,
        selectedThesis,
        thesisStatements,
        personalStatement
      });
    }
    
    // Update the dashboard section status (assuming you have a Dashboard model)
    // This is optional based on your application's architecture
    try {
      // Import dashboard model/controller functions here if needed
      // await updateDashboardSection(userId, 'personalStatement', true);
    } catch (dashboardError) {
      console.error('Error updating dashboard status:', dashboardError);
      // Continue execution, don't return error response
    }
    
    res.status(200).json({
      success: true,
      data: userPersonalStatement
    });
  } catch (error) {
    console.error('Error saving personal statement:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error saving personal statement'
    });
  }
};

/**
 * Download personal statement as PDF
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.downloadPersonalStatementPDF = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get personal statement data
    const personalStatement = await PersonalStatement.findOne({ user: userId });
    if (!personalStatement) {
      return res.status(404).json({
        success: false,
        message: 'Personal statement not found'
      });
    }
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=personal-statement-${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Format the data for the PDF generator
    const pdfData = {
      specialties: personalStatement.specialties || [],
      selectedThesis: personalStatement.selectedThesis || personalStatement.selectedThesisStatement || '',
      personalStatement: personalStatement.personalStatement || personalStatement.finalStatement || ''
    };
    
    console.log('PDF Data being sent to generator:', JSON.stringify(pdfData, null, 2));
    
    // Generate PDF and stream directly to response
    await generatePersonalStatementPDF(pdfData, res);
    
    // The response will be handled by the PDF generator
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating PDF'
    });
  }
};

// Direct completion method - ensures personal statement can be marked complete
exports.completePersonalStatement = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`[completePersonalStatement] Starting direct completion for user ${userId}`);
    
    // Find or create a personal statement document
    let personalStatement = await PersonalStatement.findOne({ user: userId });
    
    if (!personalStatement) {
      console.log(`[completePersonalStatement] No personal statement found, creating a base document for ${userId}`);
      personalStatement = new PersonalStatement({
        user: userId,
        isComplete: true,
        lastUpdated: new Date()
      });
    } else {
      console.log(`[completePersonalStatement] Existing personal statement found for ${userId}, marking as complete`);
      personalStatement.isComplete = true;
      personalStatement.lastUpdated = new Date();
    }
    
    // Save with validation bypassed if necessary
    try {
      await personalStatement.save();
      console.log(`[completePersonalStatement] Personal statement saved as complete for ${userId}`);
    } catch (saveError) {
      console.warn(`[completePersonalStatement] Error with standard save, using bypass method: ${saveError.message}`);
      
      // Use findOneAndUpdate as a fallback with validation bypassed
      await PersonalStatement.findOneAndUpdate(
        { user: userId },
        { 
          $set: { 
            isComplete: true,
            lastUpdated: new Date()
          }
        },
        { 
          new: true, 
          upsert: true,
          runValidators: false // Skip validation
        }
      );
      console.log(`[completePersonalStatement] Used bypass method to mark as complete for ${userId}`);
    }
    
    // Update the user progress
    await updateUserProgress(userId);
    console.log(`[completePersonalStatement] User progress updated for ${userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Personal statement successfully marked as complete'
    });
    
  } catch (error) {
    console.error('Error completing personal statement:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error completing personal statement'
    });
  }
}; 