const Document = require('../../../models/Document');
const storageService = require('../../services/storageService');
const { logger } = require('../../logger');

// Upload Document
exports.uploadDocument = async (req, res) => {
    try {
        const { title, type, relatedModel, relatedId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        // Upload to storage
        const uploadResult = await storageService.uploadFile(file, `documents/${type}`);

        // Save document record
        const document = new Document({
            title: title || file.originalname,
            type: type || 'other',
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            relatedTo: {
                model: relatedModel || null,
                id: relatedId || null
            },
            uploadedBy: req.session.userId
        });

        await document.save();

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            data: document
        });
    } catch (error) {
        logger.error(`Upload document error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document'
        });
    }
};

// Get Documents
exports.getDocuments = async (req, res) => {
    try {
        const { relatedModel, relatedId } = req.query;
        
        const filter = {};
        if (relatedModel) filter['relatedTo.model'] = relatedModel;
        if (relatedId) filter['relatedTo.id'] = relatedId;

        const documents = await Document.find(filter)
            .populate('uploadedBy', 'firstName lastName')
            .sort('-createdAt');

        res.json({
            success: true,
            data: documents
        });
    } catch (error) {
        logger.error(`Get documents error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to get documents'
        });
    }
};

// Delete Document
exports.deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        // Delete from storage
        await storageService.deleteFile(document.fileName);

        // Delete record
        await Document.findByIdAndDelete(documentId);

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    } catch (error) {
        logger.error(`Delete document error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document'
        });
    }
};