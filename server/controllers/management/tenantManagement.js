const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const Unit = require('../../../models/Unit');
const Document = require('../../../models/Document');
const Payment = require('../../../models/Payment');
const ServiceRequest = require('../../../models/ServiceRequest');
const Notification = require('../../../models/Notification');
const emailService = require('../../services/emailService');
const { getManagerAccessibleUnits, canAccessUnit } = require('../../utils/accessControl');
const nodemailer = require('nodemailer');
const { logger } = require('../../logger');
require('dotenv').config();

function generateTempPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Create Tenant Account
exports.createTenant = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, sendCredentials, notes } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
            });
        }

        // Create tenant account
        const tenant = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password, // Will be hashed by pre-save hook
            role: 'tenant',
            notes: notes || null,
            isActive: true,
        });

        await tenant.save();

        logger.info(`Tenant created: ${tenant.fullName} (${tenant.email})`);

        // Send credentials email if requested
        if (sendCredentials === 'on') {
            await emailService.sendCredentialsEmail(tenant, password);
        }

        // Create notification for manager
        await Notification.create({
            recipient: req.session.userId,
            type: 'system',
            title: 'Tenant Account Created',
            message: `Account created for ${tenant.fullName}`,
        });

        res.json({
            success: true,
            message: 'Tenant account created successfully',
            tenantId: tenant._id,
        });
    } catch (error) {
        logger.error(`Create tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create tenant account',
        });
    }
};

// Send Credentials to Tenant
exports.sendCredentials = async (req, res) => {
    try {
        const { tenantId, newPassword } = req.body;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        let password = newPassword;

        // Update password if new one provided
        if (newPassword) {
            tenant.password = newPassword; // Will be hashed by pre-save hook
            await tenant.save();
        } else {
            // Generate new temporary password
            password = generateTempPassword();
            tenant.password = password; // Will be hashed by pre-save hook
            await tenant.save();
        }

        // Send email with credentials
        await emailService.sendCredentialsEmail(tenant, password);

        res.json({
            success: true,
            message: 'Credentials sent successfully',
        });
    } catch (error) {
        logger.error(`Send credentials error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to send credentials',
        });
    }
};

// View Tenant Details
exports.viewTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).render('error', {
                title: 'Tenant Not Found',
                message: 'Tenant not found',
            });
        }

        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active',
        }).populate('unit');

        // Check access for restricted managers
        if (userRole === 'restricted_manager') {
            if (!activeLease || !(await canAccessUnit(managerId, userRole, activeLease.unit._id))) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'You do not have access to this tenant',
                });
            }
        }

        const payments = await Payment.find({ tenant: tenantId }).sort('-createdAt').limit(12);

        const serviceRequests = await ServiceRequest.find({ tenant: tenantId })
            .sort('-createdAt')
            .limit(10);

        // Get accessible units for lease creation
        const accessibleUnits = await getManagerAccessibleUnits(managerId, userRole);
        const unitFilter = {};
        if (accessibleUnits !== null) {
            unitFilter._id = { $in: accessibleUnits };
        }

        const availableUnitsForLease = await Unit.aggregate([
            { $match: unitFilter },
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'unit',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { unitNumber: 1, monthlyRent: 1, streetAddress: 1 } },
        ]);

        // Get tenants without active leases (for additional tenants if needed)
        const availableTenantsForLease = await User.aggregate([
            { $match: { role: 'tenant' } },
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'tenant',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { firstName: 1, lastName: 1, email: 1 } },
        ]);

        res.render('manager/tenant-details', {
            title: `Tenant: ${tenant.firstName} ${tenant.lastName}`,
            layout: 'layout',
            additionalCSS: ['manager/tenant-details.css'],
            additionalJS: ['manager/tenant-details.js'],
            user: req.session.user || { role: userRole },
            tenant,
            activeLease,
            payments,
            serviceRequests,
            availableUnitsForLease,
            availableTenantsForLease,
            path: req.path,
            hasActiveLease: !!activeLease,
        });
    } catch (error) {
        logger.error(`View tenant error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load tenant details',
        });
    }
};

// Edit Tenant
exports.editTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).render('error', {
                title: 'Tenant Not Found',
                message: 'Tenant not found',
            });
        }

        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active',
        }).populate('unit');

        // Check access for restricted managers
        if (userRole === 'restricted_manager') {
            if (!activeLease || !(await canAccessUnit(managerId, userRole, activeLease.unit._id))) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'You do not have access to this tenant',
                });
            }
        }

        // Get available units for lease creation (units without active leases)
        const availableUnitsForLease = await Unit.aggregate([
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'unit',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { unitNumber: 1, monthlyRent: 1, streetAddress: 1 } },
        ]);

        // Get tenants without active leases (for additional tenants if needed)
        const availableTenantsForLease = await User.aggregate([
            { $match: { role: 'tenant' } },
            {
                $lookup: {
                    from: 'leases',
                    localField: '_id',
                    foreignField: 'tenant',
                    pipeline: [{ $match: { status: 'active' } }],
                    as: 'activeLeases',
                },
            },
            { $match: { activeLeases: { $size: 0 } } },
            { $project: { firstName: 1, lastName: 1, email: 1 } },
        ]);

        res.render('manager/tenant-edit', {
            title: `Edit Tenant: ${tenant.firstName} ${tenant.lastName}`,
            layout: 'layout',
            additionalCSS: ['manager/tenant-edit.css'],
            additionalJS: ['manager/tenant-edit.js'],
            user: req.session.user || { role: 'manager' },
            tenant,
            activeLease,
            availableUnitsForLease,
            availableTenantsForLease,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Edit tenant error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load tenant edit form',
        });
    }
};

// Update Tenant
exports.updateTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;
        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        if (userRole === 'restricted_manager') {
            if (!activeLease || !(await canAccessUnit(managerId, userRole, activeLease.unit._id))) {
                return res.status(403).render('error', {
                    title: 'Access Denied',
                    message: 'You do not have access to this tenant',
                });
            }
        }

        // Update tenant fields
        Object.keys(updates).forEach((key) => {
            if (key !== 'password' && key !== '_id' && key !== 'role') {
                tenant[key] = updates[key];
            }
        });

        await tenant.save();

        res.json({
            success: true,
            message: 'Tenant updated successfully',
        });
    } catch (error) {
        logger.error(`Update tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to update tenant',
        });
    }
};

