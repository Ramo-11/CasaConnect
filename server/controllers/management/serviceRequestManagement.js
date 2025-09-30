const ServiceRequest = require('../../../models/ServiceRequest');
const Notification = require('../../../models/Notification');
const { getManagerAccessibleUnits } = require('../../utils/accessControl');
const storageService = require('../../services/storageService');
const User = require('../../../models/User');
const Unit = require('../../../models/Unit');
const Lease = require('../../../models/Lease');
const { canAccessUnit } = require('../../utils/accessControl');
const { logger } = require('../../logger');

// Get Service Requests
exports.getServiceRequests = async (req, res) => {
    try {
        const storageService = require('../../services/storageService');
        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        // Get accessible units
        const accessibleUnits = await getManagerAccessibleUnits(managerId, userRole);

        // Build filter
        const filter = {};
        if (accessibleUnits !== null) {
            filter.unit = { $in: accessibleUnits };
        }

        const requestsRaw = await ServiceRequest.find(filter)
            .populate('tenant', 'firstName lastName')
            .populate('unit', 'unitNumber')
            .populate('assignedTo', 'firstName lastName')
            .sort('-createdAt')
            .lean();

        // Sign photo URLs for each request
        const requests = await Promise.all(
            requestsRaw.map(async (request) => {
                if (request.photos && request.photos.length > 0) {
                    const signedPhotos = await Promise.all(
                        request.photos.map(async (photo) => {
                            try {
                                const signedUrl = await storageService.getServicePhotoSignedUrl(
                                    photo.fileName,
                                    3600
                                );
                                return {
                                    ...photo,
                                    url: signedUrl,
                                };
                            } catch (error) {
                                logger.warn(
                                    `Failed to sign photo URL for ${photo.fileName}: ${error.message}`
                                );
                                return {
                                    ...photo,
                                    url: null,
                                };
                            }
                        })
                    );

                    request.photos = signedPhotos.filter((p) => p.url !== null);
                }

                return request;
            })
        );

        // Get active leases with tenant and unit info for the create modal
        let leasesFilter = { status: 'active' };

        // For restricted managers, only show leases on accessible units
        if (accessibleUnits !== null) {
            leasesFilter.unit = { $in: accessibleUnits };
        }

        // Get all active leases with populated tenant and unit
        const activeLeases = await Lease.find(leasesFilter)
            .populate('tenant', 'firstName lastName email')
            .populate('unit', 'unitNumber streetAddress')
            .lean();

        // Create tenant-unit mapping for frontend
        const tenantUnitMap = {};
        const unitTenantMap = {};

        activeLeases.forEach((lease) => {
            if (lease.tenant && lease.unit) {
                tenantUnitMap[lease.tenant._id.toString()] = lease.unit._id.toString();
                unitTenantMap[lease.unit._id.toString()] = lease.tenant._id.toString();
            }
        });

        // Extract unique tenants and units from active leases
        const tenants = activeLeases
            .map((lease) => lease.tenant)
            .filter(
                (tenant, index, self) =>
                    tenant &&
                    self.findIndex((t) => t._id.toString() === tenant._id.toString()) === index
            )
            .sort((a, b) => a.firstName.localeCompare(b.firstName));

        const units = activeLeases
            .map((lease) => lease.unit)
            .filter(
                (unit, index, self) =>
                    unit &&
                    self.findIndex((u) => u._id.toString() === unit._id.toString()) === index
            )
            .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }));

        res.render('manager/service-requests', {
            title: 'Service Requests',
            additionalCSS: ['manager/service-requests.css'],
            additionalJS: ['manager/service-requests.js'],
            layout: 'layout',
            requests,
            tenants,
            units,
            tenantUnitMap: JSON.stringify(tenantUnitMap),
            unitTenantMap: JSON.stringify(unitTenantMap),
        });
    } catch (error) {
        logger.error(`Get service requests error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load service requests',
        });
    }
};

// Create Service Request (Manager creating on behalf of tenant)
exports.createServiceRequest = async (req, res) => {
    try {
        const {
            tenant,
            unit,
            category,
            priority,
            title,
            description,
            location,
            preferredDate,
            preferredTime,
        } = req.body;

        const managerId = req.session.userId;
        const userRole = req.session.userRole;

        // Verify tenant exists and is a tenant
        const tenantUser = await User.findById(tenant);
        if (!tenantUser || tenantUser.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found',
            });
        }

        // Verify unit exists
        const unitDoc = await Unit.findById(unit);
        if (!unitDoc) {
            return res.status(404).json({
                success: false,
                message: 'Unit not found',
            });
        }

        // Check access for restricted managers
        if (userRole === 'restricted_manager') {
            if (!(await canAccessUnit(managerId, userRole, unit))) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this unit',
                });
            }
        }

        // Handle photo uploads if provided
        const photos = [];
        if (req.files && req.files.length > 0) {
            const storageService = require('../../services/storageService');
            for (const file of req.files) {
                try {
                    const uploadResult = await storageService.uploadServicePhoto(file);
                    photos.push({
                        url: uploadResult.url,
                        fileName: uploadResult.fileName,
                        originalName: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        uploadedAt: new Date(),
                    });
                } catch (uploadError) {
                    logger.warn(`Failed to upload photo: ${uploadError.message}`);
                }
            }
        }

        // Create service request
        const serviceRequest = new ServiceRequest({
            tenant,
            unit,
            category,
            priority: priority || 'medium',
            title,
            description,
            location,
            preferredDate: preferredDate ? new Date(preferredDate) : null,
            preferredTime,
            photos,
            status: 'pending',
            fee: 10, // Default fee
        });

        await serviceRequest.save();

        // Add note indicating manager created it
        serviceRequest.notes.push({
            author: managerId,
            content: 'Service request created by manager on behalf of tenant',
            createdAt: new Date(),
        });
        await serviceRequest.save();

        // Notify tenant
        await Notification.create({
            recipient: tenant,
            type: 'service_request_new',
            title: 'Service Request Created',
            message: `A service request has been created for your unit: ${title}`,
            relatedModel: 'ServiceRequest',
            relatedId: serviceRequest._id,
            priority: priority === 'emergency' ? 'high' : 'normal',
        });

        logger.info(
            `Service request created by manager ${managerId} for tenant ${tenant}, unit ${unit}`
        );

        res.json({
            success: true,
            message: 'Service request created successfully',
            data: serviceRequest,
        });
    } catch (error) {
        logger.error(`Create service request error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create service request',
        });
    }
};

