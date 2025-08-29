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

        const allUnitsList = units.map(u => ({
            id: u._id,
            unitNumber: u.unitNumber,
            building: u.building,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            squareFeet: u.squareFeet,
            monthlyRent: u.monthlyRent,
            occupied: occupiedUnitIds.includes(u._id.toString())
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
            additionalCSS: ["manager.css"],
            additionalJS: ["pages/manager-dashboard.js"],
            user: manager,
            totalUnits,
            occupiedUnits,
            availableUnits,
            activeRequests,
            tenants: formattedTenants,
            allUnitsList,
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