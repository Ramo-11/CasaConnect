const User = require("../../models/User");
const Lease = require('../../models/Lease');
const Unit = require("../../models/Unit");
const ServiceRequest = require("../../models/ServiceRequest");
const Payment = require("../../models/Payment");
const Notification = require("../../models/Notification");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { logger } = require("../logger");

// Email transporter configuration
const getEmailTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
};

// Get Manager Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const managerId = req.session.userId;
        const manager = await User.findById(managerId);

        // Get all units
        const units = await Unit.find();
        const totalUnits = units.length;
        
        // Get active leases to determine occupied units
        const activeLeases = await Lease.find({ status: 'active' }).populate('unit');
        const occupiedUnitIds = activeLeases.map(lease => lease.unit._id.toString());
        
        const occupiedUnits = occupiedUnitIds.length;
        const availableUnits = totalUnits - occupiedUnits;

        // Get available units list (units without active leases)
        const availableUnitsList = units
            .filter(u => !occupiedUnitIds.includes(u._id.toString()))
            .map(u => ({
                id: u._id,
                unitNumber: u.unitNumber,
                building: u.building,
                bedrooms: u.bedrooms,
                bathrooms: u.bathrooms,
                squareFeet: u.squareFeet,
                monthlyRent: u.monthlyRent,
            }));

        // Get active service requests count
        const activeRequests = await ServiceRequest.countDocuments({
            status: { $in: ["pending", "assigned", "in_progress"] },
        });

        // Get tenants with their active leases
        const tenants = await User.find({ role: "tenant" })
            .sort("-createdAt")
            .lean();

        // Get all active leases in one query for efficiency
        const tenantIds = tenants.map(t => t._id);
        const tenantLeases = await Lease.find({
            tenant: { $in: tenantIds },
            status: 'active'
        }).populate('unit');

        // Create a map for quick lease lookup
        const leaseMap = {};
        tenantLeases.forEach(lease => {
            leaseMap[lease.tenant.toString()] = lease;
        });

        // Format tenant data
        const formattedTenants = await Promise.all(
            tenants.map(async (tenant) => {
                const activeLease = leaseMap[tenant._id.toString()];
                
                // Check payment status
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                let rentPaid = false;
                if (activeLease) {
                    rentPaid = await Payment.findOne({
                        tenant: tenant._id,
                        lease: activeLease._id,
                        type: "rent",
                        month: currentMonth,
                        year: currentYear,
                        status: "completed",
                    });
                }

                return {
                    id: tenant._id,
                    fullName: `${tenant.firstName} ${tenant.lastName}`,
                    email: tenant.email,
                    phone: tenant.phone,
                    unitNumber: activeLease?.unit?.unitNumber || "Unassigned",
                    leaseEnd: activeLease ? formatDate(activeLease.endDate) : "N/A",
                    paymentStatus: rentPaid ? "current" : (activeLease ? "due" : "no-lease"),
                    hasActiveLease: !!activeLease
                };
            })
        );

        // Get recent service requests
        const recentRequests = await ServiceRequest.find()
            .populate("unit", "unitNumber")
            .populate("tenant", "firstName lastName")
            .sort("-createdAt")
            .limit(5)
            .lean();

        const formattedRequests = recentRequests.map((req) => ({
            id: req._id,
            title: req.title,
            unitNumber: req.unit ? req.unit.unitNumber : "N/A",
            category: req.category.replace("_", " "),
            priority: req.priority,
            status: req.status.replace("_", " "),
            date: formatDate(req.createdAt),
        }));

        // Get upcoming lease expirations (next 60 days)
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
        
        const expiringLeases = await Lease.find({
            status: 'active',
            endDate: { 
                $gte: new Date(),
                $lte: sixtyDaysFromNow 
            }
        })
        .populate('tenant', 'firstName lastName')
        .populate('unit', 'unitNumber')
        .sort('endDate')
        .limit(5);

        const formattedExpiringLeases = expiringLeases.map(lease => ({
            id: lease._id,
            tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
            unitNumber: lease.unit.unitNumber,
            endDate: formatDate(lease.endDate),
            daysRemaining: lease.daysRemaining
        }));

        res.render("manager/dashboard", {
            title: "Manager Dashboard",
            layout: "layout",
            additionalCSS: ["common.css", "manager.css"],
            additionalJS: ["common.js", "manager.js"],
            user: manager,
            totalUnits,
            occupiedUnits,
            availableUnits,
            activeRequests,
            tenants: formattedTenants,
            availableUnitsList,
            recentRequests: formattedRequests,
            expiringLeases: formattedExpiringLeases, // New data
            portalUrl: process.env.PORTAL_URL || "http://localhost:3000",
        });
    } catch (error) {
        logger.error(`Dashboard error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load dashboard",
        });
    }
};

// Create Tenant Account
exports.createTenant = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            password,
            unitId,
            leaseStart,
            leaseEnd,
            sendCredentials,
        } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered",
            });
        }

        // Create tenant account
        const tenant = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            password, // Will be hashed by pre-save hook
            role: "tenant",
            unitId: unitId || null,
            isActive: true,
        });

        await tenant.save();

        // Update unit status
        if (unitId && leaseStart && leaseEnd) {
            const unit = await Unit.findById(unitId);
            const lease = new Lease({
                tenant: tenant._id,
                unit: unitId,
                startDate: new Date(leaseStart),
                endDate: new Date(leaseEnd),
                monthlyRent: unit.monthlyRent,
                securityDeposit: unit.monthlyRent, // or from req.body
                status: 'active'
            });
            await lease.save();
        }

        // Send credentials email if requested
        if (sendCredentials === "true" || sendCredentials === true) {
            await sendCredentialsEmail(tenant, password);
        }

        // Create notification for manager
        await Notification.create({
            recipient: req.session.userId,
            type: "system",
            title: "Tenant Account Created",
            message: `Account created for ${tenant.fullName}`,
        });

        res.json({
            success: true,
            message: "Tenant account created successfully",
            tenantId: tenant._id,
        });
    } catch (error) {
        logger.error(`Create tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to create tenant account",
        });
    }
};

