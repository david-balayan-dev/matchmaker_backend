const mongoose = require('mongoose');

const PersonalStatementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    specialties: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      default: ''
    },
    characteristics: {
      type: [String],
      default: []
    },
    experiences: {
      type: [String],
      default: []
    },
    selectedThesis: {
      type: String,
      default: ''
    },
    thesisStatements: {
      type: [String],
      default: []
    },
    personalStatement: {
      type: String,
      default: ''
    },
    isComplete: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Validator for complete personal statements only
PersonalStatementSchema.pre('save', function(next) {
  // Only validate if isComplete is true and this is a full document (not just an update)
  if (this.isComplete && this.isNew) {
    // Check required fields
    if (!this.specialties.length || !this.reason || 
        !this.characteristics.length || !this.experiences.length ||
        !this.selectedThesis || !this.thesisStatements.length || 
        !this.personalStatement) {
      return next(new Error('Cannot mark as complete: Missing required fields'));
    }
    
    // Validate arrays if present
    if (this.characteristics.length > 0 && this.characteristics.length !== 3) {
      return next(new Error('Must select exactly 3 characteristics'));
    }
    if (this.experiences.length > 0 && this.experiences.length !== 3) {
      return next(new Error('Must have exactly 3 experiences'));
    }
  }
  next();
});

module.exports = mongoose.model('PersonalStatement', PersonalStatementSchema); 