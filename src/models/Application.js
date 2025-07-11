const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program is required']
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant is required']
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'],
      default: 'draft'
    },
    coverLetter: {
      type: String
    },
    resume: {
      type: String,
      required: function() {
        // Check if program requires resume
        return this.program && this.program.requiredDocuments && this.program.requiredDocuments.resume;
      }
    },
    portfolioLink: String,
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId
        },
        question: String,
        answer: mongoose.Schema.Types.Mixed,
        fileUrl: String // For file type answers
      }
    ],
    additionalDocuments: [
      {
        name: String,
        description: String,
        fileUrl: String
      }
    ],
    notes: [
      {
        content: {
          type: String,
          required: true
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        visibility: {
          type: String,
          enum: ['private', 'team'],
          default: 'team'
        }
      }
    ],
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      internal: String, // Feedback for the team
      external: String  // Feedback for the applicant
    },
    interviews: [
      {
        round: {
          type: Number,
          required: true
        },
        scheduledDate: Date,
        interviewers: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          }
        ],
        status: {
          type: String,
          enum: ['scheduled', 'completed', 'canceled', 'no_show'],
          default: 'scheduled'
        },
        feedback: String,
        rating: {
          type: Number,
          min: 1,
          max: 5
        }
      }
    ],
    applicationDate: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    submissionDate: Date,
    reviewDate: Date,
    decisionDate: Date,
    withdrawalDate: Date,
    withdrawalReason: String,
    referral: {
      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      relationship: String,
      note: String
    },
    tags: [String],
    history: [
      {
        status: {
          type: String,
          enum: ['draft', 'submitted', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'],
          required: true
        },
        date: {
          type: Date,
          default: Date.now,
          required: true
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        note: String
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add application status to history when status changes
ApplicationSchema.pre('save', function(next) {
  // If status is being modified and it's not a new document
  if (this.isModified('status') && !this.isNew) {
    // Add to history
    this.history.push({
      status: this.status,
      date: Date.now()
    });

    // Update specific date fields based on status
    if (this.status === 'submitted' && !this.submissionDate) {
      this.submissionDate = Date.now();
    } else if (['under_review', 'shortlisted'].includes(this.status) && !this.reviewDate) {
      this.reviewDate = Date.now();
    } else if (['accepted', 'rejected'].includes(this.status) && !this.decisionDate) {
      this.decisionDate = Date.now();
    } else if (this.status === 'withdrawn' && !this.withdrawalDate) {
      this.withdrawalDate = Date.now();
    }
  }

  // Always update lastUpdated when saving
  this.lastUpdated = Date.now();
  
  next();
});

// After saving an application, update the program's application counts
ApplicationSchema.post('save', async function() {
  try {
    const Program = mongoose.model('Program');
    const program = await Program.findById(this.program);
    
    if (program) {
      // If application is newly submitted, increase count
      if (this.status === 'submitted' && this.history.length === 1) {
        await program.increaseApplicationCount();
      }
      
      // If status changed to accepted, increase accepted count
      if (this.status === 'accepted' && 
          this.history.length > 1 && 
          this.history[this.history.length - 2].status !== 'accepted') {
        await program.increaseAcceptedCount();
      }
      
      // If status changed from accepted to something else, decrease accepted count
      if (this.status !== 'accepted' && 
          this.history.length > 1 && 
          this.history[this.history.length - 2].status === 'accepted') {
        await program.decreaseAcceptedCount();
      }
    }
  } catch (err) {
    console.error('Error updating program counts:', err);
  }
});

// Create indexes
ApplicationSchema.index({ program: 1, applicant: 1 }, { unique: true });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ applicationDate: 1 });
ApplicationSchema.index({ 'history.date': 1 });
ApplicationSchema.index({ tags: 1 });

module.exports = mongoose.model('Application', ApplicationSchema); 