const TenantApplication = require('../../../models/TenantApplication');
const User = require('../../../models/User');
const Document = require('../../../models/Document');
const storageService = require('../../services/storageService');
const { logger } = require('../../logger');

// Get Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const applications = await TenantApplication.find({ submittedBy: req.session.userId })
            .sort('-createdAt')
            .limit(10);

        const stats = {
            total: await TenantApplication.countDocuments({ submittedBy: req.session.userId }),
            pending: await TenantApplication.countDocuments({
                submittedBy: req.session.userId,
                status: 'pending',
            }),
            approved: await TenantApplication.countDocuments({
                submittedBy: req.session.userId,
                status: 'approved',
            }),
            declined: await TenantApplication.countDocuments({
                submittedBy: req.session.userId,
                status: 'declined',
            }),
        };

        res.render('boarding-manager/dashboard', {
            title: 'Boarding Manager Dashboard',
            layout: 'layout',
            additionalCSS: ['boarding-manager/dashboard.css'],
            additionalJS: ['boarding-manager/dashboard.js'],
            user: req.session.user || { role: 'boarding_manager' },
            applications,
            stats,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Boarding manager dashboard error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load dashboard',
        });
    }
};

// Get Applications List
exports.getApplications = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { submittedBy: req.session.userId };
        if (status) filter.status = status;

        const applications = await TenantApplication.find(filter)
            .populate(
                'documents.id.documentId documents.ssn.documentId documents.criminal.documentId documents.income.documentId documents.bank.documentId'
            )
            .sort('-createdAt');

        res.render('boarding-manager/applications', {
            title: 'Tenant Applications',
            layout: 'layout',
            additionalCSS: ['boarding-manager/applications.css'],
            additionalJS: ['boarding-manager/applications.js'],
            user: req.session.user || { role: 'boarding_manager' },
            applications,
            path: req.path,
        });
    } catch (error) {
        logger.error(`Get applications error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load applications',
        });
    }
};

// Create New Application
exports.createApplication = async (req, res) => {
    try {
        const { firstName, lastName, email, phone } = req.body;

        // Check if application already exists for this email
        const existing = await TenantApplication.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'An application already exists for this email',
            });
        }

        const application = new TenantApplication({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            submittedBy: req.session.userId,
            status: 'pending',
        });

        await application.save();

        logger.info(`Tenant application created: ${application._id}`);
        res.json({
            success: true,
            message: 'Application created successfully',
            applicationId: application._id,
        });
    } catch (error) {
        logger.error(`Create application error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to create application',
        });
    }
};

// Upload Application Document
exports.uploadDocument = async (req, res) => {
    try {
        const { applicationId, documentType, comment } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file provided',
            });
        }

        const application = await TenantApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }

        // Verify ownership
        if (application.submittedBy.toString() !== req.session.userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Upload file to storage
        const folder = `tenant-applications/${applicationId}`;
        const uploadResult = await storageService.uploadFile(file, folder);

        // Create document record
        const document = new Document({
            title: `${documentType.toUpperCase()} - ${application.firstName} ${
                application.lastName
            }`,
            type: 'other',
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            uploadedBy: req.session.userId,
            relatedTo: {
                model: 'TenantApplication',
                id: applicationId,
            },
        });

        await document.save();

        // Update application with document reference
        if (['id', 'ssn', 'criminal', 'income', 'bank'].includes(documentType)) {
            application.documents[documentType] = {
                documentId: document._id,
                comment: comment || null,
                uploadedAt: new Date(),
            };
        } else {
            // Additional document
            application.additionalDocuments.push({
                documentId: document._id,
                title: documentType,
                comment: comment || null,
                uploadedAt: new Date(),
            });
        }

        await application.save();

        logger.info(`Document uploaded for application ${applicationId}: ${documentType}`);
        res.json({
            success: true,
            message: 'Document uploaded successfully',
            document: {
                id: document._id,
                type: documentType,
            },
        });
    } catch (error) {
        logger.error(`Upload document error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
        });
    }
};

// View Application Details
exports.viewApplication = async (req, res) => {
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
            .populate('documents.id.documentId')
            .populate('documents.ssn.documentId')
            .populate('documents.criminal.documentId')
            .populate('documents.income.documentId')
            .populate('documents.bank.documentId')
            .populate('additionalDocuments.documentId')
            .populate('reviewedBy', 'firstName lastName');

        if (!application) {
            return res.status(404).render('error', {
                title: 'Application Not Found',
                message: 'Application not found',
            });
        }

        // Verify ownership or manager role
        if (
            application.submittedBy.toString() !== req.session.userId &&
            req.session.user.role !== 'manager'
        ) {
            return res.status(403).render('error', {
                title: 'Unauthorized',
                message: 'You do not have permission to view this application',
            });
        }

        res.render('boarding-manager/application-details', {
            title: `Application: ${application.firstName} ${application.lastName}`,
            layout: 'layout',
            additionalCSS: ['boarding-manager/application-details.css'],
            additionalJS: ['boarding-manager/application-details.js'],
            user: req.session.user || { role: 'boarding_manager' },
            application,
            path: req.path,
        });
    } catch (error) {
        logger.error(`View application error: ${error}`);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load application',
        });
    }
};

// Delete Document from Application
exports.deleteDocument = async (req, res) => {
    try {
        const { applicationId, documentType } = req.params;

        const application = await TenantApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }

        // Verify ownership
        if (application.submittedBy.toString() !== req.session.userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        let documentId;
        if (['id', 'ssn', 'criminal', 'income', 'bank'].includes(documentType)) {
            documentId = application.documents[documentType]?.documentId;
            if (documentId) {
                application.documents[documentType] = {
                    documentId: null,
                    comment: null,
                    uploadedAt: null,
                };
            }
        }

        if (documentId) {
            // Delete document from storage and database
            const document = await Document.findById(documentId);
            if (document) {
                await storageService.deleteFile(document.fileName);
                await Document.findByIdAndDelete(documentId);
            }
            await application.save();
        }

        res.json({
            success: true,
            message: 'Document deleted successfully',
        });
    } catch (error) {
        logger.error(`Delete document error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
        });
    }
};
