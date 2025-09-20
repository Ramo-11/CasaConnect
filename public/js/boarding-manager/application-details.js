// Application Details JavaScript

CasaConnect.ready(() => {
    ApplicationDetails.init();
});

const ApplicationDetails = {
    applicationId: null,

    init() {
        const element = document.querySelector('[data-application-id]');
        if (element) {
            this.applicationId = element.getAttribute('data-application-id');
        }

        this.initializeUploadForm();
        this.initializeDocumentTypeSelect();
    },

    initializeUploadForm() {
        const form = document.getElementById('uploadDocumentForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUploadDocument(e);
        });
    },

    initializeDocumentTypeSelect() {
        const select = document.getElementById('documentType');
        const customTitleGroup = document.getElementById('customTitleGroup');
        const customTitleInput = document.getElementById('customTitle');

        if (select) {
            select.addEventListener('change', (e) => {
                if (e.target.value === 'other') {
                    customTitleGroup.style.display = 'block';
                    customTitleInput.setAttribute('required', 'required');
                } else {
                    customTitleGroup.style.display = 'none';
                    customTitleInput.removeAttribute('required');
                }
            });
        }
    },

    async handleUploadDocument(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const fileInput = document.getElementById('documentFile');

        if (!fileInput.files || !fileInput.files[0]) {
            CasaConnect.NotificationManager.error('Please select a file to upload');
            return;
        }

        const file = fileInput.files[0];
        if (file.size > 10 * 1024 * 1024) {
            CasaConnect.NotificationManager.error('File size must be under 10MB');
            return;
        }

        if (window.FormManager) {
            FormManager.setSubmitButtonLoading(submitBtn, true, 'Uploading...');
        }

        try {
            const formData = new FormData();
            formData.append('applicationId', this.applicationId);
            formData.append('file', file);

            let documentType = document.getElementById('documentType').value;
            if (documentType === 'other') {
                documentType = document.getElementById('customTitle').value;
            }
            formData.append('documentType', documentType);

            const comment = document.getElementById('documentComment').value;
            if (comment) {
                formData.append('comment', comment);
            }

            const response = await CasaConnect.APIClient.post(
                `/api/boarding/application/${this.applicationId}/document`,
                formData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success('Document uploaded successfully!');
                this.closeUploadModal();
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Failed to upload document');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, false);
            }
        }
    },

    closeUploadModal() {
        CasaConnect.ModalManager.closeModal('uploadDocumentModal');
        const form = document.getElementById('uploadDocumentForm');
        if (form) form.reset();

        // Reset custom title visibility
        const customTitleGroup = document.getElementById('customTitleGroup');
        if (customTitleGroup) {
            customTitleGroup.style.display = 'none';
        }
    },

    async deleteDocument(documentType) {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await CasaConnect.APIClient.delete(
                `/api/boarding/application/${this.applicationId}/document/${documentType}`
            );

            if (response.success) {
                CasaConnect.NotificationManager.success('Document deleted successfully');
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Failed to delete document');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        }
    },
};

// Global functions
window.openUploadModal = (documentType) => {
    if (documentType) {
        const select = document.getElementById('documentType');
        if (select) {
            select.value = documentType;
            // Trigger change event
            select.dispatchEvent(new Event('change'));
        }
    }
    CasaConnect.ModalManager.openModal('uploadDocumentModal');
};

window.closeUploadModal = () => {
    ApplicationDetails.closeUploadModal();
};

window.viewDocument = (documentId) => {
    window.open(`/api/documents/${documentId}/view`, '_blank');
};

window.downloadDocument = (documentId) => {
    window.open(`/api/documents/${documentId}/download`, '_blank');
};

window.deleteAppDocument = (applicationId, documentType) => {
    ApplicationDetails.deleteDocument(documentType);
};