// Get Tenants List
exports.getTenants = async (req, res) => {
    try {
        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        // Get accessible units
        const accessibleUnits = await getManagerAccessibleUnits(managerId, userRole);

        // Get active leases for filtering tenants
        const leaseFilter = { status: 'active' };
        if (accessibleUnits !== null) {
            leaseFilter.unit = { $in: accessibleUnits };
        }
        const activeLeases = await Lease.find(leaseFilter).populate('unit');

        // Build tenant filter
        const tenantFilter = { role: 'tenant' };
        if (accessibleUnits !== null) {
            // Only show tenants with active leases on accessible units
            const tenantIds = activeLeases.map((l) => l.tenant);
            tenantFilter._id = { $in: tenantIds };
        }

        const tenants = await User.find(tenantFilter).sort('-createdAt');

        // Create lease map
        const leaseMap = {};
        activeLeases.forEach((lease) => {
            leaseMap[lease.tenant.toString()] = lease;
        });

        // Get available units for new leases
        const occupiedUnitIds = activeLeases.map((l) => l.unit._id.toString());
        const unitFilter = {
            _id: { $nin: occupiedUnitIds },
        };
        if (accessibleUnits !== null) {
            unitFilter._id.$in = accessibleUnits;
        }
        const availableUnits = await Unit.find(unitFilter);

        // Check payment status for each tenant
        const tenantsWithFullInfo = await Promise.all(
            tenants.map(async (tenant) => {
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();
                const activeLease = leaseMap[tenant._id.toString()];

                let rentPaid = false;
                if (activeLease) {
                    rentPaid = await Payment.findOne({
                        tenant: tenant._id,
                        lease: activeLease._id,
                        type: 'rent',
                        month: currentMonth,
                        year: currentYear,
                        status: 'completed',
                    });
                }

                return {
                    ...tenant.toObject(),
                    activeLease,
                    unitId: activeLease?.unit || null,
                    paymentStatus: rentPaid ? 'current' : activeLease ? 'due' : 'no-lease',
                };
            })
        );

        res.render('manager/tenants', {
            title: 'Tenants Management',
            layout: 'layout',
            additionalCSS: ['manager/tenants.css'],
            additionalJS: ['manager/tenants.js'],
            user: req.session.user || { role: userRole },
            tenants: tenantsWithFullInfo,
            availableUnits,
            availableUnitsForLease: availableUnits,
            availableTenantsForLease: tenants.filter((t) => !t.activeLease),
            path: req.path,
        });
    } catch (error) {
        logger.error(`Get tenants error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load tenants',
        });
    }
};

// Delete Tenant (API)
exports.deleteTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        // Terminate any active leases
        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active',
        });

        if (activeLease) {
            activeLease.status = 'terminated';
            activeLease.updatedAt = new Date();
            await activeLease.save();
        }

        // Delete tenant
        await User.findByIdAndDelete(tenantId);

        res.json({
            success: true,
            message: 'Tenant deleted successfully',
        });
    } catch (error) {
        logger.error(`Delete tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tenant',
        });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { tenantId } = req.body;
        const tenant = await User.findById(tenantId);

        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        const tempPassword = generateTempPassword();
        tenant.password = tempPassword; // Let pre-save hook hash it
        tenant.requirePasswordChange = true;
        await tenant.save();

        await emailService.sendCredentialsEmail(tenant, tempPassword);

        res.json({
            success: true,
            message: 'Password reset successfully',
        });
    } catch (error) {
        logger.error(`Reset password error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
        });
    }
};

exports.suspendAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = await User.findById(tenantId);

        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        if (!tenant.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account is already suspended',
            });
        }

        tenant.isActive = false;
        tenant.suspendedAt = new Date();
        tenant.suspendedBy = req.session.userId;
        await tenant.save();

        res.json({
            success: true,
            message: 'Account suspended successfully',
        });
    } catch (error) {
        logger.error(`Suspend account error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend account',
        });
    }
};

