const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['rent', 'service_fee', 'deposit', 'late_fee', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['ach', 'credit_card', 'debit_card', 'cash', 'check'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    default: null,
    trim: true
  },
  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    default: null // Only for service fees
  },
  month: {
    type: Number,
    min: 1,
    max: 12,
    default: null // For rent payments
  },
  year: {
    type: Number,
    min: 2020,
    default: null // For rent payments
  },
  dueDate: {
    type: Date,
    default: null
  },
  paidDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: null
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

// Update the updatedAt timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index for rent payments
paymentSchema.index({ tenant: 1, type: 1, status: 1 });
paymentSchema.index({ unit: 1, month: 1, year: 1 });

module.exports = mongoose.model('Payment', paymentSchema);