// Send Credentials to Tenant
exports.sendCredentials = async (req, res) => {
    try {
        const { tenantId, newPassword } = req.body;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        let password = newPassword;

        // Update password if new one provided
        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            tenant.password = await bcrypt.hash(newPassword, salt);
            await tenant.save();
        } else {
            // Generate new temporary password
            password = generateTempPassword();
            const salt = await bcrypt.genSalt(10);
            tenant.password = await bcrypt.hash(password, salt);
            await tenant.save();
        }

        // Send email with credentials
        await sendCredentialsEmail(tenant, password);

        res.json({
            success: true,
            message: "Credentials sent successfully",
        });
    } catch (error) {
        logger.error(`Send credentials error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to send credentials",
        });
    }
};

// View Tenant Details
exports.viewTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await User.findById(tenantId).populate("unitId");
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).render("error", {
                title: "Tenant Not Found",
                message: "Tenant not found",
            });
        }

        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active'
        }).populate('unit');

        // Get payment history
        const payments = await Payment.find({ tenant: tenantId })
            .sort("-createdAt")
            .limit(12);

        // Get service requests
        const serviceRequests = await ServiceRequest.find({ tenant: tenantId })
            .sort("-createdAt")
            .limit(10);

        res.render("manager/tenant-details", {
            title: `Tenant: ${tenant.firstName} ${tenant.lastName}`,
            layout: "layout",
            additionalCSS: ["common.css", "tenant-details.css"],
            additionalJS: ["common.js", "tenant-details.js"],
            tenant,
            activeLease,
            payments,
            serviceRequests,
        });
    } catch (error) {
        logger.error(`View tenant error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load tenant details",
        });
    }
};

// Edit Tenant
exports.editTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await User.findById(tenantId).populate("unitId");
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).render("error", {
                title: "Tenant Not Found",
                message: "Tenant not found",
            });
        }

        // Get all units (available ones and the current tenant's unit)
        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active'
        }).populate('unit');

        const availableUnits = await Unit.find({ status: "available" });
        if (activeLease && activeLease.unit) {
            availableUnits.push(activeLease.unit);
        }

        res.render("manager/tenant-edit", {
            title: `Edit Tenant: ${tenant.firstName} ${tenant.lastName}`,
            layout: "layout",
            additionalCSS: ['common.css', 'tenant-edit.css'],
            additionalJS: ['common.js', 'tenant-edit.js'],
            tenant,
            availableUnits,
        });
    } catch (error) {
        logger.error(`Edit tenant error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load tenant edit form",
        });
    }
};

// Update Tenant
exports.updateTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        // Update tenant fields
        Object.keys(updates).forEach((key) => {
            if (key !== "password" && key !== "_id" && key !== "role") {
                tenant[key] = updates[key];
            }
        });

        await tenant.save();

        res.json({
            success: true,
            message: "Tenant updated successfully",
        });
    } catch (error) {
        logger.error(`Update tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to update tenant",
        });
    }
};

