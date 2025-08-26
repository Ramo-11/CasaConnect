const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['lease', 'contract', 'notice', 'invoice', 'other'],
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['User', 'Unit', 'Lease', null],
      default: null
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  metadata: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

documentSchema.index({ 'relatedTo.model': 1, 'relatedTo.id': 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ sharedWith: 1 });

module.exports = mongoose.model('Document', documentSchema);