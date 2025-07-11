const User = require('../models/User');
const PersonalStatement = require('../models/PersonalStatement');
const ResearchProduct = require('../models/ResearchProduct');
const Experience = require('../models/Experience');
const MiscellaneousQuestion = require('../models/MiscellaneousQuestion');
const ProgramPreference = require('../models/ProgramPreference');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

// Get application progress data for dashboard
exports.getDashboardData = async (req, res) => {
  try {
    // Debug log to see what's in the request
    console.log("Dashboard request headers:", req.headers);
    console.log("Dashboard request user:", req.user);
    
    // Check if user ID exists in request
    if (!req.user || !req.user.id) {
      console.error("No user ID found in request");
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found.'
      });
    }

    const userId = req.user.id;
    console.log("Looking up user with ID:", userId);

    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      console.error(`User with ID ${userId} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log(`User found: ${user.name || 'Unknown'}`);

    // Initialize user fields if they don't exist
    if (!user.name) {
      console.log("User has missing name field, setting default value");
      user.name = "Dr.";
      await user.save();
    }

    // Initialize applicationProgress if it doesn't exist
    if (!user.applicationProgress) {
      console.log("User has no applicationProgress, initializing");
      user.applicationProgress = {
        totalSections: 5,
        completedSections: 0,
        percentageComplete: 0
      };
      await user.save();
    }

    // Get application sections
    // Define variables here to prevent reference errors
    let personalStatement = null;
    let researchProducts = [];
    let experiences = [];
    let miscellaneous = null;
    let programPreference = null;
    
    try {
      console.log('Fetching personal statement for user:', userId);
      personalStatement = await PersonalStatement.findOne({ 
        $or: [
          { user: userId },
          { userId: userId }
        ]
      }).select('isComplete');
      console.log('Personal statement found:', personalStatement ? 'Yes' : 'No');

      console.log('Fetching research products for user:', userId);
      researchProducts = await ResearchProduct.find({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      }).select('_id isComplete');
      console.log(`Found ${researchProducts.length} research products`);

      console.log('Fetching experiences for user:', userId);
      experiences = await Experience.find({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      }).select('_id isComplete isMostMeaningful');
      console.log(`Found ${experiences.length} experiences`);

      console.log('Fetching miscellaneous questions for user:', userId);
      miscellaneous = await MiscellaneousQuestion.findOne({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      }).select('isComplete');
      console.log('Miscellaneous questions found:', miscellaneous ? 'Yes' : 'No');

      console.log('Fetching program preferences for user:', userId);
      programPreference = await ProgramPreference.findOne({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      }).select('isComplete');
      console.log('Program preferences found:', programPreference ? 'Yes' : 'No');
    } catch (fetchError) {
      console.error('Error fetching section data:', fetchError);
      // Continue with empty/default values if data fetch fails
    }

    // Debug section data
    console.log("Sections found:", {
      personalStatement: personalStatement ? true : false,
      researchProducts: researchProducts.length,
      experiences: experiences.length,
      miscellaneous: miscellaneous ? true : false,
      programPreference: programPreference ? true : false
    });

    // Calculate section completion
    const sectionsStatus = {
      personalStatement: {
        isComplete: personalStatement ? personalStatement.isComplete : false,
        status: personalStatement ? (personalStatement.isComplete ? 'Completed' : 'Not Started') : 'Not Started'
      },
      researchProducts: {
        isComplete: researchProducts.length > 0 && researchProducts.every(product => product.isComplete),
        count: researchProducts.length,
        status: researchProducts.length > 0 
          ? (researchProducts.every(product => product.isComplete) ? 'Completed' : 'In Progress') 
          : 'Not Started'
      },
      experiences: {
        isComplete: experiences.length > 0 && experiences.every(exp => exp.isComplete),
        count: experiences.length,
        mostMeaningfulCount: experiences.filter(exp => exp.isMostMeaningful).length,
        status: experiences.length > 0 
          ? (experiences.every(exp => exp.isComplete) ? 'Completed' : 'In Progress') 
          : 'Not Started'
      },
      miscellaneous: {
        isComplete: miscellaneous ? miscellaneous.isComplete : false,
        status: miscellaneous ? (miscellaneous.isComplete ? 'Completed' : 'In Progress') : 'Not Started'
      },
      programPreference: {
        isComplete: programPreference ? programPreference.isComplete : false,
        status: programPreference ? (programPreference.isComplete ? 'Completed' : 'In Progress') : 'Not Started'
      }
    };

    // Calculate completed sections
    const totalSections = 5; // Personal Statement, Research, Experiences, Misc, Program Prefs
    let completedSections = 0;

    if (sectionsStatus.personalStatement.isComplete) completedSections++;
    if (sectionsStatus.researchProducts.isComplete) completedSections++;
    if (sectionsStatus.experiences.isComplete) completedSections++;
    if (sectionsStatus.miscellaneous.isComplete) completedSections++;
    if (sectionsStatus.programPreference.isComplete) completedSections++;

    // Calculate percentage
    const percentageComplete = Math.round((completedSections / totalSections) * 100);

    // Update user's progress
    user.applicationProgress = {
      totalSections,
      completedSections,
      percentageComplete
    };
    await user.save();
    
    console.log("Dashboard data retrieved successfully");

    return res.status(200).json({
      success: true,
      dashboard: {
        user: {
          name: user.name || "Dr.",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          phone: user.phone || "",
          medicalSchool: user.demographics?.medicalSchool || "",
          profileImage: user.profileImage || "",
          specialty: user.specialty || "",
          university: user.university || "",
          graduationYear: user.graduationYear || ""
        },
        progress: {
          totalSections,
          completedSections,
          percentageComplete
        },
        sections: sectionsStatus
      }
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard data',
      error: error.message
    });
  }
};

// Check if the application is ready for program recommendations
exports.checkApplicationReadiness = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user progress
    const user = await User.findById(userId).select('applicationProgress');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize applicationProgress if it doesn't exist
    if (!user.applicationProgress) {
      // Set default values for applicationProgress
      user.applicationProgress = {
        totalSections: 5,
        completedSections: 0,
        percentageComplete: 0
      };
      
      // Save the updated user
      await user.save();
    }

    // Check if application is at least 85% complete
    const percentageComplete = user.applicationProgress.percentageComplete || 0;
    const isReady = percentageComplete >= 85;

    return res.status(200).json({
      success: true,
      isReady,
      percentageComplete
    });
  } catch (error) {
    console.error('Application readiness check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking application readiness',
      error: error.message
    });
  }
};

// Update section progress
exports.updateSectionProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sectionName } = req.params;
    const { isComplete } = req.body;

    if (isComplete === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isComplete status is required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update the appropriate section based on sectionName
    let updatedModel = null;
    switch (sectionName) {
      case 'personalStatement':
        // Extra logging for personal statement updates
        console.log(`Updating personal statement for user ${userId} to isComplete=${isComplete}`);
        
        // Force create or update the personal statement
        updatedModel = await PersonalStatement.findOneAndUpdate(
          { user: userId },
          { 
            isComplete,
            // Add a timestamp to ensure the document is actually updated
            lastUpdated: new Date()
          },
          { 
            new: true, 
            upsert: true, 
            // Use runValidators to ensure schema validation runs
            runValidators: true,
            // Set all fields if this is a new document
            setDefaultsOnInsert: true 
          }
        );
        
        console.log("Personal statement update result:", updatedModel);
        break;

      case 'researchProducts':
        // For research products, we'll update all products for this user
        const research = await ResearchProduct.updateMany(
          { userId },
          { isComplete }
        );
        updatedModel = research;
        break;

      case 'experiences':
        // For experiences, we'll update all experiences for this user
        const experiences = await Experience.updateMany(
          { userId },
          { isComplete }
        );
        updatedModel = experiences;
        break;

      case 'miscellaneous':
        updatedModel = await MiscellaneousQuestion.findOneAndUpdate(
          { userId },
          { isComplete },
          { new: true, upsert: true }
        );
        break;

      case 'programPreference':
        updatedModel = await ProgramPreference.findOneAndUpdate(
          { userId },
          { isComplete },
          { new: true, upsert: true }
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid section name'
        });
    }

    // Recalculate dashboard data after update
    // Get application sections
    const personalStatement = await PersonalStatement.findOne({ user: userId }).select('isComplete');
    const researchProducts = await ResearchProduct.find({ userId }).select('_id isComplete');
    const experiences = await Experience.find({ userId }).select('_id isComplete isMostMeaningful');
    const miscellaneous = await MiscellaneousQuestion.findOne({ userId }).select('isComplete');
    const programPreference = await ProgramPreference.findOne({ userId }).select('isComplete');

    // Calculate section completion
    const sectionsStatus = {
      personalStatement: {
        isComplete: personalStatement ? personalStatement.isComplete : false,
        status: personalStatement ? (personalStatement.isComplete ? 'Completed' : 'Not Started') : 'Not Started'
      },
      researchProducts: {
        isComplete: researchProducts.length > 0 && researchProducts.every(product => product.isComplete),
        count: researchProducts.length,
        status: researchProducts.length > 0 
          ? (researchProducts.every(product => product.isComplete) ? 'Completed' : 'In Progress') 
          : 'Not Started'
      },
      experiences: {
        isComplete: experiences.length > 0 && experiences.every(exp => exp.isComplete),
        count: experiences.length,
        mostMeaningfulCount: experiences.filter(exp => exp.isMostMeaningful).length,
        status: experiences.length > 0 
          ? (experiences.every(exp => exp.isComplete) ? 'Completed' : 'In Progress') 
          : 'Not Started'
      },
      miscellaneous: {
        isComplete: miscellaneous ? miscellaneous.isComplete : false,
        status: miscellaneous ? (miscellaneous.isComplete ? 'Completed' : 'In Progress') : 'Not Started'
      },
      programPreference: {
        isComplete: programPreference ? programPreference.isComplete : false,
        status: programPreference ? (programPreference.isComplete ? 'Completed' : 'In Progress') : 'Not Started'
      }
    };

    // Calculate completed sections
    const totalSections = 5; // Personal Statement, Research, Experiences, Misc, Program Prefs
    let completedSections = 0;

    if (sectionsStatus.personalStatement.isComplete) completedSections++;
    if (sectionsStatus.researchProducts.isComplete) completedSections++;
    if (sectionsStatus.experiences.isComplete) completedSections++;
    if (sectionsStatus.miscellaneous.isComplete) completedSections++;
    if (sectionsStatus.programPreference.isComplete) completedSections++;

    // Calculate percentage
    const percentageComplete = Math.round((completedSections / totalSections) * 100);

    // Update user's progress
    user.applicationProgress = {
      totalSections,
      completedSections,
      percentageComplete
    };
    await user.save();

    return res.status(200).json({
      success: true,
      message: `${sectionName} section updated successfully`,
      dashboard: {
        user: {
          name: user.name || "Dr.",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          phone: user.phone || "",
          medicalSchool: user.demographics?.medicalSchool || "",
          profileImage: user.profileImage || "",
          specialty: user.specialty || "",
          university: user.university || "",
          graduationYear: user.graduationYear || ""
        },
        progress: {
          totalSections,
          completedSections,
          percentageComplete
        },
        sections: sectionsStatus
      }
    });
  } catch (error) {
    console.error('Update section progress error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating section progress',
      error: error.message
    });
  }
};

// @desc    Generate and download user data PDF
// @route   GET /api/dashboard/download-pdf
// @access  Private
exports.generateUserDataPdf = async (req, res) => {
  try {
    // Get user ID from request with better error handling
    let userId;
    
    // Check if req.user exists and has id property
    if (req.user && req.user.id) {
      userId = req.user.id;
      console.log('User ID from req.user:', userId);
    } else if (req.user && req.user._id) {
      // Sometimes Mongoose populates _id instead of id
      userId = req.user._id;
      console.log('User ID from req.user._id:', userId);
    } else if (req.headers.authorization) {
      // If req.user is not set but we have authorization header, try to extract user ID from token
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        
        if (!token) {
          throw new Error('No token found in authorization header');
        }
        
        // Verify and decode token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || (!decoded.id && !decoded._id)) {
          throw new Error('Invalid token structure - no user ID found');
        }
        
        userId = decoded.id || decoded._id;
        console.log('User ID extracted from token:', userId);
      } catch (tokenError) {
        console.error('Token verification failed:', tokenError.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token: ' + tokenError.message
        });
      }
    }
    
    // If we still don't have a user ID, return an error
    if (!userId) {
      console.error('User ID not found in request or token');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }
    
    console.log('Generating PDF for user:', userId);

    // Get user data
    console.log('Finding user with ID:', userId);
    const user = await User.findById(userId);

    if (!user) {
      console.error(`User with ID ${userId} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`Found user: ${user.firstName || ''} ${user.lastName || ''} (${user.email || 'no email'})`);

    // Define document data variables
    let personalStatement = null;
    let researchProducts = [];
    let experiences = [];
    let miscellaneous = null;
    let programPreference = null;
    
    // Fetch additional user data
    try {
      console.log('Fetching personal statement data...');
      personalStatement = await PersonalStatement.findOne({ 
        $or: [
          { user: userId },
          { userId: userId }
        ]
      });
      
      console.log('Fetching research products...');
      researchProducts = await ResearchProduct.find({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      });
      
      console.log('Fetching experiences...');
      experiences = await Experience.find({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      });
      
      console.log('Fetching miscellaneous questions...');
      miscellaneous = await MiscellaneousQuestion.findOne({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      });
      
      console.log('Fetching program preferences...');
      programPreference = await ProgramPreference.findOne({ 
        $or: [
          { userId: userId },
          { user: userId }
        ]
      });
    } catch (fetchError) {
      console.error('Error fetching additional data:', fetchError);
      // Continue with empty/default values
    }

    // Import PDFKit directly here to avoid reference issues
    const PDFKit = require('pdfkit');
    const doc = new PDFKit({
      size: 'LETTER',
      margins: { top: 50, left: 50, right: 50, bottom: 50 },
      bufferPages: true
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=MatchMaker_${user.firstName || 'User'}_${user.lastName || ''}_Data.pdf`);
    
    // Pipe to response
    doc.pipe(res);
    
    // Helper function to add section titles
    const addSectionTitle = (title) => {
      doc.font('Helvetica-Bold')
         .fontSize(16)
         .fillColor('#2d6a8e')
         .text(title, { underline: true })
         .moveDown(0.5);
    };
    
    // Helper function to add fields
    const addField = (label, value) => {
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('black')
         .text(label + ':', { continued: true })
         .font('Helvetica')
         .text(' ' + (value || 'Not specified'))
         .moveDown(0.2);
    };

    // Add header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#2d6a8e')
       .text('MATCHMAKER USER DATA', { align: 'center' })
       .moveDown();

    // Add user information section
    addSectionTitle('User Information');
    addField('Name', `${user.firstName || ''} ${user.lastName || ''}`);
    addField('Email', user.email);
    addField('Phone', user.phoneNumber);
    addField('Specialty', user.specialty);
    addField('Medical School', user.medicalSchool || user.university);
    addField('Graduation Year', user.graduationYear);
    doc.moveDown();

    // Add personal statement section
    if (personalStatement) {
      addSectionTitle('Personal Statement');
      
      if (personalStatement.specialties && personalStatement.specialties.length > 0) {
        addField('Specialties', personalStatement.specialties.join(', '));
      }
      
      if (personalStatement.selectedThesis || personalStatement.selectedThesisStatement) {
        const thesis = personalStatement.selectedThesis || personalStatement.selectedThesisStatement;
        addField('Thesis', thesis);
      }
      
      if (personalStatement.personalStatement || personalStatement.finalStatement) {
        const statement = personalStatement.personalStatement || personalStatement.finalStatement;
        doc.font('Helvetica')
           .fontSize(12)
           .fillColor('black')
           .text(statement, {
             align: 'left',
             columns: 1,
             lineGap: 2
           });
      }
      doc.moveDown();
    }
    
    // Add research products section
    if (researchProducts && researchProducts.length > 0) {
      addSectionTitle('Research Products');
      
      researchProducts.forEach((product, index) => {
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text(`${index + 1}. ${product.title || 'Untitled'}`, { underline: true });
        
        addField('Type', product.type);
        addField('Status', product.status);
        
        if (product.authors) {
          addField('Authors', product.authors);
        }
        
        if (product.journal) {
          let journalText = product.journal;
          if (product.volume) journalText += `, Vol. ${product.volume}`;
          if (product.issueNumber) journalText += `, Issue ${product.issueNumber}`;
          if (product.pages) journalText += `, pp. ${product.pages}`;
          addField('Journal', journalText);
        }
        
        if (product.pmid) {
          addField('PMID', product.pmid);
        }
        
        if (product.monthPublished || product.yearPublished) {
          let dateText = '';
          if (product.monthPublished) dateText += `${product.monthPublished} `;
          if (product.yearPublished) dateText += product.yearPublished;
          addField('Published', dateText);
        }
        
        doc.moveDown();
      });
    }
    
    // Add experiences section
    if (experiences && experiences.length > 0) {
      addSectionTitle('Experiences');
      
      // Find meaningful experiences
      const meaningfulExperiences = experiences.filter(exp => exp.isMostMeaningful);
      if (meaningfulExperiences.length > 0) {
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .text('Most Meaningful Experiences', { underline: true });
        
        meaningfulExperiences.forEach((exp, index) => {
          doc.font('Helvetica-Bold')
             .fontSize(12)
             .text(`${index + 1}. ${exp.organization} – ${exp.positionTitle}`);
          
          const dateText = `${exp.startDate} - ${exp.isCurrent ? 'Present' : exp.endDate}`;
          doc.font('Helvetica')
             .fontSize(10)
             .text(dateText);
          
          if (exp.description) {
            doc.font('Helvetica')
               .fontSize(11)
               .text(exp.description);
          }
          
          doc.moveDown();
        });
      }
      
      // All other experiences
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .text('Additional Experiences');
      
      experiences
        .filter(exp => !exp.isMostMeaningful)
        .forEach((exp, index) => {
          doc.font('Helvetica-Bold')
             .fontSize(12)
             .text(`${index + 1}. ${exp.organization} – ${exp.positionTitle}`);
          
          const dateText = `${exp.startDate} - ${exp.isCurrent ? 'Present' : exp.endDate}`;
          doc.font('Helvetica')
             .fontSize(10)
             .text(dateText);
          
          if (exp.experienceType) {
            addField('Type', exp.experienceType);
          }
          
          if (exp.setting) {
            addField('Setting', exp.setting);
          }
          
          if (exp.description) {
            doc.font('Helvetica')
               .fontSize(11)
               .text(exp.description);
          }
          
          doc.moveDown();
        });
      
      doc.moveDown();
    }
    
    // Add miscellaneous section
    if (miscellaneous) {
      addSectionTitle('Miscellaneous Information');
      
      if (miscellaneous.professionalism && miscellaneous.professionalism.hasIssues) {
        addField('Professionalism Issues', miscellaneous.professionalism.explanation || 'Yes');
      }
      
      // Education
      if (miscellaneous.education) {
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .text('Education');
        
        if (miscellaneous.education.undergraduate && miscellaneous.education.undergraduate.length > 0) {
          doc.font('Helvetica-Bold')
             .fontSize(12)
             .text('Undergraduate:');
          
          miscellaneous.education.undergraduate.forEach(edu => {
            doc.font('Helvetica')
               .fontSize(11)
               .text(`• ${edu.school}, ${edu.fieldOfStudy}, ${edu.startDate}-${edu.endDate}`);
          });
          doc.moveDown(0.5);
        }
        
        if (miscellaneous.education.graduate && miscellaneous.education.graduate.length > 0) {
          doc.font('Helvetica-Bold')
             .fontSize(12)
             .text('Graduate:');
          
          miscellaneous.education.graduate.forEach(edu => {
            doc.font('Helvetica')
               .fontSize(11)
               .text(`• ${edu.school}, ${edu.fieldOfStudy}, ${edu.startDate}-${edu.endDate}`);
          });
          doc.moveDown(0.5);
        }
      }
      
      // Honors and Awards
      if (miscellaneous.honorsAwards && miscellaneous.honorsAwards.length > 0) {
        doc.font('Helvetica-Bold')
           .fontSize(14)
           .text('Honors and Awards');
        
        miscellaneous.honorsAwards.forEach((award, index) => {
          doc.font('Helvetica-Bold')
             .fontSize(11)
             .text(`${index + 1}. ${award.title}`);
          
          if (award.date) {
            doc.font('Helvetica')
               .fontSize(10)
               .text(`Date: ${award.date}`);
          }
          
          if (award.description) {
            doc.font('Helvetica')
               .fontSize(10)
               .text(award.description);
          }
          
          doc.moveDown(0.5);
        });
      }
      
      if (miscellaneous.impactfulExperience) {
        addField('Most Impactful Experience', miscellaneous.impactfulExperience);
      }
      
      if (miscellaneous.hobbiesInterests) {
        addField('Hobbies and Interests', miscellaneous.hobbiesInterests);
      }
      
      doc.moveDown();
    }
    
    // Add program preferences section
    if (programPreference) {
      addSectionTitle('Program Preferences');
      
      addField('Primary Specialty', programPreference.primarySpecialty);
      
      if (programPreference.otherSpecialties && programPreference.otherSpecialties.length > 0) {
        addField('Other Specialties', programPreference.otherSpecialties.join(', '));
      }
      
      if (programPreference.preferredStates && programPreference.preferredStates.length > 0) {
        addField('Preferred States', programPreference.preferredStates.join(', '));
      }
      
      addField('Hospital Preference', programPreference.hospitalPreference);
      addField('Resident Count Preference', programPreference.residentCountPreference);
      
      if (programPreference.valuedCharacteristics && programPreference.valuedCharacteristics.length > 0) {
        addField('Valued Characteristics', programPreference.valuedCharacteristics.join(', '));
      }
      
      doc.moveDown();
    }
    
    // Add footer with page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      
      // Add footer text at the bottom of the page
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor('#666666')
         .text(
           `Generated by MatchMaker on ${new Date().toLocaleDateString()} | Page ${i + 1} of ${totalPages}`,
           50,
           doc.page.height - 30,
           { align: 'center', width: doc.page.width - 100 }
         );
    }
    
    // Finalize PDF file
    doc.end();
    
    console.log('PDF generation completed successfully');
    
    // Note: We don't need to send a response here as the PDF is piped directly to res
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating PDF',
        error: error.message
      });
    } else {
      // If headers were already sent, we need to end the response
      res.end();
    }
  }
}; 