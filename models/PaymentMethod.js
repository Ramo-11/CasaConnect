const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['card', 'ach'],
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  // Stripe payment method ID
  stripePaymentMethodId: {
    type: String,
    required: true
  },
  // Display info only (not sensitive)
  last4: {
    type: String,
    required: true
  },
  // For cards
  brand: String,
  expMonth: Number,
  expYear: Number,
  // For ACH
  bankName: String,
  accountType: String, // checking or savings
  createdAt: {
    type: Date,
    default: Date.now
  }
});

paymentMethodSchema.index({ user: 1, stripePaymentMethodId: 1 }, { unique: true });

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);