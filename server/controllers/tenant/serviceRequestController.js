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
const storageService = require('../../services/storageService');

// Configure multer
const uploadServiceRequest = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
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
      location,
      accessInstructions,
      preferredDate,
      preferredTime,
      paymentMethodId // pm_...
    } = req.body;

    // Basic validation
    if (!paymentMethodId) {
      return res.status(400).json({ success: false, error: 'Missing payment method.' });
    }

    // Get tenant & active lease
    const tenant = await User.findById(tenantId);
    const lease = await Lease.findOne({
      $or: [{ tenant: tenantId }, { additionalTenants: tenantId }],
      status: 'active'
    });
    if (!lease) {
      return res.status(404).json({ success: false, error: 'No active lease found' });
    }

    // Ensure Stripe customer
    const customerId = await ensureCustomer(tenant);

    // Optional: total upload size guard (multer already enforces per-file)
    const totalBytes = (req.files || []).reduce((s, f) => s + (f.size || 0), 0);
    if (totalBytes > 15 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Total photo size exceeds 15MB.' });
    }

    // Attach PM if needed (idempotent-ish)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e) {
      if (e.code !== 'resource_already_exists') throw e;
    }

    // Charge service fee FIRST (avoid uploading if payment fails)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10
      currency: 'usd',
      payment_method: paymentMethodId,
      customer: customerId,
      confirm: true,
      off_session: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        tenantId: String(tenantId),
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        paymentType: 'service_fee',
        description: 'Service Request Fee'
      },
      description: `Service request fee - ${tenant.firstName} ${tenant.lastName}`,
      receipt_email: tenant.email
    });

    if (paymentIntent.status !== 'succeeded') {
      logger.error(`Service fee payment not completed: ${paymentIntent.id}`);
      return res.status(400).json({ success: false, error: 'Service fee payment not completed' });
    }

    // Create the service request (need ID for photo path)
    const serviceRequest = new ServiceRequest({
      tenant: tenantId,
      unit: lease.unit,
      category,
      priority,
      title,
      description,
      location,
      preferredDate,
      preferredTime,
      fee: 10,
      isPaid: true,
      paymentDate: new Date(),
      photos: [],
      notes: accessInstructions ? [{
        author: tenantId,
        content: `Access Instructions: ${accessInstructions}`,
        createdAt: new Date()
      }] : []
    });
    await serviceRequest.save();

    // Upload photos (path: service-requests/<requestId>/...)
    if (req.files && req.files.length > 0) {
      try {
        const uploadedPhotos = await Promise.all(
          req.files.map(file => storageService.uploadServicePhoto(file, serviceRequest._id))
        );
        serviceRequest.photos = uploadedPhotos;
        await serviceRequest.save();
        logger.info(`Uploaded ${uploadedPhotos.length} photos for request ${serviceRequest._id}`);
      } catch (photoError) {
        logger.error(`Photo upload error for request ${serviceRequest._id}: ${photoError.message}`);
        // continue without blocking the request
      }
    }

    // Record payment
    const serviceFeePayment = new Payment({
      tenant: tenantId,
      unit: lease.unit,
      type: 'service_fee',
      amount: 10,
      paymentMethod: 'credit_card',
      status: 'completed',
      paidDate: new Date(),
      transactionId: paymentIntent.id,
      serviceRequest: serviceRequest._id
    });
    await serviceFeePayment.save();

    // Email + notify management
    await emailService.sendServiceRequestConfirmation(tenant, serviceRequest, serviceFeePayment);
    const managers = await User.find({ role: { $in: ['manager', 'supervisor'] } });
    await Promise.all(managers.map(m =>
      Notification.create({
        recipient: m._id,
        type: 'service_request_new',
        title: 'New Service Request',
        message: `Tenant submitted a ${category} request: ${title}`,
        relatedModel: 'ServiceRequest',
        relatedId: serviceRequest._id,
        priority: priority === 'emergency' ? 'high' : 'normal'
      })
    ));

    logger.info(`Service request created: ${serviceRequest._id} by tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Service request submitted successfully',
      requestId: serviceRequest._id,
      photosUploaded: serviceRequest.photos?.length || 0
    });

  } catch (error) {
    logger.error(`Service request error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit service request' });
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
        location: sr.location,
        date: new Date(sr.createdAt).toLocaleDateString(),
        assignedTo: sr.assignedTo ? `${sr.assignedTo.firstName} ${sr.assignedTo.lastName}` : null,
        notes: sr.notes || [],
        photos: sr.photos || [], // Include photos
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

module.exports = {
  ...exports,
  upload: {
    array: uploadServiceRequest.array.bind(uploadServiceRequest)
  }
};