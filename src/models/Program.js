const mongoose = require('mongoose');
const slugify = require('slugify');

const ProgramSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters']
    },
    slug: {
      type: String,
      unique: true
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    summary: {
      type: String,
      maxlength: [250, 'Summary cannot be more than 250 characters']
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: [
        'Engineering',
        'Design',
        'Product',
        'Marketing',
        'Sales',
        'Customer Service',
        'HR',
        'Finance',
        'Legal',
        'Operations',
        'Research',
        'Other'
      ]
    },
    type: {
      type: String,
      required: [true, 'Program type is required'],
      enum: [
        'Internship',
        'Part-time',
        'Full-time',
        'Contract',
        'Apprenticeship',
        'Fellowship',
        'Volunteer'
      ]
    },
    location: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        index: '2dsphere'
      },
      formattedAddress: String,
      street: String,
      city: String,
      state: String,
      zipcode: String,
      country: String
    },
    skills: [String],
    requirements: {
      type: [String],
      required: false
    },
    responsibilities: [String],
    qualifications: {
      required: [String],
      preferred: [String]
    },
    compensation: {
      salary: {
        min: Number,
        max: Number,
        currency: {
          type: String,
          default: 'USD'
        }
      },
      benefits: [String],
      negotiable: {
        type: Boolean,
        default: true
      }
    },
    applicationDeadline: {
      type: Date
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    duration: {
      type: String,
      required: [true, 'Please add program duration']
    },
    maxApplications: {
      type: Number
    },
    maxAcceptances: {
      type: Number
    },
    applicationCount: {
      type: Number,
      default: 0
    },
    acceptedCount: {
      type: Number,
      default: 0
    },
    customQuestions: [
      {
        question: {
          type: String,
          required: true
        },
        required: {
          type: Boolean,
          default: true
        },
        type: {
          type: String,
          enum: ['text', 'paragraph', 'multipleChoice', 'checkbox', 'file'],
          default: 'text'
        },
        options: [String] // For multiple choice or checkbox questions
      }
    ],
    requiredDocuments: {
      resume: {
        type: Boolean,
        default: true
      },
      coverLetter: {
        type: Boolean,
        default: false
      },
      portfolioLink: {
        type: Boolean,
        default: false
      },
      additionalDocuments: [
        {
          name: String,
          description: String,
          required: {
            type: Boolean,
            default: false
          }
        }
      ]
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public'
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'archived'],
      default: 'draft'
    },
    featured: {
      type: Boolean,
      default: false
    },
    programDirector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Program director is required']
    },
    reviewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    company: {
      name: {
        type: String,
        required: [true, 'Company name is required']
      },
      logo: String,
      website: String,
      description: String,
      size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+']
      },
      industry: String
    },
    tags: {
      type: [String],
      required: false
    },
    averageRating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5']
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    format: {
      type: String,
      enum: ['online', 'in-person', 'hybrid'],
      default: 'online'
    },
    phone: {
      type: String,
      maxlength: [20, 'Phone number cannot be longer than 20 characters']
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    address: {
      type: String,
      required: [true, 'Please add an address']
    },
    price: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    photo: {
      type: String,
      default: 'no-photo.jpg'
    },
    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create program slug from the title
ProgramSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true });
  }
  
  // Set updatedAt on save
  this.updatedAt = Date.now();
  
  next();
});

// Geocode & create location field
ProgramSchema.pre('save', async function(next) {
  if (!this.isModified('address')) {
    next();
    return;
  }
  
  try {
    // You would typically use a geocoding service here
    // For now, just setting a placeholder location
    this.location = {
      type: 'Point',
      coordinates: [0, 0], // Default coordinates
      formattedAddress: this.address,
      street: '',
      city: '',
      state: '',
      zipcode: '',
      country: ''
    };
  } catch (err) {
    console.error(err);
  }
  
  next();
});

// Virtual for applications
ProgramSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'program',
  justOne: false
});

// Methods
ProgramSchema.methods.increaseApplicationCount = function() {
  this.applicationCount += 1;
  return this.save();
};

ProgramSchema.methods.decreaseApplicationCount = function() {
  if (this.applicationCount > 0) {
    this.applicationCount -= 1;
    return this.save();
  }
  return this;
};

ProgramSchema.methods.increaseAcceptedCount = function() {
  this.acceptedCount += 1;
  return this.save();
};

ProgramSchema.methods.decreaseAcceptedCount = function() {
  if (this.acceptedCount > 0) {
    this.acceptedCount -= 1;
    return this.save();
  }
  return this;
};

// Check if program is accepting applications
ProgramSchema.methods.isAcceptingApplications = function() {
  const now = new Date();
  
  // Check if program is published
  if (this.status !== 'published') {
    return false;
  }
  
  // Check if deadline has passed
  if (now > this.applicationDeadline) {
    return false;
  }
  
  // Check if max applications reached
  if (this.maxApplications && this.applicationCount >= this.maxApplications) {
    return false;
  }
  
  // Check if max acceptances reached
  if (this.maxAcceptances && this.acceptedCount >= this.maxAcceptances) {
    return false;
  }
  
  return true;
};

// Create indexes for search functionality
ProgramSchema.index({ 
  title: 'text',
  description: 'text',
  summary: 'text',
  department: 'text',
  type: 'text',
  skills: 'text',
  'company.name': 'text',
  tags: 'text'
});

// Cascade delete reviews when a program is deleted
ProgramSchema.pre('remove', async function(next) {
  await this.model('Review').deleteMany({ program: this._id });
  next();
});

// Reverse populate with reviews
ProgramSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'program',
  justOne: false
});

module.exports = mongoose.model('Program', ProgramSchema); 