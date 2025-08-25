const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
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
  monthlyRent: {
    type: Number,
    required: true,
    min: 0
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'terminated', 'pending'],
    default: 'pending'
  },
  // Payment terms
  rentDueDay: {
    type: Number,
    default: 1,
    min: 1,
    max: 28
  },
  lateFeeAmount: {
    type: Number,
    default: 50,
    min: 0
  },
  gracePeriodDays: {
    type: Number,
    default: 5,
    min: 0
  },
  // Additional tenants (roommates)
  additionalTenants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: {
    type: String,
    trim: true
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

// Indexes for performance
leaseSchema.index({ tenant: 1, status: 1 });
leaseSchema.index({ unit: 1, status: 1 });
leaseSchema.index({ startDate: 1, endDate: 1 });

// Update timestamp on save
leaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if lease is active on a given date
leaseSchema.methods.isActiveOn = function(date = new Date()) {
  return this.status === 'active' && 
         date >= this.startDate && 
         date <= this.endDate;
};

// Virtual for lease term in months
leaseSchema.virtual('termMonths').get(function() {
  const months = Math.round((this.endDate - this.startDate) / (1000 * 60 * 60 * 24 * 30));
  return months;
});

// Virtual for days remaining
leaseSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  if (this.endDate < now) return 0;
  return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Lease', leaseSchema);