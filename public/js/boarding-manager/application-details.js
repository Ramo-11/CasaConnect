// Application Details JavaScript

CasaConnect.ready(() => {
    ApplicationDetails.init();
});

const ApplicationDetails = {
    applicationId: null,
    isEditMode: false,

    init() {
        const element = document.querySelector('[data-application-id]');
        if (element) {
            this.applicationId = element.getAttribute('data-application-id');
        }

        this.initializeUploadForm();
        this.initializeDocumentTypeSelect();
        this.initializeEditForm();
    },

    initializeEditForm() {
        const form = document.getElementById('applicantInfoForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUpdateApplication(e);
        });
    },

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;

        const viewElements = document.querySelectorAll('.view-mode');
        const editElements = document.querySelectorAll('.edit-mode');
        const editActions = document.querySelector('.edit-actions');
        const editBtn = document.getElementById('editInfoBtn');

        if (this.isEditMode) {
            viewElements.forEach((el) => (el.style.display = 'none'));
            editElements.forEach((el) => (el.style.display = 'block'));
            editActions.style.display = 'flex';
            editActions.style.gap = '0.5rem';
            editBtn.style.display = 'none';
        } else {
            viewElements.forEach((el) => (el.style.display = ''));
            editElements.forEach((el) => (el.style.display = 'none'));
            editActions.style.display = 'none';
            editBtn.style.display = '';
        }
    },

    cancelEdit() {
        this.toggleEditMode();
        // Reset form values to original
        const form = document.getElementById('applicantInfoForm');
        if (form) {
            form.reset();
        }
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
                    customTitleInput.value = '';
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

        // Set loading state
        submitBtn.disabled = true;
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline-block';

        try {
            const formData = new FormData();
            formData.append('applicationId', this.applicationId);
            formData.append('file', file);

            let documentType = document.getElementById('documentType').value;

            // Handle "other" document type
            if (documentType === 'other') {
                const customTitle = document.getElementById('customTitle').value.trim();
                if (!customTitle) {
                    throw new Error('Please enter a document title');
                }
                formData.append('documentType', customTitle);
            } else {
                formData.append('documentType', documentType);
            }

            const comment = document.getElementById('documentComment').value;
            if (comment) {
                formData.append('comment', comment);
            }

            const response = await fetch(
                `/api/boarding/application/${this.applicationId}/document`,
                {
                    method: 'POST',
                    body: formData,
                }
            ).then((res) => res.json());

            if (response.success) {
                CasaConnect.NotificationManager.success('Document uploaded successfully!');
                this.closeUploadModal();
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Failed to upload document');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = '';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    },

    closeUploadModal() {
        CasaConnect.ModalManager.closeModal('uploadDocumentModal');
        const form = document.getElementById('uploadDocumentForm');
        if (form) form.reset();

        const select = document.getElementById('documentType');
        if (select) select.value = '';

        const customTitleGroup = document.getElementById('customTitleGroup');
        if (customTitleGroup) customTitleGroup.style.display = 'none';

        const customTitleInput = document.getElementById('customTitle');
        if (customTitleInput) {
            customTitleInput.value = '';
            customTitleInput.removeAttribute('required');
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
    console.log('Opening upload modal for type:', documentType);
    if (documentType) {
        const select = document.getElementById('documentType');
        if (select) {
            console.log('Setting document type select to:', documentType);
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
