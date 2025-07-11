const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema({
  school: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  fieldOfStudy: {
    type: String,
    required: true
  }
});

const HonorAwardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

const MiscellaneousQuestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professionalism: {
    hasIssues: {
      type: Boolean,
      default: false
    },
    explanation: {
      type: String,
      default: null
    }
  },
  education: {
    undergraduate: {
      type: [EducationSchema],
      default: []
    },
    graduate: {
      type: [EducationSchema],
      default: []
    }
  },
  honorsAwards: {
    type: [HonorAwardSchema],
    default: []
  },
  impactfulExperience: {
    type: String,
    default: null
  },
  hobbiesInterests: {
    type: String,
    default: null
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
MiscellaneousQuestionSchema.pre('findOneAndUpdate', function(next) {
  // Update the updatedAt field
  this.set({ updatedAt: Date.now() });
  next();
});

const MiscellaneousQuestion = mongoose.model('MiscellaneousQuestion', MiscellaneousQuestionSchema);

module.exports = MiscellaneousQuestion; 