const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
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
  category: {
    type: String,
    enum: ['electrical', 'plumbing', 'general_repair', 'hvac', 'appliance', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fee: {
    type: Number,
    default: 10,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paymentDate: {
    type: Date,
    default: null
  },
  photos: [{
    url: String,
    fileName: String,
    originalName: String,
    size: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    type: String,
    enum: ['kitchen', 'living_room', 'bedroom_master', 'bedroom_other', 'bathroom_master', 'bathroom_other', 'laundry', 'garage', 'exterior', 'other']
  },
  preferredDate: Date,
  preferredTime: String,
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: {
    type: Date,
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
serviceRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
serviceRequestSchema.index({ tenant: 1, status: 1 });
serviceRequestSchema.index({ assignedTo: 1, status: 1 });
serviceRequestSchema.index({ unit: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);