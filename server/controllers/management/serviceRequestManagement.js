const ServiceRequest = require("../../../models/ServiceRequest");
const Notification = require("../../../models/Notification");
const { logger } = require("../../logger");

// Get Service Requests
exports.getServiceRequests = async (req, res) => {
    try {
        const requests = await ServiceRequest.find()
            .populate("tenant", "firstName lastName")
            .populate("unit", "unitNumber")
            .populate("assignedTo", "firstName lastName")
            .sort("-createdAt");

        res.render("manager/service-requests", {
            title: "Service Requests",
            additionalCSS: ["common.css", "service-requests.css", "manager.css"],
            additionalJS: ["common.js", "service-requests.js", "manager.js"],
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