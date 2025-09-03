const Document = require('../../../models/Document');
const Lease = require('../../../models/Lease');
const storageService = require('../../services/storageService');
const { logger } = require('../../logger');

// Upload Document
exports.uploadDocument = async (req, res) => {
  try {
    const { title, type, relatedModel, relatedId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const uploadResult = await storageService.uploadFile(file, `documents/${type || 'other'}`);

    // Base document
    const document = new Document({
      title: title || file.originalname,
      type: type || 'other',
      fileName: uploadResult.fileName,
      url: uploadResult.url,
      size: uploadResult.size,
      mimeType: uploadResult.mimeType,
      uploadedBy: req.session.userId,
      relatedTo: {
        model: relatedModel || null,
        id: relatedId || null,
      },
      sharedWith: [] // Initialize as empty, will be populated based on context
    });

    // Handle different related models and set sharedWith appropriately
    if (relatedModel === 'User' && relatedId) {
      // Document directly related to a user (tenant)
      document.sharedWith = [relatedId];
      logger.info(`Document shared with user ${relatedId}`);
    } 
    else if (relatedModel === 'Lease' && relatedId) {
      // Document related to a lease - share with tenant(s)
      const lease = await Lease.findById(relatedId).select('tenant additionalTenants');
      if (lease) {
        const sharedUsers = [lease.tenant];
        if (lease.additionalTenants && lease.additionalTenants.length > 0) {
          sharedUsers.push(...lease.additionalTenants);
        }
        document.sharedWith = sharedUsers;
        logger.info(`Document shared with lease tenants: ${sharedUsers.join(', ')}`);
      }
    }
    else if (relatedModel === 'Unit' && relatedId) {
      // Document related to a unit - share with current tenant(s) if any
      const activeLease = await Lease.findOne({
        unit: relatedId,
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      }).select('tenant additionalTenants');
      
      if (activeLease) {
        const sharedUsers = [activeLease.tenant];
        if (activeLease.additionalTenants && activeLease.additionalTenants.length > 0) {
          sharedUsers.push(...activeLease.additionalTenants);
        }
        document.sharedWith = sharedUsers;
        logger.info(`Document shared with unit's current tenants: ${sharedUsers.join(', ')}`);
      }
    }

    await document.save();

    // Special handling for lease type documents
    if (type === 'lease' && relatedModel === 'Lease' && relatedId) {
      const lease = await Lease.findById(relatedId).select('tenant document');
      if (!lease) {
        return res.status(404).json({ success: false, message: 'Lease not found' });
      }

      // Update the lease to reference this document
      lease.document = document._id;
      await lease.save();
      
      logger.info(`Linked lease ${lease._id} to document ${document._id}`);
    }

    logger.info(`Document (${document.type}) uploaded successfully`);
    res.json({ success: true, message: 'Document uploaded successfully', data: document });
  } catch (error) {
    logger.error(`Upload document error: ${error}`);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
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
            // Still proceed with DB deletion
        }

        // If document is lease, null out in Lease model
        if (document.type === "lease" && document.relatedTo?.model === "Lease" && document.relatedTo?.id) {
            await Lease.findByIdAndUpdate(document.relatedTo.id, { $set: { document: null } });
        }

        // Delete document record
        await document.deleteOne();

        logger.info(`Document with id ${documentId} deleted successfully from db`);
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
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    
    const document = await Document.findById(documentId).populate('sharedWith');
    
    if (!document) {
      logger.error(`View document error: Document with id ${documentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Access control
    const hasAccess = 
      userRole === 'manager' || 
      userRole === 'supervisor' ||
      document.uploadedBy.toString() === userId ||
      document.sharedWith.some(u => u._id.toString() === userId);
    
    if (!hasAccess) {
      logger.warn(`Unauthorized document access attempt by user ${userId} for document ${documentId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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
    const userId = req.session?.userId;
    const userRole = req.session?.userRole;
    
    const document = await Document.findById(documentId).populate('sharedWith');
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found' 
      });
    }
    
    // Access control
    const hasAccess = 
      userRole === 'manager' || 
      userRole === 'supervisor' ||
      document.uploadedBy.toString() === userId ||
      document.sharedWith.some(u => u._id.toString() === userId);
    
    if (!hasAccess) {
      logger.warn(`Unauthorized document download attempt by user ${userId} for document ${documentId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const signedUrl = await storageService.getSignedUrl(document.fileName, 60, {
      download: document.originalName || true
    });

    return res.redirect(signedUrl);
  } catch (error) {
    logger.error(`Download document error: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download document' 
    });
  }
};