const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Address fields
  streetAddress: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxLength: 2
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{5}(-\d{4})?$/
  },
  // Optional fields
  building: {
    type: String,
    trim: true,
    default: null // Optional - for apartments/complexes
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'townhouse', 'condo', 'duplex', 'studio', 'other'],
    required: true
  },
  floor: {
    type: Number,
    default: null // Optional - not applicable for houses
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

// Virtual for checking if unit is occupied
unitSchema.virtual('isOccupied', {
  get: async function() {
    const Lease = require('./Lease');
    const activeLease = await Lease.findOne({
      unit: this._id,
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });
    return !!activeLease;
  }
});

// Method to get current tenant
unitSchema.methods.getCurrentTenant = async function() {
  const Lease = require('./Lease');
  const activeLease = await Lease.findOne({
    unit: this._id,
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  }).populate('tenant');
  
  return activeLease ? activeLease.tenant : null;
};

// Virtual for full address
unitSchema.virtual('fullAddress').get(function() {
  return `${this.streetAddress}, ${this.city}, ${this.state} ${this.zipCode}`;
});

module.exports = mongoose.model('Unit', unitSchema);