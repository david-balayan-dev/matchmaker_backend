const mongoose = require('mongoose');

const ProgramPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  primarySpecialty: {
    type: String,
    required: true
  },
  otherSpecialties: {
    type: [String],
    default: []
  },
  preferredStates: {
    type: [String],
    required: true
  },
  hospitalPreference: {
    type: String,
    enum: ['academic', 'community'],
    required: true
  },
  residentCountPreference: {
    type: String,
    enum: ['many', 'fewer'],
    required: true
  },
  valuedCharacteristics: {
    type: [String],
    required: true,
    validate: {
      validator: function(val) {
        return val.length <= 3;
      },
      message: 'You can select a maximum of 3 valued characteristics'
    }
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
ProgramPreferenceSchema.pre('findOneAndUpdate', function(next) {
  // Update the updatedAt field
  this.set({ updatedAt: Date.now() });
  next();
});

const ProgramPreference = mongoose.model('ProgramPreference', ProgramPreferenceSchema);

module.exports = ProgramPreference; 