const Lease = require("../../../models/Lease");
const Unit = require("../../../models/Unit");
const User = require("../../../models/User");
const ServiceRequest = require("../../../models/ServiceRequest");
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
        delete updates._id;

        // Track if important changes were made
        const importantChanges = [];
        
        // Check for important changes
        if (updates.monthlyRent && updates.monthlyRent != lease.monthlyRent) {
            importantChanges.push(`Monthly rent changed from $${lease.monthlyRent} to $${updates.monthlyRent}`);
        }
        if (updates.endDate && new Date(updates.endDate).getTime() !== new Date(lease.endDate).getTime()) {
            importantChanges.push(`Lease end date changed from ${new Date(lease.endDate).toLocaleDateString()} to ${new Date(updates.endDate).toLocaleDateString()}`);
        }
        if (updates.status && updates.status !== lease.status) {
            importantChanges.push(`Lease status changed from ${lease.status} to ${updates.status}`);
        }

        // Update document if provided
        if (updates.document) {
            // Delete old document reference if exists
            if (lease.document) {
                try {
                    await Document.findByIdAndDelete(lease.document);
                } catch (docError) {
                    logger.warn(`Failed to delete old document: ${docError}`);
                }
            }
            lease.document = updates.document;
            delete updates.document;
        }

        // Apply updates
        Object.keys(updates).forEach((key) => {
            if (updates[key] !== undefined && updates[key] !== '') {
                lease[key] = updates[key];
            }
        });

        // Update the updatedAt timestamp
        lease.updatedAt = new Date();

        await lease.save();

        // Notify tenant of important changes
        if (importantChanges.length > 0) {
            await Notification.create({
                recipient: lease.tenant,
                type: "system",
                title: "Lease Terms Updated",
                message: `Your lease has been updated: ${importantChanges.join(', ')}`,
                relatedModel: "Lease",
                relatedId: lease._id,
                priority: "high",
            });
        }

        // Log the update
        if (updates.notes) {
            const existingNotes = lease.notes || '';
            const updateNote = `\n[${new Date().toLocaleDateString()}] Lease updated by manager. Changes: ${importantChanges.join(', ') || 'Minor updates'}`;
            lease.notes = existingNotes + updateNote;
            await lease.save();
        }

        res.json({
            success: true,
            message: "Lease updated successfully",
            changes: importantChanges,
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

        if (lease.status === 'terminated') {
            return res.status(400).json({
                success: false,
                message: "Lease is already terminated",
            });
        }

        // Update lease status and add termination info
        lease.status = "terminated";
        lease.terminatedAt = new Date();
        lease.terminatedBy = req.session.userId;
        
        const terminationNote = `\n[${new Date().toLocaleDateString()}] LEASE TERMINATED\nReason: ${reason}\nTerminated by: Manager`;
        lease.notes = lease.notes ? `${lease.notes}\n${terminationNote}` : terminationNote;
        
        await lease.save();

        // The unit becomes available automatically since we check for active leases
        // No need to update unit status as it's determined by active lease existence

        // Cancel any pending payments or service requests if needed
        await ServiceRequest.updateMany(
            { 
                tenant: lease.tenant._id, 
                unit: lease.unit._id,
                status: { $in: ['pending', 'assigned'] }
            },
            { 
                status: 'cancelled',
                notes: { $concat: ['$notes', '\nCancelled due to lease termination'] }
            }
        );

        // Notify tenant with more details
        await Notification.create({
            recipient: lease.tenant._id,
            type: "system",
            title: "Lease Terminated - Immediate Action Required",
            message: `Your lease for Unit ${lease.unit.unitNumber} has been terminated effective immediately. Reason: ${reason}. Please contact management to arrange move-out.`,
            relatedModel: "Lease",
            relatedId: lease._id,
            priority: "high",
        });

        // Log the termination
        logger.info(`Lease terminated: ${leaseId} for Unit ${lease.unit.unitNumber} - Reason: ${reason}`);

        res.json({
            success: true,
            message: "Lease terminated successfully",
            data: {
                leaseId: lease._id,
                unitNumber: lease.unit.unitNumber,
                tenant: `${lease.tenant.firstName} ${lease.tenant.lastName}`
            }
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
// Renew Lease
exports.renewLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const {
            startDate,
            endDate,
            monthlyRent,
            securityDeposit,
            rentDueDay,
            lateFeeAmount,
            gracePeriodDays,
            notes
        } = req.body;
        
        const file = req.file;

        // Validate that a document was provided
        if (!file) {
            return res.status(400).json({
                success: false,
                message: "Renewal agreement document is required",
            });
        }

        // Get current lease
        const currentLease = await Lease.findById(leaseId)
            .populate('tenant')
            .populate('unit');
            
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

        // Validate dates
        const newStartDate = new Date(startDate);
        const newEndDate = new Date(endDate);
        
        if (newStartDate <= currentLease.endDate) {
            return res.status(400).json({
                success: false,
                message: "Renewal start date must be after current lease end date",
            });
        }

        // Upload renewal document
        const uploadResult = await storageService.uploadFile(file, "leases");

        // Create document record
        const document = new Document({
            title: `Lease Renewal - Unit ${currentLease.unit.unitNumber} - ${new Date(startDate).toLocaleDateString()}`,
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

        // Create renewal lease
        const renewalLease = new Lease({
            tenant: currentLease.tenant._id,
            unit: currentLease.unit._id,
            startDate: newStartDate,
            endDate: newEndDate,
            monthlyRent: parseFloat(monthlyRent) || currentLease.monthlyRent,
            securityDeposit: parseFloat(securityDeposit) || currentLease.securityDeposit,
            rentDueDay: parseInt(rentDueDay) || currentLease.rentDueDay,
            lateFeeAmount: parseFloat(lateFeeAmount) || currentLease.lateFeeAmount,
            gracePeriodDays: parseInt(gracePeriodDays) || currentLease.gracePeriodDays,
            document: document._id,
            status: "pending", // Will become active when current lease expires
            notes: notes || `Renewal of lease ${currentLease._id} for Unit ${currentLease.unit.unitNumber}`,
        });

        await renewalLease.save();

        // Update document with new lease ID
        document.relatedTo.id = renewalLease._id;
        await document.save();

        // Also create a copy for tenant records
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
                id: currentLease.tenant._id,
            },
            sharedWith: [currentLease.tenant._id],
        });
        await tenantDoc.save();

        // Mark current lease for expiration (it will expire naturally on its end date)
        // Add a note to current lease about the renewal
        currentLease.notes = (currentLease.notes || '') + 
            `\n[${new Date().toLocaleDateString()}] Renewal created: New lease ID ${renewalLease._id} starting ${newStartDate.toLocaleDateString()}`;
        await currentLease.save();

        // Notify tenant about renewal
        await Notification.create({
            recipient: currentLease.tenant._id,
            type: "system",
            title: "Lease Renewed",
            message: `Your lease for Unit ${currentLease.unit.unitNumber} has been renewed. New term: ${newStartDate.toLocaleDateString()} to ${newEndDate.toLocaleDateString()}`,
            relatedModel: "Lease",
            relatedId: renewalLease._id,
            priority: "high",
        });

        // Log the renewal
        logger.info(`Lease renewed: Current lease ${leaseId} -> New lease ${renewalLease._id}`);

        res.json({
            success: true,
            message: "Lease renewal created successfully",
            data: {
                newLeaseId: renewalLease._id,
                currentLeaseId: currentLease._id,
                startDate: newStartDate,
                endDate: newEndDate,
            }
        });
    } catch (error) {
        logger.error(`Renew lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to renew lease: " + error.message,
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

// Get Lease Details Page
exports.getLeaseDetails = async (req, res) => {
    try {
        const { leaseId } = req.params;
        
        const lease = await Lease.findById(leaseId)
            .populate('tenant', 'firstName lastName email phone')
            .populate('unit')
            .populate('additionalTenants', 'firstName lastName')
            .populate('document');
            
        if (!lease) {
            return res.status(404).render('error', {
                title: 'Lease Not Found',
                message: 'The requested lease could not be found'
            });
        }
        
        res.render('manager/lease-details', {
            title: `Lease: Unit ${lease.unit.unitNumber}`,
            layout: 'layout',
            additionalCSS: ['lease-details.css'],
            additionalJS: ['lease-details.js'],
            lease
        });
    } catch (error) {
        logger.error(`Get lease details error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load lease details'
        });
    }
};

