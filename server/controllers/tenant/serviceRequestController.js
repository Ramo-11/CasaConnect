const ServiceRequest = require('../../../models/ServiceRequest');
const Payment = require('../../../models/Payment');
const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const Notification = require('../../../models/Notification');
const { logger } = require('../../logger');

// Submit Service Request
exports.submitServiceRequest = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { 
      category, 
      priority, 
      title, 
      description, 
      accessInstructions,
      cardNumber,
      expiry,
      cvv 
    } = req.body;
    
    // Get tenant's lease to find unit
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
    
    // Process $10 service fee payment
    const serviceFeePayment = new Payment({
      tenant: tenantId,
      unit: lease.unit,
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
    
    res.json({ 
      success: true, 
      message: 'Service request submitted successfully',
      requestId: serviceRequest._id 
    });
    
  } catch (error) {
    logger.error(`Service request error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to submit service request' 
    });
  }
};

module.exports = exports;