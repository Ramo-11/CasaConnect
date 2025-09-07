const User = require('../../../models/User');
const Notification = require('../../../models/Notification');
const { logger } = require('../../logger');
const bcrypt = require('bcryptjs');

// Get Settings Page
exports.getSettings = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const tenant = await User.findById(tenantId);
    
    if (!tenant || tenant.role !== 'tenant') {
      return res.status(403).render('error', { 
        message: 'Access denied',
        title: 'Error' 
      });
    }
    
    res.render('tenant/settings', {
      title: 'Account Settings',
      additionalCSS: ['tenant/settings.css'],
      additionalJS: [
        'tenant/payment-methods.js',
        'tenant/settings.js'
      ],
      layout: 'layout',
      user: tenant,
      requirePasswordChange: tenant.requirePasswordChange,
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY
    });
  } catch (error) {
    logger.error(`Settings page error: ${error}`);
    res.status(500).render('error', { 
      message: 'Failed to load settings',
      title: 'Error' 
    });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const tenantId = req.session?.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }
    
    const tenant = await User.findById(tenantId);

    if (!tenant) {
      logger.error(`Tenant not found: ${tenantId}`);
      return res.status(403).json({
            success: false,
            message: "User not found",
      });
    }
    
    // Verify current password
    const isMatch = await tenant.comparePassword(currentPassword);
    if (!isMatch) {
      logger.error(`Password mismatch for tenant: ${tenantId}`);
      return res.status(403).json({
            success: false,
            message: "Failed to change password, current password is incorrect",
        });
    }
    
    // Update password (will be hashed by pre-save hook)
    tenant.password = newPassword;
    tenant.requirePasswordChange = false;
    await tenant.save();

    // Create notification
    await Notification.create({
      recipient: tenantId,
      type: 'system',
      title: 'Password Changed',
      message: 'Your password has been successfully updated.',
      priority: 'normal'
    });

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
    
  } catch (error) {
    logger.error(`Password change error: ${error}`);
    res.json({ 
      success: false, 
      error: 'Failed to change password. Please try again.' 
    });
  }
};

module.exports = exports;