// Get Units List
exports.getUnits = async (req, res) => {
    try {
        // Get tenants without units for assignment
        const availableTenants = await User.find({
            role: "tenant",
            unitId: null,
        }).select("firstName lastName email");

        const units = await Unit.find()
            .populate("currentTenant", "firstName lastName email phone")
            .sort("unitNumber");

        res.render("manager/units", {
            title: "Units Management",
            layout: "layout",
            additionalCSS: ["common.css", "units.css", "manager.css"],
            additionalJS: ["units.js", "manager.js"],
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
            units,
            availableTenants,
        });
    } catch (error) {
        logger.error(`Get units error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load units",
        });
    }
};

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
            additionalCSS: [
                "common.css",
                "service-requests.css",
                "manager.css",
            ],
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

// Get Dashboard Stats (API)
exports.getDashboardStats = async (req, res) => {
    try {
        const units = await Unit.find();
        const totalUnits = units.length;
        const occupiedUnits = units.filter(
            (u) => u.status === "occupied"
        ).length;
        const availableUnits = units.filter(
            (u) => u.status === "available"
        ).length;

        const activeRequests = await ServiceRequest.countDocuments({
            status: { $in: ["pending", "assigned", "in_progress"] },
        });

        res.json({
            success: true,
            data: {
                totalUnits,
                occupiedUnits,
                availableUnits,
                activeRequests,
            },
        });
    } catch (error) {
        logger.error(`Dashboard stats error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to get dashboard stats",
        });
    }
};

// Helper Functions
function formatDate(date) {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function generateTempPassword() {
    const length = 12;
    const charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";

    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
}

async function sendCredentialsEmail(tenant, password) {
    const transporter = getEmailTransporter();

    const mailOptions = {
        from: process.env.EMAIL_USER || "noreply@casaconnect.com",
        to: tenant.email,
        subject: "Your CasaConnect Portal Login Credentials",
        html: `
      <h2>Welcome to CasaConnect Portal</h2>
      <p>Dear ${tenant.firstName},</p>
      <p>Your account has been created. Here are your login credentials:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Portal URL:</strong> ${
            process.env.PORTAL_URL || "http://localhost:3000"
        }</p>
        <p><strong>Email:</strong> ${tenant.email}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
      </div>
      <p><strong>Important:</strong> You will be required to change your password upon first login.</p>
      <p>If you have any questions, please contact our office.</p>
      <p>Best regards,<br>CasaConnect Management</p>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Credentials email sent to: ${tenant.email}`);
    } catch (error) {
        logger.error(`Email send error: ${error}`);
        throw error;
    }
}

// Add these methods to your existing managerController.js

// ============ UNITS MANAGEMENT ============

// Create Unit (API)
exports.createUnit = async (req, res) => {
    try {
        const unitData = req.body;

        // Check if unit number already exists
        const existingUnit = await Unit.findOne({
            unitNumber: unitData.unitNumber,
        });
        if (existingUnit) {
            return res.status(400).json({
                success: false,
                message: "Unit number already exists",
            });
        }

        // Clean up optional fields
        if (!unitData.building || unitData.building === "") {
            delete unitData.building;
        }
        if (!unitData.floor || unitData.floor === "") {
            delete unitData.floor;
        }

        const unit = new Unit(unitData);
        if (unitData.status === "occupied" && unitData.currentTenant) {
            unit.currentTenant = unitData.currentTenant;
            await unit.save();

            // Update tenant with unit assignment
            await User.findByIdAndUpdate(unitData.currentTenant, {
                unitId: unit._id,
            });
        } else {
            await unit.save();
        }

        res.json({
            success: true,
            message: "Unit created successfully",
            data: unit,
        });
    } catch (error) {
        console.error("Create unit error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create unit",
        });
    }
};

// Get Single Unit (API)
exports.getUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const unit = await Unit.findById(unitId).populate("currentTenant");

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found",
            });
        }

        res.json({
            success: true,
            data: unit,
        });
    } catch (error) {
        console.error("Get unit error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get unit",
        });
    }
};

// Update Unit (API)
exports.updateUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const updates = req.body;

        const unit = await Unit.findByIdAndUpdate(
            unitId,
            { ...updates, updatedAt: new Date() },
            { new: true }
        );

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: "Unit not found",
            });
        }

        res.json({
            success: true,
            message: "Unit updated successfully",
            data: unit,
        });
    } catch (error) {
        console.error("Update unit error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update unit",
        });
    }
};

