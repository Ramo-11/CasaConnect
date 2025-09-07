const ServiceRequest = require('../../../models/ServiceRequest');
const Payment = require('../../../models/Payment');
const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const Notification = require('../../../models/Notification');
const stripe = require('../../config/stripe');
const { ensureCustomer } = require('../../stripeCustomer'); 
const emailService = require('../../services/emailService');
const { logger } = require('../../logger');

const multer = require('multer');
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false); // Skip non-image files silently
        }
    }
});

// Submit Service Request
exports.submitServiceRequest = async (req, res) => {
  logger.debug(`Submit service request body: ${JSON.stringify(req.body)}`);
  try {
    const tenantId = req.session?.userId;
    const { 
      category, 
      priority, 
      title, 
      description, 
      accessInstructions,
      paymentIntentId
    } = req.body;
    
    // Verify payment was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      logger.error(`Service fee payment not completed: ${paymentIntent.id}`);
      return res.status(400).json({
        success: false,
        error: 'Service fee payment not completed'
      });
    }
    
    // Get tenant and lease
    const tenant = await User.findById(tenantId);
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
    
    // Create service fee payment record
    const serviceFeePayment = new Payment({
      tenant: tenantId,
      unit: lease.unit,
      type: 'service_fee',
      amount: 10,
      paymentMethod: 'credit_card',
      status: 'completed',
      paidDate: new Date(),
      transactionId: paymentIntent.id
    });
    
    await serviceFeePayment.save();
    
    // Create service request
    const serviceRequest = new ServiceRequest({
      tenant: tenantId,
      unit: lease.unit,
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
    
    // Send email confirmation to tenant
    await emailService.sendServiceRequestConfirmation(tenant, serviceRequest, serviceFeePayment);
    
    // Notify management
    const managers = await User.find({ role: { $in: ['manager', 'supervisor'] } });
    for (const manager of managers) {
      await Notification.create({
        recipient: manager._id,
        type: 'service_request_new',
        title: 'New Service Request',
        message: `Tenant submitted a ${category} request: ${title}`,
        relatedModel: 'ServiceRequest',
        relatedId: serviceRequest._id,
        priority: priority === 'emergency' ? 'high' : 'normal'
      });
    }
    
    logger.info(`Service request created: ${serviceRequest._id} by tenant ${tenantId}`);
    
    res.json({ 
      success: true, 
      message: 'Service request submitted successfully',
      requestId: serviceRequest._id 
    });
    
  } catch (error) {
    logger.error(`Service request error: ${error.message}`);
    res.json({ 
      success: false, 
      error: 'Failed to submit service request' 
    });
  }
};

// Get service requests for tenant
exports.getServiceRequests = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    
    const serviceRequests = await ServiceRequest.find({
      tenant: tenantId
    })
    .populate('assignedTo', 'firstName lastName')
    .sort('-createdAt')
    .lean();
    
    res.json({
      success: true,
      data: serviceRequests.map(sr => ({
        id: sr._id,
        title: sr.title,
        description: sr.description,
        category: sr.category.replace('_', ' '),
        priority: sr.priority,
        status: sr.status.replace('_', ' '),
        date: new Date(sr.createdAt).toLocaleDateString(),
        assignedTo: sr.assignedTo ? `${sr.assignedTo.firstName} ${sr.assignedTo.lastName}` : null,
        notes: sr.notes || [],
        completedDate: sr.completedAt ? new Date(sr.completedAt).toLocaleDateString() : null,
        resolutionTime: sr.completedAt ? 
          Math.ceil((sr.completedAt - sr.createdAt) / (1000 * 60 * 60 * 24)) + ' days' : null
      }))
    });
    
  } catch (error) {
    logger.error(`Get service requests error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to get service requests' 
    });
  }
};

// Create service fee payment intent
exports.createServiceFeeIntent = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { amount, description } = req.body;
    
    const tenant = await User.findById(tenantId);
    const customerId = await ensureCustomer(tenant);

    try {
      await stripe.paymentMethods.attach(req.body.paymentMethodId, {
        customer: customerId
      });
    } catch (e) {
      if (e.code !== 'resource_already_exists') throw e;
    }
    
    // Create Stripe payment intent for service fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10
      currency: 'usd',
      payment_method: req.body.paymentMethodId,
      customer: customerId,
      confirm: true,
      off_session: true, // important for saved methods
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        tenantId: tenantId.toString(),
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        paymentType: 'service_fee',
        description: description || 'Service Request Fee'
      },
      description: `Service request fee - ${tenant.firstName} ${tenant.lastName}`,
      receipt_email: tenant.email
    });


    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

    logger.info(`Service fee payment intent created: ${paymentIntent.id} for tenant ${tenantId}`);
    
  } catch (error) {
    logger.error(`Create service fee intent error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
};

module.exports = exports;