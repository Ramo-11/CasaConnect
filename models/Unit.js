const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  building: {
    type: String,
    required: true,
    trim: true
  },
  floor: {
    type: Number,
    required: true
  },
  bedrooms: {
    type: Number,
    required: true,
    min: 0
  },
  bathrooms: {
    type: Number,
    required: true,
    min: 0
  },
  squareFeet: {
    type: Number,
    required: true,
    min: 0
  },
  monthlyRent: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'reserved'],
    default: 'available'
  },
  currentTenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  amenities: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp on save
unitSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Unit', unitSchema);