// Delete Unit (API)
exports.deleteUnit = async (req, res) => {
    try {
        const { unitId } = req.params;

        // Check if unit is occupied
        const unit = await Unit.findById(unitId);
        if (!unit) {
            logger.error("Error deleting unit: Unit not found");
            return res.status(404).json({
                success: false,
                message: "Unit not found",
            });
        }

        if (unit.status === "occupied" && unit.currentTenant) {
            logger.error("Error deleting unit: Attempt to delete occupied unit");
            return res.status(400).json({
                success: false,
                message:
                    "Cannot delete occupied unit. Please remove tenant first.",
            });
        }

        await Unit.findByIdAndDelete(unitId);
        logger.info(`Unit deleted successfully: ${unitId}`);

        res.json({
            success: true,
            message: "Unit deleted successfully",
        });
    } catch (error) {
        logger.error(`Error deleting unit: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to delete unit",
        });
    }
};

// Get Units Stats (API)
exports.getUnitsStats = async (req, res) => {
    try {
        const units = await Unit.find();

        const stats = {
            total: units.length,
            available: units.filter((u) => u.status === "available").length,
            occupied: units.filter((u) => u.status === "occupied").length,
            maintenance: units.filter((u) => u.status === "maintenance").length,
            reserved: units.filter((u) => u.status === "reserved").length,
        };

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error("Get units stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get units stats",
        });
    }
};

// ============ SERVICE REQUESTS MANAGEMENT ============

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
        console.error("Assign technician error:", error);
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
        console.error("Add note error:", error);
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
        console.error("Update status error:", error);
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
        console.error("Cancel request error:", error);
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
        console.error("Check updates error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check updates",
        });
    }
};

// Get Tenants List
exports.getTenants = async (req, res) => {
    try {
        // Get all tenants with their units
        const tenants = await User.find({ role: "tenant" })
            .populate("unitId")
            .sort("-createdAt");

        // Get available units for assignment
        const availableUnits = await Unit.find({ status: "available" });

        // Check payment status for each tenant
        const tenantsWithPaymentStatus = await Promise.all(
            tenants.map(async (tenant) => {
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                const rentPaid = await Payment.findOne({
                    tenant: tenant._id,
                    type: "rent",
                    month: currentMonth,
                    year: currentYear,
                    status: "completed",
                });

                return {
                    ...tenant.toObject(),
                    paymentStatus: rentPaid ? "current" : "due",
                };
            })
        );

        res.render("manager/tenants", {
            title: "Tenants Management",
            layout: "layout",
            additionalCSS: ["common.css", "tenants.css"],
            additionalJS: ["common.js", "tenants.js"],
            tenants: tenantsWithPaymentStatus,
            availableUnits,
        });
    } catch (error) {
        logger.error(`Get tenants error: ${error}`);
        res.status(500).render("error", {
            title: "Error",
            message: "Failed to load tenants",
        });
    }
};

// Assign Unit to Tenant (API)
exports.assignUnitToTenant = async (req, res) => {
    try {
        const { tenantId, unitId } = req.body;

        // Update tenant
        await User.findByIdAndUpdate(tenantId, { unitId });

        // Update unit
        await Unit.findByIdAndUpdate(unitId, {
            status: "occupied",
            currentTenant: tenantId,
            updatedAt: new Date(),
        });

        res.json({
            success: true,
            message: "Unit assigned successfully",
        });
    } catch (error) {
        logger.error(`Assign unit to tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to assign unit",
        });
    }
};

// Assign Tenant to Unit (API) - reverse direction
exports.assignTenantToUnit = async (req, res) => {
    try {
        const { unitId, tenantId } = req.body;

        // Update tenant
        await User.findByIdAndUpdate(tenantId, { unitId });

        // Update unit
        await Unit.findByIdAndUpdate(unitId, {
            status: "occupied",
            currentTenant: tenantId,
            updatedAt: new Date(),
        });

        res.json({
            success: true,
            message: "Tenant assigned successfully",
        });
    } catch (error) {
        logger.error(`Assign tenant to unit error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to assign tenant",
        });
    }
};

// Delete Tenant (API)
exports.deleteTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        // If tenant has a unit, update unit status
        if (tenant.unitId) {
            await Unit.findByIdAndUpdate(tenant.unitId, {
                status: "available",
                currentTenant: null,
                updatedAt: new Date(),
            });
        }

        // Delete tenant
        await User.findByIdAndDelete(tenantId);

        res.json({
            success: true,
            message: "Tenant deleted successfully",
        });
    } catch (error) {
        logger.error(`Delete tenant error: ${error}`);
        res.status(500).json({
            success: false,
            message: "Failed to delete tenant",
        });
    }
};
