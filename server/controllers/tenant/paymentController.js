const Payment = require('../../../models/Payment');
const Lease = require('../../../models/Lease');
const Notification = require('../../../models/Notification');
const stripe = require('../../config/stripe');
const emailService = require('../../services/emailService');
const { logger } = require('../../logger');

// Create payment intent for rent
exports.createPaymentIntent = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { amount, paymentMethod } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }
    
    // Get tenant and lease info
    const tenant = await User.findById(tenantId);
    const lease = await Lease.findOne({
      tenant: tenantId,
      status: 'active'
    }).populate('unit');
    
    if (!lease) {
      return res.status(404).json({
        success: false,
        message: 'No active lease found'
      });
    }
    
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        tenantId: tenantId.toString(),
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        leaseId: lease._id.toString(),
        unitNumber: lease.unit.unitNumber,
        paymentType: 'rent',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      },
      description: `Rent payment for Unit ${lease.unit.unitNumber} - ${tenant.firstName} ${tenant.lastName}`,
      receipt_email: tenant.email
    });
    
    logger.info(`Payment intent created: ${paymentIntent.id} for tenant ${tenantId}`);
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    logger.error(`Create payment intent error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
};

// Confirm payment
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const tenantId = req.session?.userId;
    
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }
    
    // Get tenant and lease
    const tenant = await User.findById(tenantId);
    const lease = await Lease.findOne({
      tenant: tenantId,
      status: 'active'
    }).populate('unit');
    
    // Create payment record
    const payment = new Payment({
      tenant: tenantId,
      unit: lease.unit._id,
      type: 'rent',
      amount: paymentIntent.amount / 100,
      paymentMethod: paymentIntent.payment_method_types[0] || 'card',
      status: 'completed',
      transactionId: paymentIntent.id,
      month: parseInt(paymentIntent.metadata.month),
      year: parseInt(paymentIntent.metadata.year),
      paidDate: new Date()
    });
    
    await payment.save();
    
    // Create notification
    await Notification.create({
      recipient: tenantId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `Your payment of $${payment.amount} has been processed successfully.`,
      relatedModel: 'Payment',
      relatedId: payment._id
    });
    
    // Send email confirmation
    await emailService.sendRentPaymentConfirmation(tenant, payment, lease);
    
    logger.info(`Payment confirmed: ${paymentIntent.id} for tenant ${tenantId}`);
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      paymentId: payment._id,
      amount: payment.amount,
      transactionId: payment.transactionId
    });
    
  } catch (error) {
    logger.error(`Confirm payment error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
};

// Process Payment
exports.processPayment = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { paymentMethod, amount, routingNumber, accountNumber, cardNumber, expiry, cvv } = req.body;
    
    // Get tenant's active lease
    const lease = await Lease.findOne({
      $or: [
        { tenant: tenantId },
        { additionalTenants: tenantId }
      ],
      status: 'active'
    }).populate('unit');
    
    if (!lease) {
      return res.status(404).json({
        success: false,
        error: 'No active lease found'  
      });
    }
    
    // Create payment record
    const payment = new Payment({
      tenant: tenantId,
      unit: lease.unit._id,
      type: 'rent',
      amount: parseFloat(amount),
      paymentMethod: paymentMethod === 'card' ? 'credit_card' : paymentMethod,
      status: 'processing',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), lease.rentDueDay)
    });
    
    // In production, integrate with payment processor (Stripe, etc.)
    // For now, simulate successful payment
    setTimeout(async () => {
      payment.status = 'completed';
      payment.paidDate = new Date();
      payment.transactionId = 'TXN' + Date.now();
      await payment.save();
      
      // Create notification
      await Notification.create({
        recipient: tenantId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `Your payment of $${amount} has been processed successfully.`,
        relatedModel: 'Payment',
        relatedId: payment._id
      });
    }, 2000);
    
    await payment.save();
    
    res.json({ 
      success: true, 
      message: 'Payment processing',
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        transactionId: 'TXN' + Date.now()
      }
    });
    
  } catch (error) {
    logger.error(`Payment error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Payment failed. Please try again.' 
    });
  }
};

// Get Payment Status (AJAX)
exports.getPaymentStatus = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    const lease = await Lease.findOne({
      $or: [
        { tenant: tenantId },
        { additionalTenants: tenantId }
      ],
      status: 'active'
    });
    
    if (!lease) {
      return res.status(404).json({
        success: false,
        error: 'No active lease found'
      });
    }
    
    const paymentInfo = await calculatePaymentStatus(lease);
    
    res.json({
      success: true,
      data: paymentInfo
    });
    
  } catch (error) {
    logger.error(`Payment status error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to get payment status' 
    });
  }
};

// Get Payment History (AJAX)
exports.getPaymentHistory = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    const payments = await Payment.find({
      tenant: tenantId,
      status: { $in: ['completed', 'processing', 'failed'] }
    })
    .sort('-createdAt')
    .limit(50)
    .lean();
    
    const formattedPayments = payments.map(p => ({
      id: p._id,
      date: new Date(p.paidDate || p.createdAt).toLocaleDateString(),
      type: p.type,
      typeLabel: p.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      amount: p.amount,
      method: p.paymentMethod.replace('_', ' ').toUpperCase(),
      status: p.status
    }));
    
    res.json({
      success: true,
      data: formattedPayments
    });
    
  } catch (error) {
    logger.error(`Payment history error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to get payment history' 
    });
  }
};

// Get saved payment methods
exports.getPaymentMethods = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    // In production, retrieve from payment processor
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
    
  } catch (error) {
    logger.error(`Get payment methods error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to get payment methods' 
    });
  }
};

// Create service fee payment intent
exports.createServiceFeeIntent = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { amount, description } = req.body;
    
    // For now, return mock data
    // In production, integrate with Stripe
    res.json({
      success: true,
      clientSecret: 'mock_secret_' + Date.now(),
      paymentIntentId: 'pi_' + Date.now()
    });
    
  } catch (error) {
    logger.error(`Create service fee intent error: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
};

// Helper function
async function calculatePaymentStatus(lease) {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const rentPaid = await Payment.findOne({
    tenant: lease.tenant,
    type: 'rent',
    month: currentMonth,
    year: currentYear,
    status: 'completed'
  });

  const paymentDue = !rentPaid && currentDay >= 1;
  const daysOverdue = paymentDue ? Math.max(0, currentDay - lease.rentDueDay) : 0;
  const lateFee = daysOverdue > lease.gracePeriodDays ? lease.lateFeeAmount : 0;

  return {
    paymentDue,
    daysOverdue,
    daysUntilDue: paymentDue ? 0 : (lease.rentDueDay - currentDay),
    lateFee,
    urgent: daysOverdue > 5
  };
}

module.exports = exports;