const Payment = require('../../../models/Payment');
const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const Notification = require('../../../models/Notification');
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
    
    // Get tenant's lease for metadata
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
      metadata: {
        tenantId: tenantId.toString(),
        leaseId: lease._id.toString(),
        unitNumber: lease.unit.unitNumber,
        paymentType: 'rent',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      },
      description: `Rent payment for Unit ${lease.unit.unitNumber}`
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    logger.error(`Create payment intent error: ${error}`);
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
    
    // Create payment record
    const payment = new Payment({
      tenant: tenantId,
      unit: paymentIntent.metadata.leaseId,
      type: 'rent',
      amount: paymentIntent.amount / 100,
      paymentMethod: 'credit_card',
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
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      paymentId: payment._id
    });
    
  } catch (error) {
    logger.error(`Confirm payment error: ${error}`);
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