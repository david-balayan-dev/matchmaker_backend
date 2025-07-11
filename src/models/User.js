const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Please add a first name']
    },
    lastName: {
      type: String,
      required: [true, 'Please add a last name']
    },
    name: {
      type: String,
      required: [true, 'Please add a name']
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email'
      ]
    },
    phoneNumber: {
      type: String,
      match: [
        /^(\+\d{1,3})?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
        'Please add a valid phone number'
      ]
    },
    specialty: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: ['user', 'applicant', 'publisher', 'admin', 'program-manager'],
      default: 'user'
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false
    },
    profileImage: {
      type: String,
      default: 'default-avatar.jpg'
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters']
    },
    location: {
      type: String
    },
    skills: {
      type: [String]
    },
    interests: {
      type: [String]
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String,
      website: String
    },
    programPreferences: {
      interests: [String],
      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'any'],
        default: 'any'
      },
      format: {
        type: String,
        enum: ['online', 'in-person', 'hybrid', 'any'],
        default: 'any'
      },
      duration: {
        type: String,
        default: 'any'
      },
      location: String,
      maxPrice: {
        type: Number,
        default: 0
      }
    },
    savedPrograms: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Program'
      }
    ],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    lastLogin: {
      type: Date
    },
    createdAt: {
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

// Virtual for fullName
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Virtual for applications
UserSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'applicant',
  justOne: false
});

// Virtual for managed programs (for recruiters)
UserSchema.virtual('managedPrograms', {
  ref: 'Program',
  localField: '_id',
  foreignField: 'programDirector',
  justOne: false
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  // Update the name field whenever firstName or lastName changes
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
  }

  // Only hash password if it's modified
  if (!this.isModified('password')) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update name field before updating user via findOneAndUpdate
UserSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  if (update.firstName || update.lastName) {
    const user = this._update;
    
    // Get current values if not being updated
    if (!user.firstName || !user.lastName) {
      // Since we don't have access to the document directly in pre-findOneAndUpdate,
      // we need to fetch the current firstName/lastName if one isn't being updated
      return this.model.findOne(this.getQuery())
        .then(doc => {
          if (!doc) return next();
          
          // Use existing values for fields not being updated
          const firstName = user.firstName || doc.firstName;
          const lastName = user.lastName || doc.lastName;
          
          // Update the name field
          this._update.name = `${firstName} ${lastName}`.trim();
          next();
        })
        .catch(err => next(err));
    } else {
      // Both firstName and lastName are being updated
      this._update.name = `${user.firstName} ${user.lastName}`.trim();
    }
  }
  
  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set expire
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Update lastLogin
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = Date.now();
  await this.save();
};

// Create index for search functionality
UserSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  email: 'text',
  skills: 'text',
  'experience.company': 'text',
  'experience.position': 'text'
});

module.exports = mongoose.model('User', UserSchema); 