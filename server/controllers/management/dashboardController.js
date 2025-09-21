const User = require('../../../models/User');
const Lease = require('../../../models/Lease');
const Unit = require('../../../models/Unit');
const ServiceRequest = require('../../../models/ServiceRequest');
const Payment = require('../../../models/Payment');
const TenantApplication = require('../../../models/TenantApplication');
const Notification = require('../../../models/Notification');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { logger } = require('../../logger');

// Get Manager Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const managerId = req.session.userId;
        // Should be updated during production
        const manager = (await User.findById(managerId)) || {
            firstName: 'Dev',
            lastName: 'Manager',
            email: 'dev@example.com',
            role: 'manager',
        };
        if (!manager) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Manager account not found',
            });
        }

        // Get all units
        const units = await Unit.find();
        const totalUnits = units.length;

        // Get active leases to determine occupied units
        const activeLeases = await Lease.find({ status: 'active' }).populate('unit');
        const occupiedUnitIds = activeLeases.map((lease) => lease.unit._id.toString());

        const occupiedUnits = occupiedUnitIds.length;
        const availableUnits = totalUnits - occupiedUnits;

        const allUnitsList = units.map((u) => ({
            id: u._id,
            unitNumber: u.unitNumber,
            propertyType: u.propertyType,
            streetAddress: u.streetAddress,
            building: u.building,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            squareFeet: u.squareFeet,
            monthlyRent: u.monthlyRent,
            occupied: occupiedUnitIds.includes(u._id.toString()),
            user: req.session.user || { role: 'manager' },
        }));

        // Get active service requests count
        const activeRequests = await ServiceRequest.countDocuments({
            status: { $in: ['pending', 'assigned', 'in_progress'] },
        });

        // Get tenants with their active leases
        const tenants = await User.find({ role: 'tenant' }).sort('-createdAt').lean();

        // Get all active leases in one query for efficiency
        const tenantIds = tenants.map((t) => t._id);
        const tenantLeases = await Lease.find({
            tenant: { $in: tenantIds },
            status: 'active',
        }).populate('unit');

        // Create a map for quick lease lookup
        const leaseMap = {};
        tenantLeases.forEach((lease) => {
            leaseMap[lease.tenant.toString()] = lease;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pendingApplications = await TenantApplication.countDocuments({
            status: 'pending',
        });

        const approvedApplications = await TenantApplication.countDocuments({
            status: 'approved',
        });

        const rejectedApplications = await TenantApplication.countDocuments({
            status: 'rejected',
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
                        type: 'rent',
                        month: currentMonth,
                        year: currentYear,
                        status: 'completed',
                    });
                }

                return {
                    id: tenant._id,
                    fullName: `${tenant.firstName} ${tenant.lastName}`,
                    email: tenant.email,
                    phone: tenant.phone,
                    unitNumber: activeLease?.unit?.unitNumber || 'Unassigned',
                    leaseEnd: activeLease ? formatDate(activeLease.endDate) : 'N/A',
                    paymentStatus: rentPaid ? 'current' : activeLease ? 'due' : 'no-lease',
                    hasActiveLease: !!activeLease,
                    leaseId: activeLease?._id || null,
                };
            })
        );

        // Get recent service requests
        const recentRequests = await ServiceRequest.find()
            .populate('unit', 'unitNumber')
            .populate('tenant', 'firstName lastName')
            .sort('-createdAt')
            .limit(5)
            .lean();

        const formattedRequests = recentRequests.map((req) => ({
            id: req._id,
            title: req.title,
            unitNumber: req.unit ? req.unit.unitNumber : 'N/A',
            category: req.category.replace('_', ' '),
            priority: req.priority,
            status: req.status.replace('_', ' '),
            date: formatDate(req.createdAt),
        }));

        // Get upcoming lease expirations (next 60 days)
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

        const expiringLeases = await Lease.find({
            status: 'active',
            endDate: {
                $gte: new Date(),
                $lte: sixtyDaysFromNow,
            },
        })
            .populate('tenant', 'firstName lastName')
            .populate('unit', 'unitNumber')
            .sort('endDate')
            .limit(5);

        const formattedExpiringLeases = expiringLeases.map((lease) => ({
            id: lease._id,
            tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
            unitNumber: lease.unit.unitNumber,
            endDate: formatDate(lease.endDate),
            daysRemaining: lease.daysRemaining,
        }));

        res.render('manager/dashboard', {
            title: 'Manager Dashboard',
            layout: 'layout',
            additionalCSS: ['manager/dashboard.css'],
            additionalJS: ['manager/dashboard.js'],
            user: manager,
            totalUnits,
            occupiedUnits,
            availableUnits,
            activeRequests,
            tenants: formattedTenants,
            allUnitsList,
            pendingApplications,
            approvedApplications,
            rejectedApplications,
            recentRequests: formattedRequests,
            expiringLeases: formattedExpiringLeases,
            portalUrl: process.env.PORTAL_URL || 'http://localhost:3000',
            path: req.path,
        });
    } catch (error) {
        logger.error(`Dashboard error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load dashboard',
        });
    }
};

// Get Dashboard Stats (API)
exports.getDashboardStats = async (req, res) => {
    try {
        const units = await Unit.find();
        const totalUnits = units.length;
        const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
        const availableUnits = units.filter((u) => u.status === 'available').length;

        const activeRequests = await ServiceRequest.countDocuments({
            status: { $in: ['pending', 'assigned', 'in_progress'] },
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
            message: 'Failed to get dashboard stats',
        });
    }
};

// Get Payment Records Grid
exports.getPaymentRecords = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Get all units with active leases
        const activeLeases = await Lease.find({
            status: 'active',
            startDate: { $lte: new Date(year, 11, 31) },
            endDate: { $gte: new Date(year, 0, 1) },
        })
            .populate('unit')
            .populate('tenant')
            .sort('unit.unitNumber');

        // Get all payments for the year
        const payments = await Payment.find({
            year: year,
            type: 'rent',
            status: 'completed',
        });

        // Create payment map for quick lookup
        const paymentMap = {};
        payments.forEach((payment) => {
            const key = `${payment.tenant}_${payment.month}_${year}`;
            if (!paymentMap[key]) {
                paymentMap[key] = [];
            }
            paymentMap[key].push(payment);
        });

        // Build records grid
        const records = activeLeases.map((lease) => {
            const monthlyData = {};

            for (let month = 1; month <= 12; month++) {
                const monthPayments = paymentMap[`${lease.tenant._id}_${month}_${year}`] || [];
                const totalPaid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
                const rentAmount = lease.monthlyRent;

                // Determine status
                let status = 'not-due'; // Future months
                let remaining = 0;

                const monthDate = new Date(year, month - 1, 1);
                const leaseStart = new Date(lease.startDate);
                const leaseEnd = new Date(lease.endDate);
                const currentDate = new Date();

                if (monthDate < leaseStart || monthDate > leaseEnd) {
                    status = 'inactive';
                } else if (monthDate <= currentDate) {
                    if (totalPaid >= rentAmount) {
                        status = 'paid';
                    } else if (totalPaid > 0) {
                        status = 'partial';
                        remaining = rentAmount - totalPaid;
                    } else {
                        status = 'due';
                    }
                }

                monthlyData[month] = {
                    status,
                    paid: totalPaid,
                    remaining,
                };
            }

            return {
                unitNumber: lease.unit.unitNumber,
                tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
                phone: lease.tenant.phone || '',
                email: lease.tenant.email,
                rentAmount: lease.monthlyRent,
                months: monthlyData,
            };
        });

        res.json({
            success: true,
            data: {
                year,
                records,
            },
        });
    } catch (error) {
        logger.error(`Payment records error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment records',
        });
    }
};

