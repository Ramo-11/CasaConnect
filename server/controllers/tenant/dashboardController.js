const User = require('../../../models/User');
const Unit = require('../../../models/Unit');
const Lease = require('../../../models/Lease');
const ServiceRequest = require('../../../models/ServiceRequest');
const Payment = require('../../../models/Payment');
const Notification = require('../../../models/Notification');
const { logger } = require('../../logger');

// Helper function
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Get Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const tenant = await User.findById(tenantId);

    if (!tenant || tenant.role !== 'tenant') {
      return res.status(403).render('error', { 
        message: 'Access denied',
        title: 'Error' 
      });
    }
    
    // Get active lease
    const lease = await Lease.findOne({
      $or: [
        { tenant: tenantId },
        { additionalTenants: tenantId }
      ],
      status: 'active'
    }).populate('unit');
    
    if (!lease) {
      return res.render('tenant/no-lease', {
        title: 'No Active Lease',
        user: tenant,
        layout: 'layout',
        additionalCSS: ['no-lease.css']
      });
    }
    
    const unit = lease.unit;
    
    // Get unread notifications
    const notifications = await Notification.find({
      recipient: tenantId,
      isRead: false
    })
    .sort('-createdAt')
    .limit(5)
    .lean();
    
    // Get payment status
    const paymentInfo = await calculatePaymentStatus(lease);
    const monthlyRent = lease.monthlyRent;
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
      additionalCSS: [
        'tenant-dashboard.css',
        'tenant-notifications.css',
        'tenant-payment.css',
        'tenant-service-request.css',
        'tenant-documents.css'
      ],
      additionalJS: ['tenant.js', 'tenant-notifications.js'],
      layout: 'layout',
      
      // User & Unit
      user: tenant,
      unit,
      
      // Notifications
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        createdAt: formatDate(n.createdAt),
        timeAgo: getTimeAgo(n.createdAt)
      })),
      unreadCount: notifications.length,
      
      // Payment Info
      paymentDue: paymentInfo.paymentDue,
      paymentStatus: paymentInfo.status,
      daysUntilDue: Math.ceil(paymentInfo.daysUntilDue),
      daysOverdue: paymentInfo.daysOverdue,
      lateFee: paymentInfo.lateFee,
      amountDue,
      monthlyRent,
      nextPaymentDate: formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, lease.rentDueDay)),
      
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
        assignedTo: sr.assignedTo ? `${sr.assignedTo.firstName} ${sr.assignedTo.lastName}` : null,
        notes: sr.notes || []
      })),
      serviceRequestHistory: serviceRequestHistory.map(sr => ({
        id: sr._id,
        title: sr.title,
        category: sr.category.replace('_', ' '),
        completedDate: formatDate(sr.completedAt),
        resolutionTime: Math.ceil((sr.completedAt - sr.createdAt) / (1000 * 60 * 60 * 24)) + ' days'
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
      leaseId: lease._id,
      leaseStart: formatDate(lease.startDate),
      leaseEnd: formatDate(lease.endDate),
      leaseRemaining: calculateTimeRemaining(lease.endDate),
      leaseProgress: calculateLeaseProgress(lease.startDate, lease.endDate),
      
      // Documents
      documents: [] // Will be populated by document controller
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

// Helper functions
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

  let status = { class: 'success', text: 'Current' };
  if (daysOverdue > lease.gracePeriodDays) {
    status = { class: 'danger', text: 'Overdue' };
  } else if (daysOverdue > 0) {
    status = { class: 'warning', text: 'Due' };
  }

  return {
    paymentDue,
    daysOverdue,
    daysUntilDue: paymentDue ? 0 : (lease.rentDueDay - currentDay),
    lateFee,
    status,
    urgent: daysOverdue > 5
  };
}

function calculateTimeRemaining(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const months = Math.floor((end - now) / (1000 * 60 * 60 * 24 * 30));
  
  if (months > 1) return `${months} months`;
  if (months === 1) return '1 month';
  
  const days = Math.floor((end - now) / (1000 * 60 * 60 * 24));
  return `${days} days`;
}

function calculateLeaseProgress(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const total = end - start;
  const elapsed = now - start;
  
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + ' years ago';
  if (interval === 1) return '1 year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + ' months ago';
  if (interval === 1) return '1 month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + ' days ago';
  if (interval === 1) return '1 day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + ' hours ago';
  if (interval === 1) return '1 hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + ' minutes ago';
  if (interval === 1) return '1 minute ago';
  
  return 'Just now';
}

module.exports = exports;