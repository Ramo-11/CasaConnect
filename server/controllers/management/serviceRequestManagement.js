const ServiceRequest = require("../../../models/ServiceRequest");
const Notification = require("../../../models/Notification");
const { logger } = require("../../logger");

// Get Service Requests
exports.getServiceRequests = async (req, res) => {
    try {
        const storageService = require('../../services/storageService');
        
        const requestsRaw = await ServiceRequest.find()
            .populate("tenant", "firstName lastName")
            .populate("unit", "unitNumber")
            .populate("assignedTo", "firstName lastName")
            .sort("-createdAt")
            .lean();

        // Sign photo URLs for each request
        const requests = await Promise.all(
            requestsRaw.map(async (request) => {
                // Sign photos if they exist
                if (request.photos && request.photos.length > 0) {
                    const signedPhotos = await Promise.all(
                        request.photos.map(async (photo) => {
                            try {
                                const signedUrl = await storageService.getServicePhotoSignedUrl(
                                    photo.fileName,
                                    3600 // 1 hour expiry
                                );
                                return {
                                    ...photo,
                                    url: signedUrl
                                };
                            } catch (error) {
                                logger.warn(`Failed to sign photo URL for ${photo.fileName}: ${error.message}`);
                                return {
                                    ...photo,
                                    url: null // Will filter out later
                                };
                            }
                        })
                    );
                    
                    // Filter out photos that failed to get signed URLs
                    request.photos = signedPhotos.filter(p => p.url !== null);
                }
                
                return request;
            })
        );

        res.render("manager/service-requests", {
            title: "Service Requests",
            additionalCSS: ["manager/service-requests.css"],
            additionalJS: ["manager/service-requests.js"],
            layout: "layout",
            requests,
        });
    } catch (error) {
        logger.error(`Get service requests error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load service requests",
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
                message: "Service request not found",
            });
        }

        // Update request
        request.assignedTo = technicianId;
        request.assignedBy = req.session.userId;
        request.status = "assigned";

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
            type: "service_request_assigned",
            title: "New Service Request Assigned",
            message: `You have been assigned to a ${request.category} request`,
            relatedModel: "ServiceRequest",
            relatedId: request._id,
        });

        res.json({
            success: true,
            message: "Technician assigned successfully",
        });
    } catch (error) {
        logger.error(`Assign technician error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to assign technician",
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
                message: "Service request not found",
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
            message: "Note added successfully",
        });
    } catch (error) {
        logger.error(`Add note error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to add note",
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
                message: "Service request not found",
            });
        }

        request.status = status;

        if (status === "completed") {
            request.completedAt = new Date();
        }

        await request.save();

        // Notify tenant
        await Notification.create({
            recipient: request.tenant,
            type: "service_request_updated",
            title: "Service Request Updated",
            message: `Your service request has been ${status}`,
            relatedModel: "ServiceRequest",
            relatedId: request._id,
        });

        res.json({
            success: true,
            message: "Status updated successfully",
        });
    } catch (error) {
        logger.error(`Update status error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to update status",
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
                message: "Service request not found",
            });
        }
        
        // Delete any associated photos if they exist
        if (request.photos && request.photos.length > 0) {
            const storageService = require('../../services/storageService');
            const photoFileNames = request.photos.map(p => p.fileName).filter(Boolean);
            if (photoFileNames.length > 0) {
                await storageService.deleteServicePhotos(photoFileNames).catch(err => {
                    logger.warn(`Failed to delete photos for request ${requestId}: ${err.message}`);
                });
            }
        }
        
        await request.deleteOne();
        logger.info(`Service request ${requestId} deleted by user ${req.session.userId}`);
        
        res.json({
            success: true,
            message: "Request deleted successfully",
        });
    } catch (error) {
        logger.error(`Delete request error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to delete request",
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
                message: "Service request not found",
            });
        }

        request.status = "cancelled";
        await request.save();

        res.json({
            success: true,
            message: "Request cancelled successfully",
        });
    } catch (error) {
        logger.error(`Cancel request error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to cancel request",
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
            message: "Failed to check updates",
        });
    }
};