// Export Payment Records as CSV
// Export Payment Records as CSV
exports.exportPaymentRecords = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Get all units with active leases
        const activeLeases = await Lease.find({
            status: 'active',
            startDate: { $lte: new Date(year, 11, 31) },
            endDate: { $gte: new Date(year, 0, 1) },
        })
            .populate('unit')
            .populate('tenant')
            .sort('unit.unitNumber');

        // Get all payments for the year
        const payments = await Payment.find({
            year: year,
            type: 'rent',
            status: 'completed',
        });

        // Create payment map for quick lookup
        const paymentMap = {};
        payments.forEach((payment) => {
            const key = `${payment.tenant}_${payment.month}_${year}`;
            if (!paymentMap[key]) {
                paymentMap[key] = [];
            }
            paymentMap[key].push(payment);
        });

        // Build records grid
        const records = activeLeases.map((lease) => {
            const monthlyData = {};

            for (let month = 1; month <= 12; month++) {
                const monthPayments = paymentMap[`${lease.tenant._id}_${month}_${year}`] || [];
                const totalPaid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
                const rentAmount = lease.monthlyRent;

                // Determine status
                let status = 'not-due'; // Future months
                let remaining = 0;

                const monthDate = new Date(year, month - 1, 1);
                const leaseStart = new Date(lease.startDate);
                const leaseEnd = new Date(lease.endDate);
                const currentDate = new Date();

                if (monthDate < leaseStart || monthDate > leaseEnd) {
                    status = 'inactive';
                } else if (monthDate <= currentDate) {
                    if (totalPaid >= rentAmount) {
                        status = 'paid';
                    } else if (totalPaid > 0) {
                        status = 'partial';
                        remaining = rentAmount - totalPaid;
                    } else {
                        status = 'due';
                    }
                }

                monthlyData[month] = {
                    status,
                    paid: totalPaid,
                    remaining,
                };
            }

            return {
                unitNumber: lease.unit.unitNumber,
                tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
                phone: lease.tenant.phone || '',
                email: lease.tenant.email,
                rentAmount: lease.monthlyRent,
                months: monthlyData,
            };
        });

        // Build CSV
        const monthNames = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];

        let csv = 'Unit,Tenant,Phone,Email,Rent Amount,' + monthNames.join(',') + '\n';

        records.forEach((record) => {
            const row = [
                record.unitNumber,
                record.tenantName,
                record.phone,
                record.email,
                record.rentAmount,
            ];

            for (let month = 1; month <= 12; month++) {
                const monthData = record.months[month];
                let cellValue = '';

                if (monthData.status === 'paid') {
                    cellValue = 'PAID';
                } else if (monthData.status === 'partial') {
                    cellValue = `PARTIAL ($${monthData.remaining} due)`;
                } else if (monthData.status === 'due') {
                    cellValue = 'DUE';
                } else if (monthData.status === 'inactive') {
                    cellValue = 'N/A';
                } else {
                    cellValue = '-';
                }

                row.push(cellValue);
            }

            csv += row.map((val) => `"${val}"`).join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payment-records-${year}.csv"`);
        res.send(csv);
    } catch (error) {
        logger.error(`Export payment records error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to export payment records',
        });
    }
};

// Helper Functions
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