exports.activateAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = await User.findById(tenantId);

        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        if (tenant.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Account is already active',
            });
        }

        tenant.isActive = true;
        tenant.suspendedAt = null;
        tenant.suspendedBy = null;
        await tenant.save();

        res.json({
            success: true,
            message: 'Account activated successfully',
        });
    } catch (error) {
        logger.error(`Activate account error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to activate account',
        });
    }
};

// Export Tenant Data
exports.exportTenantData = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await User.findById(tenantId).select('-password');
        const lease = await Lease.findOne({ tenant: tenantId, status: 'active' }).populate('unit');
        const payments = await Payment.find({ tenant: tenantId }).sort('-createdAt');
        const serviceRequests = await ServiceRequest.find({ tenant: tenantId }).sort('-createdAt');
        const documents = await Document.find({ 'relatedTo.id': tenantId });

        const exportData = {
            tenant: tenant.toObject(),
            activeLease: lease ? lease.toObject() : null,
            payments: payments.map((p) => p.toObject()),
            serviceRequests: serviceRequests.map((sr) => sr.toObject()),
            documents: documents.map((d) => ({
                title: d.title,
                type: d.type,
                createdAt: d.createdAt,
            })),
            exportedAt: new Date(),
            exportedBy: req.session.userId,
        };

        res.json({
            success: true,
            data: exportData,
        });
    } catch (error) {
        logger.error(`Export tenant data error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to export tenant data',
        });
    }
};

// Record Manual Payment
exports.recordManualPayment = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { type, amount, paymentMethod, month, year, notes, serviceRequestId } = req.body;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        // Get active lease if payment type is rent
        let activeLease = null;
        if (type === 'rent') {
            activeLease = await Lease.findOne({
                tenant: tenantId,
                status: 'active',
            }).populate('unit');

            if (!activeLease) {
                return res.status(400).json({
                    success: false,
                    message: 'No active lease found for this tenant',
                });
            }
        }

        // Create payment record
        const payment = new Payment({
            tenant: tenantId,
            unit: activeLease ? activeLease.unit._id : null,
            type,
            amount: parseFloat(amount),
            paymentMethod: paymentMethod || 'cash',
            status: 'completed',
            month: type === 'rent' ? parseInt(month) : null,
            year: type === 'rent' ? parseInt(year) : null,
            serviceRequest: type === 'service_fee' ? serviceRequestId : null,
            notes: notes || `Manual payment recorded by manager`,
            paidDate: new Date(),
            transactionId: `MANUAL-${Date.now()}`,
        });

        await payment.save();

        // Create notification for tenant
        await Notification.create({
            recipient: tenantId,
            type: 'payment_received',
            title: 'Payment Recorded',
            message: `A ${type.replace('_', ' ')} payment of $${amount} has been recorded`,
        });

        logger.info(`Manual payment recorded: ${type} - $${amount} for tenant ${tenant.email}`);

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            payment,
        });
    } catch (error) {
        logger.error(`Record manual payment error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment',
        });
    }
};
