// Document Manager - Shared utilities for document operations
const DocumentManager = {
    // Load and render documents
    async loadDocuments(containerId, relatedModel, relatedId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner">Loading documents...</div>';

        try {
            const response = await CasaConnect.APIClient.get(
                `/api/manager/documents?relatedModel=${relatedModel}&relatedId=${relatedId}`
            );

            if (response.success) {
                this.renderDocuments(containerId, response.data.data || response.data);
            } else {
                container.innerHTML = '<p class="no-data">Failed to load documents</p>';
            }
        } catch (error) {
            console.error("Failed to load documents:", error);
            container.innerHTML = '<p class="no-data">Failed to load documents</p>';
        }
    },

    // Render documents list
    renderDocuments(containerId, documents) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!documents || documents.length === 0) {
            container.innerHTML = '<p class="no-data">No documents uploaded</p>';
            return;
        }

        const html = documents
            .map(doc => `
                <div class="document-item">
                    <div class="document-icon">
                        <i class="fas ${this.getDocumentIcon(doc.type)}"></i>
                    </div>
                    <div class="document-info">
                        <h5>${doc.title}</h5>
                        <span class="document-meta">
                            ${doc.type} • ${this.formatFileSize(doc.size)} • ${new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <div class="document-actions">
                        <button class="btn-icon" onclick="DocumentManager.viewDocument('${doc._id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="DocumentManager.downloadDocument('${doc._id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-icon text-danger" onclick="deleteDocument('${doc._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `)
            .join("");

        container.innerHTML = html;
    },

    // View document
    viewDocument(documentId) {
        window.open(`/api/manager/documents/${documentId}/view`, "_blank");
    },

    // Download document
    downloadDocument(documentId) {
        window.open(`/api/manager/documents/${documentId}/download`, "_blank");
    },

    // Delete document with callback for reload
    async deleteDocument(documentId, reloadCallback) {
        if (!confirm("Are you sure you want to delete this document?")) return;

        try {
            const response = await CasaConnect.APIClient.delete(
                `/api/manager/documents/${documentId}`
            );

            if (response.success) {
                CasaConnect.NotificationManager.success("Document deleted successfully");
                k
                setTimeout(() => {
                    if (reloadCallback && typeof reloadCallback === 'function') {
                        reloadCallback();
                    }
                }, 1500);
            } else {
                throw new Error(response.message || 'Failed to delete document');
            }
        } catch (error) {
            console.error('Delete error:', error); // Add debugging
            CasaConnect.NotificationManager.error(error.message);
        }
    },

    // Get document icon based on type
    getDocumentIcon(type) {
        const icons = {
            lease: "fa-file-contract",
            contract: "fa-file-signature",
            notice: "fa-file-alt",
            invoice: "fa-file-invoice",
            other: "fa-file",
        };
        return icons[type] || "fa-file";
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    },

    // Upload document modal handler
    attachDocument(relatedId, relatedModel = 'User') {
        const relatedIdInput = document.getElementById('documentRelatedId');
        const relatedModelInput = document.getElementById('documentRelatedModel');
        
        if (relatedIdInput) relatedIdInput.value = relatedId;
        if (relatedModelInput) relatedModelInput.value = relatedModel;
        
        CasaConnect.ModalManager.openModal('uploadDocumentModal');
    },

    // Close upload modal
    closeUploadDocumentModal() {
        CasaConnect.ModalManager.closeModal('uploadDocumentModal');
        const form = document.getElementById('uploadDocumentForm');
        if (form) form.reset();
    },

    // Initialize upload form handler
    initializeUploadForm(reloadCallback) {
        const uploadForm = document.getElementById('uploadDocumentForm');
        if (!uploadForm || uploadForm.dataset.initialized) return;

        uploadForm.dataset.initialized = 'true';
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(uploadForm);
            const btn = uploadForm.querySelector('button[type="submit"]');
            const btnText = btn.querySelector('.btn-text');
            const btnLoading = btn.querySelector('.btn-loading');
            
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
            btn.disabled = true;
            
            try {
                const response = await CasaConnect.APIClient.post('/api/manager/documents', formData);
                
                if (response.success) {
                    CasaConnect.NotificationManager.success('Document uploaded successfully');
                    this.closeUploadDocumentModal();
                    
                    // Call reload callback if provided
                    if (reloadCallback && typeof reloadCallback === 'function') {
                        reloadCallback();
                    }
                } else {
                    throw new Error(response.error || 'Failed to upload document');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                btnText.style.display = 'inline-block';
                btnLoading.style.display = 'none';
                btn.disabled = false;
            }
        });
    }
};

// Make globally available
window.DocumentManager = DocumentManager;