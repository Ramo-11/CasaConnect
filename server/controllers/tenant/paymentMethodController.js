const PaymentMethod = require('../../../models/PaymentMethod');
const User = require('../../../models/User');
const stripe = require('../../config/stripe');
const { logger } = require('../../logger');

// Get all payment methods for tenant
exports.getPaymentMethods = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    const methods = await PaymentMethod.find({ user: tenantId })
      .sort('-isDefault -createdAt');
    
    res.json({ success: true, data: methods });
    
  } catch (error) {
    logger.error(`Get payment methods error: ${error}`);
    res.json({ success: false, error: 'Failed to get payment methods' });
  }
};

// Save new payment method
exports.savePaymentMethod = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { type, token } = req.body;
    
    const tenant = await User.findById(tenantId);
    
    // Create Stripe customer if doesn't exist
    let stripeCustomerId = tenant.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: `${tenant.firstName} ${tenant.lastName}`,
        metadata: { tenantId: tenantId.toString() }
      });
      stripeCustomerId = customer.id;
      
      // Save to user record
      tenant.stripeCustomerId = stripeCustomerId;
      await tenant.save();
    }
    
    // Create payment method in Stripe
    let stripePaymentMethod;
    if (type === 'card') {
      stripePaymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: { token }
      });
    } else {
      // ACH setup
      stripePaymentMethod = await stripe.paymentMethods.create({
        type: 'us_bank_account',
        us_bank_account: {
          account_holder_type: 'individual',
          routing_number: req.body.routingNumber,
          account_number: req.body.accountNumber
        }
      });
    }
    
    // Attach to customer
    await stripe.paymentMethods.attach(stripePaymentMethod.id, {
      customer: stripeCustomerId
    });
    
    // Check if this is the first payment method
    const existingMethods = await PaymentMethod.find({ user: tenantId });
    
    // Save to database
    const paymentMethod = new PaymentMethod({
      user: tenantId,
      type,
      stripePaymentMethodId: stripePaymentMethod.id,
      isDefault: existingMethods.length === 0,
      last4: type === 'card' 
        ? stripePaymentMethod.card.last4 
        : req.body.accountNumber.slice(-4),
      brand: type === 'card' ? stripePaymentMethod.card.brand : undefined,
      expMonth: type === 'card' ? stripePaymentMethod.card.exp_month : undefined,
      expYear: type === 'card' ? stripePaymentMethod.card.exp_year : undefined,
      bankName: type === 'ach' ? req.body.bankName : undefined,
      accountType: type === 'ach' ? req.body.accountType : undefined
    });
    
    await paymentMethod.save();
    
    logger.info(`Payment method saved for tenant ${tenantId}`);
    res.json({ success: true, data: paymentMethod });
    
  } catch (error) {
    logger.error(`Save payment method error: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to save payment method' });
  }
};

// Delete payment method
exports.deletePaymentMethod = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { methodId } = req.params;
    
    const paymentMethod = await PaymentMethod.findOne({
      _id: methodId,
      user: tenantId
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
    
    // If this was default, make another one default
    if (paymentMethod.isDefault) {
      const otherMethod = await PaymentMethod.findOne({
        user: tenantId,
        _id: { $ne: methodId }
      });
      
      if (otherMethod) {
        otherMethod.isDefault = true;
        await otherMethod.save();
      }
    }
    
    await paymentMethod.remove();
    
    logger.info(`Payment method ${methodId} deleted for tenant ${tenantId}`);
    res.json({ success: true, message: 'Payment method removed' });
    
  } catch (error) {
    logger.error(`Delete payment method error: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to delete payment method' });
  }
};

// Set default payment method
exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { methodId } = req.params;
    
    // Remove current default
    await PaymentMethod.updateMany(
      { user: tenantId },
      { isDefault: false }
    );
    
    // Set new default
    const paymentMethod = await PaymentMethod.findOneAndUpdate(
      { _id: methodId, user: tenantId },
      { isDefault: true },
      { new: true }
    );
    
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }
    
    // Update Stripe customer default
    const tenant = await User.findById(tenantId);
    if (tenant.stripeCustomerId) {
      await stripe.customers.update(tenant.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripePaymentMethodId
        }
      });
    }
    
    logger.info(`Default payment method set to ${methodId} for tenant ${tenantId}`);
    res.json({ success: true, message: 'Default payment method updated' });
    
  } catch (error) {
    logger.error(`Set default payment method error: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to update default payment method' });
  }
};

module.exports = exports;