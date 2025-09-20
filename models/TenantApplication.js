const mongoose = require('mongoose');

const tenantApplicationSchema = new mongoose.Schema({
    // Applicant Information
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },

    // Application Status
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined', 'withdrawn'],
        default: 'pending',
    },

    // Documents with comments
    documents: {
        id: {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
            comment: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
        },
        ssn: {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
            comment: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
        },
        criminal: {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
            comment: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
        },
        income: {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
            comment: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
        },
        bank: {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
            comment: { type: String, default: null },
            uploadedAt: { type: Date, default: null },
        },
    },

    // Additional documents
    additionalDocuments: [
        {
            documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
            title: String,
            comment: String,
            uploadedAt: { type: Date, default: Date.now },
        },
    ],

    // Management
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    reviewNotes: {
        type: String,
        default: null,
    },

    // If approved, link to created tenant
    createdTenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes
tenantApplicationSchema.index({ status: 1, createdAt: -1 });
tenantApplicationSchema.index({ submittedBy: 1 });
tenantApplicationSchema.index({ email: 1 });

// Update timestamp on save
tenantApplicationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Check if all required documents are uploaded
tenantApplicationSchema.methods.hasAllRequiredDocuments = function () {
    return !!(
        this.documents.id.documentId &&
        this.documents.ssn.documentId &&
        this.documents.criminal.documentId &&
        this.documents.income.documentId &&
        this.documents.bank.documentId
    );
};

module.exports = mongoose.model('TenantApplication', tenantApplicationSchema);
