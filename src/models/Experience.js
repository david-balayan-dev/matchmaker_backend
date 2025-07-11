const mongoose = require('mongoose');

const ExperienceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: String,
    required: true
  },
  experienceType: {
    type: String,
    required: true
  },
  positionTitle: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    default: null
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  country: {
    type: String,
    required: true
  },
  state: {
    type: String,
    default: null
  },
  participationFrequency: {
    type: String,
    required: true
  },
  setting: {
    type: String,
    required: true
  },
  focusArea: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 750
  },
  isMostMeaningful: {
    type: Boolean,
    default: false
  },
  expandedDescription: {
    type: String,
    default: null,
    maxlength: 300
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-update hook
ExperienceSchema.pre('findOneAndUpdate', function(next) {
  // Update the updatedAt field
  this.set({ updatedAt: Date.now() });
  next();
});

// Static method to mark 3 experiences as most meaningful
ExperienceSchema.statics.setMostMeaningful = async function(userId, experienceIds) {
  if (experienceIds.length > 3) {
    throw new Error('You can select a maximum of 3 most meaningful experiences');
  }

  // First reset all experiences for this user
  await this.updateMany(
    { userId, isMostMeaningful: true },
    { isMostMeaningful: false }
  );

  // Set selected experiences as most meaningful
  if (experienceIds.length > 0) {
    await this.updateMany(
      { userId, _id: { $in: experienceIds } },
      { isMostMeaningful: true }
    );
  }

  return experienceIds;
};

const Experience = mongoose.model('Experience', ExperienceSchema);

module.exports = Experience; 