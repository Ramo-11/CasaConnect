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
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            relatedTo: {
                model: relatedModel || null,
                id: relatedId || null
            },
            uploadedBy: req.session.userId
        });

        // // Save document record
        // const document = new Document({
        //     title: title || file.originalname,
        //     type: type || 'other',
        //     fileName: uploadResult.fileName,
        //     url: uploadResult.url,
        //     size: uploadResult.size,
        //     mimeType: uploadResult.mimeType,
        //     relatedTo: {
        //         model: relatedModel || null,
        //         id: relatedId || null
        //     },
        //     uploadedBy: req.session.userId
        // });

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

exports.deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;

        const document = await Document.findById(documentId);
        if (!document) {
            logger.warn(`Delete failed: Document ${documentId} not found`);
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        // Delete file from storage
        try {
            await storageService.deleteFile(document.fileName);
        } catch (storageError) {
            logger.error(`Storage deletion error for file ${document.fileName}: ${storageError}`);
            // Optionally still proceed with DB deletion if storage isn't critical
        }

        // Delete document record
        await document.deleteOne();

        logger.info(`Document ${documentId} deleted successfully`);
        res.json({
            success: true,
            message: 'Document deleted successfully',
            data: document
        });
    } catch (error) {
        logger.error(`Delete document error: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document'
        });
    }
};

exports.viewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findById(documentId);
    if (!document) {
      logger.error(`View document error: Document with id ${documentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const signedUrl = await storageService.getSignedUrl(document.fileName);
    res.redirect(signedUrl);
  } catch (error) {
    logger.error(`View document error: ${error}`);
    res.status(500).json({
      success: false,
      message: 'Failed to view document'
    });
  }
};

// Download Document (redirect with download header)
exports.downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Force download; keep original filename (or pass a custom name string)
    const signedUrl = await storageService.getSignedUrl(document.fileName, 60, {
      download: document.originalName || true
    });

    return res.redirect(signedUrl);
  } catch (error) {
    logger.error(`Download document error: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
};