const User = require("../../../models/User");
const Lease = require('../../../models/Lease');
const Unit = require("../../../models/Unit");
const Document = require('../../../models/Document');
const Payment = require("../../../models/Payment");
const ServiceRequest = require("../../../models/ServiceRequest");
const Notification = require("../../../models/Notification");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { logger } = require("../../logger");
const storageService = require('../../services/storageService');
const crypto = require('crypto');

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
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

async function sendCredentialsEmail(tenant, password) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER || "noreply@casaconnect.com",
        to: tenant.email,
        subject: "Your CasaConnect Portal Login Credentials",
        html: `
            <h2>Welcome to CasaConnect Portal</h2>
            <p>Dear ${tenant.firstName},</p>
            <p>Your account has been created. Here are your login credentials:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Portal URL:</strong> ${process.env.PORTAL_URL || "http://localhost:3000"}</p>
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

// Create Tenant Account
exports.createTenant = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            password,
            sendCredentials,
            notes
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
            notes: notes || null,
            isActive: true,
        });

        await tenant.save();

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

        const tenant = await User.findById(tenantId);
        if (!tenant || tenant.role !== "tenant") {
            return res.status(404).render("error", {
                title: "Tenant Not Found",
                message: "Tenant not found",
            });
        }

        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active'
        }).populate('unit');;

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
            additionalCSS: ["tenant-details.css"],
            additionalJS: ["tenant-details.js"],
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

        const tenant = await User.findById(tenantId);
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

        const availableUnits = await Unit.find();

        res.render("manager/tenant-edit", {
            title: `Edit Tenant: ${tenant.firstName} ${tenant.lastName}`,
            layout: "layout",
            additionalCSS: ['common.css', 'tenant-edit.css'],
            additionalJS: ['common.js', 'tenant-edit.js'],
            tenant,
            activeLease,
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

// Get Tenants List
exports.getTenants = async (req, res) => {
    try {
        const tenants = await User.find({ role: "tenant" }).sort("-createdAt");

        // Get active leases for all tenants
        const activeLeases = await Lease.find({
            tenant: { $in: tenants.map(t => t._id) },
            status: 'active'
        }).populate('unit');

        // Create lease map
        const leaseMap = {};
        activeLeases.forEach(lease => {
            leaseMap[lease.tenant.toString()] = lease;
        });

        // Get available units for new leases
        const occupiedUnitIds = activeLeases.map(l => l.unit._id.toString());
        const availableUnits = await Unit.find({
            _id: { $nin: occupiedUnitIds }
        });

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
                        type: "rent",
                        month: currentMonth,
                        year: currentYear,
                        status: "completed",
                    });
                }

                return {
                    ...tenant.toObject(),
                    activeLease,
                    unitId: activeLease?.unit || null,
                    paymentStatus: rentPaid ? "current" : (activeLease ? "due" : "no-lease"),
                };
            })
        );

        res.render("manager/tenants", {
            title: "Tenants Management",
            layout: "layout",
            additionalCSS: ["common.css", "tenants.css"],
            additionalJS: ["common.js", "tenants.js"],
            tenants: tenantsWithFullInfo,
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

        // Terminate any active leases
        const activeLease = await Lease.findOne({
            tenant: tenantId,
            status: 'active'
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

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { tenantId } = req.body;
        const tenant = await User.findById(tenantId);
        
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        tenant.password = await bcrypt.hash(tempPassword, salt);
        tenant.requirePasswordChange = true; // Add this field to User model
        await tenant.save();

        await sendCredentialsEmail(tenant, tempPassword);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        logger.error(`Reset password error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

// Suspend Account
exports.suspendAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const tenant = await User.findById(tenantId);
        
        if (!tenant || tenant.role !== 'tenant') {
            return res.status(404).json({
                success: false,
                message: 'Tenant not found'
            });
        }

        tenant.isActive = false;
        tenant.suspendedAt = new Date();
        tenant.suspendedBy = req.session.userId;
        await tenant.save();

        res.json({
            success: true,
            message: 'Account suspended successfully'
        });
    } catch (error) {
        logger.error(`Suspend account error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to suspend account'
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
            payments: payments.map(p => p.toObject()),
            serviceRequests: serviceRequests.map(sr => sr.toObject()),
            documents: documents.map(d => ({
                title: d.title,
                type: d.type,
                createdAt: d.createdAt
            })),
            exportedAt: new Date(),
            exportedBy: req.session.userId
        };

        res.json({
            success: true,
            data: exportData
        });
    } catch (error) {
        logger.error(`Export tenant data error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to export tenant data'
        });
    }
};