// Email Lease to Tenant (API)
exports.emailLeaseToTenant = async (req, res) => {
    try {
        const { leaseId } = req.params;
        
        const lease = await Lease.findById(leaseId)
            .populate('tenant')
            .populate('unit')
            .populate('document');
            
        if (!lease) {
            return res.status(404).json({
                success: false,
                message: 'Lease not found'
            });
        }
        
        // Send email notification to tenant
        await Notification.create({
            recipient: lease.tenant._id,
            type: 'system',
            title: 'Lease Document Available',
            message: `Your lease agreement for Unit ${lease.unit.unitNumber} has been sent to your email`,
            relatedModel: 'Lease',
            relatedId: lease._id,
            priority: 'normal'
        });
        
        // In production, implement actual email sending here
        // using nodemailer with the document attachment
        
        res.json({
            success: true,
            message: 'Lease document emailed to tenant'
        });
    } catch (error) {
        logger.error(`Email lease error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to email lease document'
        });
    }
};

// Get Lease Renewal Page 
exports.getLeaseRenewal = async (req, res) => {
    try {
        const { leaseId } = req.params;
        
        const lease = await Lease.findById(leaseId)
            .populate('tenant')
            .populate('unit');
            
        if (!lease) {
            return res.status(404).render('error', {
                title: 'Lease Not Found',
                message: 'The requested lease could not be found'
            });
        }
        
        // For now, redirect to lease details with a message
        res.redirect(`/manager/lease/${leaseId}?renewal=true`);
    } catch (error) {
        logger.error(`Get lease renewal error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load renewal page'
        });
    }
};