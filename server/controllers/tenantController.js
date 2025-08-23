const User = require('../../models/User');
const Unit = require('../../models/Unit');
const ServiceRequest = require('../../models/ServiceRequest');
const Payment = require('../../models/Payment');
const Notification = require('../../models/Notification');
const logger = require('../logger')

// Format date helper
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Get Tenant Dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Get tenant info - in production, get from session
    const tenantId = req.session?.userId || req.params.tenantId;
    const tenant = await User.findById(tenantId);
    
    if (!tenant || tenant.role !== 'tenant') {
      return res.status(403).render('error', { 
        message: 'Access denied',
        title: 'Error' 
      });
    }
    
    // Get unit info
    const unit = await Unit.findById(tenant.unitId);
    if (!unit) {
      return res.status(404).render('error', { 
        message: 'Unit not found',
        title: 'Error' 
      });
    }
    
    // Get payment status
    const paymentInfo = await calculatePaymentStatus(tenant);
    const monthlyRent = unit.monthlyRent;
    const amountDue = paymentInfo.paymentDue ? 
      monthlyRent + paymentInfo.lateFee : 0;
    
    // Get service requests
    const activeServiceRequests = await ServiceRequest.find({
      tenant: tenantId,
      status: { $in: ['pending', 'assigned', 'in_progress'] }
    })
    .populate('assignedTo', 'firstName lastName')
    .sort('-createdAt')
    .lean();
    
    const serviceRequestHistory = await ServiceRequest.find({
      tenant: tenantId,
      status: 'completed'
    })
    .sort('-completedAt')
    .limit(10)
    .lean();
    
    // Get payment history
    const paymentHistory = await Payment.find({
      tenant: tenantId,
      status: { $in: ['completed', 'processing', 'failed'] }
    })
    .sort('-createdAt')
    .limit(20)
    .lean();
    
    // Format data for view
    const viewData = {
      title: 'Tenant Dashboard',
      additionalCSS: ['tenant.css'],
      additionalJS: ['tenant.js'],
      layout: 'layout',
      
      // User & Unit
      user: tenant,
      unit,
      
      // Payment Info
      paymentDue: paymentInfo.paymentDue,
      paymentStatus: paymentInfo.status,
      daysUntilDue: Math.ceil(paymentInfo.daysUntilDue),
      daysOverdue: paymentInfo.daysOverdue,
      lateFee: paymentInfo.lateFee,
      amountDue,
      monthlyRent,
      nextPaymentDate: formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)),
      
      // Service Requests
      activeRequests: activeServiceRequests.length,
      completedRequests: serviceRequestHistory.length,
      activeServiceRequests: activeServiceRequests.map(sr => ({
        id: sr._id,
        title: sr.title,
        description: sr.description,
        category: sr.category.replace('_', ' '),
        priority: sr.priority,
        status: sr.status.replace('_', ' '),
        date: formatDate(sr.createdAt),
        assignedTo: sr.assignedTo ? sr.assignedTo.fullName : null,
        notes: sr.notes || []
      })),
      serviceRequestHistory: serviceRequestHistory.map(sr => ({
        id: sr._id,
        title: sr.title,
        category: sr.category.replace('_', ' '),
        completedDate: formatDate(sr.completedAt),
        resolutionTime: Math.ceil((sr.completedAt - sr.createdAt) / (1000 * 60 * 60 * 24)) + ' days'
      })),
      recentRequests: activeServiceRequests.slice(0, 3).map(sr => ({
        title: sr.title,
        status: sr.status.replace('_', ' ')
      })),
      
      // Payment History
      paymentHistory: paymentHistory.map(p => ({
        id: p._id,
        date: formatDate(p.paidDate || p.createdAt),
        type: p.type,
        typeLabel: p.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        amount: p.amount,
        method: p.paymentMethod.replace('_', ' ').toUpperCase(),
        status: p.status
      })),
      
      // Lease Info
      leaseId: unit._id,
      leaseStart: formatDate(unit.createdAt), // In production, use actual lease start
      leaseEnd: formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))), // Mock 1 year lease
      leaseRemaining: '6 months', // Calculate actual remaining time
      leaseProgress: 50, // Calculate actual progress percentage
      
      // Documents
      documents: [] // Populate with actual documents
    };
    
    res.render('tenant/dashboard', viewData);
    
  } catch (error) {
    logger.error(`Dashboard error: ${error}`);
    res.status(500).render('error', { 
      message: 'Failed to load dashboard',
      title: 'Error' 
    });
  }
};