// Assign Technician to Request (API)
exports.assignTechnician = async (req, res) => {
    try {
        const { requestId, technicianId, note, scheduledDate } = req.body;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        // Update request
        request.assignedTo = technicianId;
        request.assignedBy = req.session.userId;
        request.status = 'assigned';

        // Add assignment note if provided
        if (note) {
            request.notes.push({
                author: req.session.userId,
                content: `Assignment: ${note}`,
                createdAt: new Date(),
            });
        }

        await request.save();

        // Create notification for technician
        await Notification.create({
            recipient: technicianId,
            type: 'service_request_assigned',
            title: 'New Service Request Assigned',
            message: `You have been assigned to a ${request.category} request`,
            relatedModel: 'ServiceRequest',
            relatedId: request._id,
        });

        res.json({
            success: true,
            message: 'Technician assigned successfully',
        });
    } catch (error) {
        logger.error(`Assign technician error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to assign technician',
        });
    }
};

// Add Note to Request (API)
exports.addRequestNote = async (req, res) => {
    try {
        const { requestId, content } = req.body;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        request.notes.push({
            author: req.session.userId,
            content,
            createdAt: new Date(),
        });

        await request.save();

        res.json({
            success: true,
            message: 'Note added successfully',
        });
    } catch (error) {
        logger.error(`Add note error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to add note',
        });
    }
};

// Update Request Status (API)
exports.updateRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        request.status = status;

        if (status === 'completed') {
            request.completedAt = new Date();
        }

        await request.save();

        // Notify tenant
        await Notification.create({
            recipient: request.tenant,
            type: 'service_request_updated',
            title: 'Service Request Updated',
            message: `Your service request has been ${status}`,
            relatedModel: 'ServiceRequest',
            relatedId: request._id,
        });

        res.json({
            success: true,
            message: 'Status updated successfully',
        });
    } catch (error) {
        logger.error(`Update status error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to update status',
        });
    }
};

// Delete Request (API)
exports.deleteRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        // Delete any associated photos if they exist
        if (request.photos && request.photos.length > 0) {
            const storageService = require('../../services/storageService');
            const photoFileNames = request.photos.map((p) => p.fileName).filter(Boolean);
            if (photoFileNames.length > 0) {
                await storageService.deleteServicePhotos(photoFileNames).catch((err) => {
                    logger.warn(`Failed to delete photos for request ${requestId}: ${err.message}`);
                });
            }
        }

        await request.deleteOne();
        logger.info(`Service request ${requestId} deleted by user ${req.session.userId}`);

        res.json({
            success: true,
            message: 'Request deleted successfully',
        });
    } catch (error) {
        logger.error(`Delete request error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete request',
        });
    }
};

// Cancel Request (API)
exports.cancelRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        const request = await ServiceRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        request.status = 'cancelled';
        await request.save();

        res.json({
            success: true,
            message: 'Request cancelled successfully',
        });
    } catch (error) {
        logger.error(`Cancel request error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel request',
        });
    }
};

// Check for Updates (API)
exports.checkRequestUpdates = async (req, res) => {
    try {
        // Check if there are any new requests in the last minute
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const newRequests = await ServiceRequest.countDocuments({
            createdAt: { $gte: oneMinuteAgo },
        });

        res.json({
            success: true,
            data: {
                hasUpdates: newRequests > 0,
            },
        });
    } catch (error) {
        logger.error(`Check updates error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to check updates',
        });
    }
};
