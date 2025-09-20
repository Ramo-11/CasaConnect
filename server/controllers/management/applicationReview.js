const TenantApplication = require('../../../models/TenantApplication');
const User = require('../../../models/User');
const Notification = require('../../../models/Notification');
const emailService = require('../../services/emailService');
const { logger } = require('../../logger');

// Get Applications for Review (Manager)
exports.getApplicationsForReview = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const applications = await TenantApplication.find(filter)
            .populate('submittedBy', 'firstName lastName email')
            .sort('-createdAt');

        res.render('manager/applications-review', {
            title: 'Review Tenant Applications',
            layout: 'layout',
            additionalCSS: ['manager/applications-review.css'],
            additionalJS: ['manager/applications-review.js'],
            user: req.session.user || { role: 'manager' },
            applications,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Get applications for review error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load applications',
        });
    }
};

// View Application for Review (Manager)
exports.viewApplicationForReview = async (req, res) => {
    try {
        const { applicationId } = req.params;

        // Validate applicationId
        if (!applicationId || applicationId === 'undefined') {
            return res.status(400).render('error', {
                title: 'Invalid Request',
                message: 'Application ID is required',
            });
        }

        // Validate ObjectId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(applicationId)) {
            return res.status(400).render('error', {
                title: 'Invalid Application ID',
                message: 'The provided application ID is not valid',
            });
        }

        const application = await TenantApplication.findById(applicationId)
            .populate('submittedBy', 'firstName lastName email')
            .populate('documents.id.documentId')
            .populate('documents.ssn.documentId')
            .populate('documents.criminal.documentId')
            .populate('documents.income.documentId')
            .populate('documents.bank.documentId')
            .populate('additionalDocuments.documentId');

        if (!application) {
            return res.status(404).render('error', {
                title: 'Application Not Found',
                message: 'Application not found',
            });
        }

        res.render('manager/application-review-details', {
            title: `Review Application: ${application.firstName} ${application.lastName}`,
            layout: 'layout',
            additionalCSS: ['manager/application-review-details.css'],
            additionalJS: ['manager/application-review-details.js'],
            user: req.session.user || { role: 'manager' },
            application,
            path: req.path,
        });
    } catch (error) {
        logger.error(`View application for review error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load application',
        });
    }
};

// Approve Application
exports.approveApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { notes, createPassword } = req.body;

        const application = await TenantApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Application is not pending',
            });
        }

        const existingUser = await User.findOne({ email: application.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists',
            });
        }

        // Create tenant account
        const tempPassword = createPassword || generateTempPassword();

        const tenant = new User({
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone,
            password: tempPassword,
            role: 'tenant',
            isActive: true,
            requirePasswordChange: true,
        });

        await tenant.save();

        // Update application
        application.status = 'approved';
        application.reviewedBy = req.session.userId;
        application.reviewedAt = new Date();
        application.reviewNotes = notes;
        application.createdTenant = tenant._id;
        await application.save();

        // Notify boarding manager
        await Notification.create({
            recipient: application.submittedBy,
            type: 'system',
            title: 'Application Approved',
            message: `Application for ${application.firstName} ${application.lastName} has been approved`,
            relatedModel: 'TenantApplication',
            relatedId: application._id,
            priority: 'high',
        });

        if (createPassword) {
            await emailService.sendCredentialsEmail(tenant, tempPassword);
        }

        logger.info(`Application ${applicationId} approved, tenant ${tenant._id} created`);
        res.json({
            success: true,
            message: 'Application approved and tenant account created',
            tenantId: tenant._id,
        });
    } catch (error) {
        logger.error(`Approve application error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to approve application',
        });
    }
};

exports.unapproveApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;

        const application = await TenantApplication.findById(applicationId);
        if (!application || application.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Invalid operation' });
        }

        application.status = 'pending';
        application.reviewedBy = null;
        application.reviewedAt = null;
        application.reviewNotes = '';
        application.createdTenant = null;
        await application.save();

        logger.info(`Application ${applicationId} unapproved`);
        res.json({ success: true, message: 'Application unapproved' });
    } catch (err) {
        logger.error(`Unapprove error: ${err}`);
        res.status(500).json({ success: false, message: 'Failed to unapprove' });
    }
};

// Decline Application
exports.declineApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { reason } = req.body;

        const application = await TenantApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Application is not pending',
            });
        }

        application.status = 'declined';
        application.reviewedBy = req.session.userId;
        application.reviewedAt = new Date();
        application.reviewNotes = reason;
        await application.save();

        // Notify boarding manager
        await Notification.create({
            recipient: application.submittedBy,
            type: 'system',
            title: 'Application Declined',
            message: `Application for ${application.firstName} ${application.lastName} has been declined. Reason: ${reason}`,
            relatedModel: 'TenantApplication',
            relatedId: application._id,
            priority: 'high',
        });

        logger.info(`Application ${applicationId} declined`);
        res.json({
            success: true,
            message: 'Application declined',
        });
    } catch (error) {
        logger.error(`Decline application error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to decline application',
        });
    }
};

function generateTempPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}