// Process Rent Payment
exports.processPayment = async (req, res) => {
  try {
    const tenantId = req.session?.userId || req.body.tenantId;
    const { paymentMethod, routingNumber, accountNumber, cardNumber, expiry, cvv } = req.body;
    
    const tenant = await User.findById(tenantId);
    const unit = await Unit.findById(tenant.unitId);
    
    // Calculate payment amount
    const paymentInfo = await calculatePaymentStatus(tenant);
    const amount = unit.monthlyRent + paymentInfo.lateFee;
    
    // Create payment record
    const payment = new Payment({
      tenant: tenantId,
      unit: unit._id,
      type: 'rent',
      amount,
      paymentMethod,
      status: 'processing',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
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
        message: `Your payment of ${amount.toFixed(2)} has been processed successfully.`,
        relatedModel: 'Payment',
        relatedId: payment._id
      });
    }, 2000);
    
    await payment.save();
    
    res.json({ 
      success: true, 
      message: 'Payment processing',
      paymentId: payment._id 
    });
    
  } catch (error) {
    logger.error(`Payment error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Payment failed' 
    });
  }
};

// Submit Service Request
exports.submitServiceRequest = async (req, res) => {
  try {
    const tenantId = req.session?.userId || req.body.tenantId;
    const { 
      category, 
      priority, 
      title, 
      description, 
      accessInstructions,
      cardNumber,
      cardExpiry,
      cardCvv 
    } = req.body;
    
    const tenant = await User.findById(tenantId);
    const unit = await Unit.findById(tenant.unitId);
    
    // Process $10 service fee payment
    const serviceFeePayment = new Payment({
      tenant: tenantId,
      unit: unit._id,
      type: 'service_fee',
      amount: 10,
      paymentMethod: 'credit_card',
      status: 'processing'
    });
    
    // Simulate payment processing
    serviceFeePayment.status = 'completed';
    serviceFeePayment.paidDate = new Date();
    serviceFeePayment.transactionId = 'SVC' + Date.now();
    await serviceFeePayment.save();
    
    // Create service request
    const serviceRequest = new ServiceRequest({
      tenant: tenantId,
      unit: unit._id,
      category,
      priority,
      title,
      description,
      fee: 10,
      isPaid: true,
      paymentDate: new Date(),
      notes: accessInstructions ? [{
        author: tenantId,
        content: `Access Instructions: ${accessInstructions}`,
        createdAt: new Date()
      }] : []
    });
    
    await serviceRequest.save();
    
    // Link payment to service request
    serviceFeePayment.serviceRequest = serviceRequest._id;
    await serviceFeePayment.save();
    
    // Notify management
    const managers = await User.find({ role: { $in: ['manager', 'supervisor'] } });
    for (const manager of managers) {
      await Notification.create({
        recipient: manager._id,
        type: 'service_request_new',
        title: 'New Service Request',
        message: `${tenant.fullName} submitted a ${category} request: ${title}`,
        relatedModel: 'ServiceRequest',
        relatedId: serviceRequest._id,
        priority: priority === 'emergency' ? 'high' : 'normal'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Service request submitted successfully',
      requestId: serviceRequest._id 
    });
    
  } catch (error) {
    logger.error(`Service request error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit service request' 
    });
  }
};

// Get Payment Status (AJAX)
exports.getPaymentStatus = async (req, res) => {
  try {
    const tenantId = req.session?.userId || req.params.tenantId;
    const tenant = await User.findById(tenantId);
    const paymentInfo = await calculatePaymentStatus(tenant);
    
    res.json({
      success: true,
      data: paymentInfo
    });
    
  } catch (error) {
    logger.error(`Payment status error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get payment status' 
    });
  }
};

// Get Notifications (AJAX)
exports.getNotifications = async (req, res) => {
  try {
    const tenantId = req.session?.userId || req.params.tenantId;
    
    const notifications = await Notification.find({
      recipient: tenantId,
      isRead: false
    })
    .sort('-createdAt')
    .limit(10)
    .lean();
    
    res.json({
      success: true,
      data: notifications
    });
    
  } catch (error) {
    logger.error(`Notifications error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get notifications' 
    });
  }
};

// Mark Notification as Read
exports.markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId);
    
    if (notification) {
      await notification.markAsRead();
    }
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error(`Mark notification error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark notification' 
    });
  }
};

// Helper function to calculate payment status
const calculatePaymentStatus = async (tenant) => {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const rentPaid = await Payment.findOne({
    tenant: tenant._id,
    type: 'rent',
    month: currentMonth,
    year: currentYear,
    status: 'completed'
  });

  const paymentDue = !rentPaid && currentDay >= 1;
  const daysOverdue = paymentDue ? Math.max(0, currentDay - 1) : 0;
  const lateFee = daysOverdue > 5 ? (daysOverdue - 5) * 50 : 0;

  let status = { class: 'success', text: 'Current' };
  if (daysOverdue > 5) {
    status = { class: 'danger', text: 'Overdue' };
  } else if (daysOverdue > 0) {
    status = { class: 'warning', text: 'Due' };
  }

  return {
    paymentDue,
    daysOverdue,
    daysUntilDue: paymentDue ? 0 : (new Date(currentYear, currentMonth, 1) - now) / (1000 * 60 * 60 * 24),
    lateFee,
    status
  };
};
