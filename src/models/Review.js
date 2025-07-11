const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    required: [true, 'Please add a title for the review'],
    maxlength: 100
  },
  text: {
    type: String,
    required: [true, 'Please add some text'],
    maxlength: 1000
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Please add a rating between 1 and 5']
  },
  program: {
    type: mongoose.Schema.ObjectId,
    ref: 'Program',
    required: true
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Prevent user from submitting more than one review per program
ReviewSchema.index({ program: 1, user: 1 }, { unique: true });

// Static method to get avg rating and save
ReviewSchema.statics.getAverageRating = async function(programId) {
  const obj = await this.aggregate([
    {
      $match: { program: programId }
    },
    {
      $group: {
        _id: '$program',
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  try {
    await this.model('Program').findByIdAndUpdate(programId, {
      averageRating: obj.length > 0 ? Math.round(obj[0].averageRating * 10) / 10 : 0
    });
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
ReviewSchema.post('save', function() {
  this.constructor.getAverageRating(this.program);
});

// Call getAverageRating before remove
ReviewSchema.pre('remove', function() {
  this.constructor.getAverageRating(this.program);
});

module.exports = mongoose.model('Review', ReviewSchema); 