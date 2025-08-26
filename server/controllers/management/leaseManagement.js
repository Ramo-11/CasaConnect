const Lease = require("../../../models/Lease");
const Unit = require("../../../models/Unit");
const User = require("../../../models/User");
const storageService = require("../../services/storageService");
const Document = require("../../../models/Document");
const Notification = require("../../../models/Notification");
const { logger } = require("../../logger");

// Create Lease with Document
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
        } = req.body;

        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Lease document is required",
            });
        }

        // Check for existing active lease
        const existingLease = await Lease.findOne({
            $or: [
                { tenant: tenantId, status: "active" },
                { unit: unitId, status: "active" },
            ],
        });

        if (existingLease) {
            return res.status(400).json({
                success: false,
                message: "Active lease already exists for this tenant or unit",
            });
        }

        const unit = await Unit.findById(unitId);
        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found",
            });
        }

        // Upload document first
        const uploadResult = await storageService.uploadFile(file, "leases");

        // Create document record
        const document = new Document({
            title: `Lease Agreement - Unit ${unit.unitNumber} - ${new Date(
                startDate
            ).toLocaleDateString()}`,
            type: "lease",
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            uploadedBy: req.session.userId,
            relatedTo: {
                model: "Lease",
                id: null, // Will update after lease creation
            },
        });

        await document.save();

        // Create lease
        const lease = new Lease({
            tenant: tenantId,
            unit: unitId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            monthlyRent: parseFloat(monthlyRent),
            securityDeposit: parseFloat(securityDeposit),
            rentDueDay: parseInt(rentDueDay) || 1,
            lateFeeAmount: parseFloat(lateFeeAmount) || 50,
            gracePeriodDays: parseInt(gracePeriodDays) || 5,
            document: document._id,
            status: "active",
            notes: req.body.notes || null,
        });

        await lease.save();

        // Update document with lease ID
        document.relatedTo.id = lease._id;
        await document.save();

        // Also link document to tenant for easy access
        const tenantDoc = new Document({
            title: document.title,
            type: "lease",
            fileName: document.fileName,
            url: document.url,
            size: document.size,
            mimeType: document.mimeType,
            uploadedBy: req.session.userId,
            relatedTo: {
                model: "User",
                id: tenantId,
            },
            sharedWith: [tenantId],
        });
        await tenantDoc.save();

        // Notify tenant
        await Notification.create({
            recipient: tenantId,
            type: "system",
            title: "Lease Created",
            message: `Your lease agreement for Unit ${unit.unitNumber} has been created and is now active`,
            relatedModel: "Lease",
            relatedId: lease._id,
            priority: "high",
        });

        res.json({
            success: true,
            message: "Lease created successfully",
            data: lease,
        });
    } catch (error) {
        logger.error(`Create lease with document error: ${error}`);
        res.status(500).json({
            success: false,
            message: `Failed to create lease: ${error.message}`,
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
                message: "Lease not found",
            });
        }

        // Don't allow changing tenant or unit through update
        delete updates.tenant;
        delete updates.unit;

        Object.keys(updates).forEach((key) => {
            lease[key] = updates[key];
        });

        await lease.save();

        res.json({
            success: true,
            message: "Lease updated successfully",
        });
    } catch (error) {
        logger.error(`Update lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to update lease",
        });
    }
};

// Terminate Lease
exports.terminateLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const { reason } = req.body;

        const lease = await Lease.findById(leaseId).populate("tenant unit");
        if (!lease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found",
            });
        }

        lease.status = "terminated";
        lease.notes = lease.notes
            ? `${lease.notes}\n\nTermination reason: ${reason}`
            : `Termination reason: ${reason}`;
        await lease.save();

        // Notify tenant
        await Notification.create({
            recipient: lease.tenant._id,
            type: "system",
            title: "Lease Terminated",
            message: `Your lease for Unit ${lease.unit.unitNumber} has been terminated`,
            relatedModel: "Lease",
            relatedId: lease._id,
            priority: "high",
        });

        res.json({
            success: true,
            message: "Lease terminated successfully",
        });
    } catch (error) {
        logger.error(`Terminate lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to terminate lease",
        });
    }
};

// Get Lease Details
exports.getLease = async (req, res) => {
    try {
        const { leaseId } = req.params;

        const lease = await Lease.findById(leaseId)
            .populate("tenant", "firstName lastName email phone")
            .populate("unit");

        if (!lease) {
            return res.status(404).json({
                success: false,
                message: "Lease not found",
            });
        }

        res.json({
            success: true,
            data: lease,
        });
    } catch (error) {
        logger.error(`Get lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to get lease",
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
            .populate("tenant", "firstName lastName email")
            .populate("unit", "unitNumber")
            .sort("-createdAt");

        res.json({
            success: true,
            data: leases,
        });
    } catch (error) {
        logger.error(`Get leases error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to get leases",
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
                message: "Lease not found",
            });
        }

        if (currentLease.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Can only renew active leases",
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
            status: "pending",
        });

        await renewalLease.save();

        res.json({
            success: true,
            message: "Lease renewal created",
            leaseId: renewalLease._id,
        });
    } catch (error) {
        logger.error(`Renew lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to renew lease",
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
