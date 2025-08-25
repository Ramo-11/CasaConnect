const Lease = require('../../../models/Lease');
const Unit = require('../../../models/Unit');
const User = require('../../../models/User');
const Notification = require('../../../models/Notification');
const { logger } = require('../../logger');

// Create Lease (for assigning unit to tenant)
exports.createLease = async (req, res) => {
    try {
        const { 
            tenantId, 
            unitId, 
            startDate, 
            endDate, 
            monthlyRent, 
            securityDeposit,
            rentDueDay,
            lateFeeAmount,
            gracePeriodDays,
            notes
        } = req.body;
        
        // Check for existing active lease for tenant
        const existingTenantLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active'
        });
        
        if (existingTenantLease) {
            return res.status(400).json({
                success: false,
                message: "Tenant already has an active lease"
            });
        }

        // Check for existing active lease for unit
        const existingUnitLease = await Lease.findOne({
            unit: unitId,
            status: 'active'
        });
        
        if (existingUnitLease) {
            return res.status(400).json({
                success: false,
                message: "Unit already has an active lease"
            });
        }
        
        const unit = await Unit.findById(unitId);
        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: "Tenant not found"
            });
        }
        
        const lease = new Lease({
            tenant: tenantId,
            unit: unitId,
            startDate: new Date(startDate || Date.now()),
            endDate: new Date(endDate || new Date().setFullYear(new Date().getFullYear() + 1)),
            monthlyRent: monthlyRent || unit.monthlyRent,
            securityDeposit: securityDeposit || unit.monthlyRent,
            rentDueDay: rentDueDay || 1,
            lateFeeAmount: lateFeeAmount || 50,
            gracePeriodDays: gracePeriodDays || 5,
            notes: notes || null,
            status: 'active'
        });
        
        await lease.save();

        // Notify tenant
        await Notification.create({
            recipient: tenantId,
            type: 'system',
            title: 'Lease Created',
            message: `Your lease for Unit ${unit.unitNumber} has been created`,
            relatedModel: 'Lease',
            relatedId: lease._id
        });
        
        res.json({
            success: true,
            message: "Lease created successfully",
            leaseId: lease._id
        });
    } catch (error) {
        logger.error(`Create lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to create lease"
        });
    }
};

// Update Lease
exports.updateLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const updates = req.body;

        const lease = await Lease.findById(leaseId);
        if (!lease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found"
            });
        }

        // Don't allow changing tenant or unit through update
        delete updates.tenant;
        delete updates.unit;

        Object.keys(updates).forEach(key => {
            lease[key] = updates[key];
        });

        await lease.save();

        res.json({
            success: true,
            message: "Lease updated successfully"
        });
    } catch (error) {
        logger.error(`Update lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to update lease"
        });
    }
};

// Terminate Lease
exports.terminateLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const { reason } = req.body;

        const lease = await Lease.findById(leaseId).populate('tenant unit');
        if (!lease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found"
            });
        }

        lease.status = 'terminated';
        lease.notes = lease.notes ? `${lease.notes}\n\nTermination reason: ${reason}` : `Termination reason: ${reason}`;
        await lease.save();

        // Notify tenant
        await Notification.create({
            recipient: lease.tenant._id,
            type: 'system',
            title: 'Lease Terminated',
            message: `Your lease for Unit ${lease.unit.unitNumber} has been terminated`,
            relatedModel: 'Lease',
            relatedId: lease._id,
            priority: 'high'
        });

        res.json({
            success: true,
            message: "Lease terminated successfully"
        });
    } catch (error) {
        logger.error(`Terminate lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to terminate lease"
        });
    }
};

// Get Lease Details
exports.getLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        
        const lease = await Lease.findById(leaseId)
            .populate('tenant', 'firstName lastName email phone')
            .populate('unit');

        if (!lease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found"
            });
        }

        res.json({
            success: true,
            data: lease
        });
    } catch (error) {
        logger.error(`Get lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to get lease"
        });
    }
};

// Get All Leases
exports.getLeases = async (req, res) => {
    try {
        const { status, tenantId, unitId } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (tenantId) filter.tenant = tenantId;
        if (unitId) filter.unit = unitId;

        const leases = await Lease.find(filter)
            .populate('tenant', 'firstName lastName email')
            .populate('unit', 'unitNumber')
            .sort('-createdAt');

        res.json({
            success: true,
            data: leases
        });
    } catch (error) {
        logger.error(`Get leases error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to get leases"
        });
    }
};

// Renew Lease
exports.renewLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const { newEndDate, newMonthlyRent, notes } = req.body;

        const currentLease = await Lease.findById(leaseId);
        if (!currentLease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found"
            });
        }

        if (currentLease.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: "Can only renew active leases"
            });
        }

        // Create new lease as renewal
        const renewalLease = new Lease({
            tenant: currentLease.tenant,
            unit: currentLease.unit,
            startDate: currentLease.endDate,
            endDate: new Date(newEndDate),
            monthlyRent: newMonthlyRent || currentLease.monthlyRent,
            securityDeposit: currentLease.securityDeposit,
            rentDueDay: currentLease.rentDueDay,
            lateFeeAmount: currentLease.lateFeeAmount,
            gracePeriodDays: currentLease.gracePeriodDays,
            notes: notes || `Renewal of lease ${currentLease._id}`,
            status: 'pending'
        });

        await renewalLease.save();

        res.json({
            success: true,
            message: "Lease renewal created",
            leaseId: renewalLease._id
        });
    } catch (error) {
        logger.error(`Renew lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to renew lease"
        });
    }
};

// Assign Unit to Tenant (creates lease)
exports.assignUnitToTenant = async (req, res) => {
    return exports.createLease(req, res);
};

// Assign Tenant to Unit (creates lease)
exports.assignTenantToUnit = async (req, res) => {
    // Swap the parameters if needed
    if (req.body.unitId && !req.body.tenantId && req.body.tenantId) {
        const temp = req.body.unitId;
        req.body.unitId = req.body.tenantId;
        req.body.tenantId = temp;
    }
    return exports.createLease(req, res);
};