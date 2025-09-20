// Boarding Manager Dashboard JavaScript

CasaConnect.ready(() => {
    BoardingDashboard.init();
});

const BoardingDashboard = {
    init() {
        this.initializeNewApplicationForm();
    },

    initializeNewApplicationForm() {
        const form = document.getElementById('newApplicationForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateApplication(e);
        });
    },

    async handleCreateApplication(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (window.FormManager && !FormManager.validateForm(form)) {
            return;
        }

        if (window.FormManager) {
            FormManager.setSubmitButtonLoading(submitBtn, true, 'Creating...');
        }

        try {
            const formData = CasaConnect.FormUtils.serializeForm(form);
            const response = await CasaConnect.APIClient.post(
                '/api/boarding/application',
                formData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success('Application created successfully!');
                this.closeNewApplicationModal();

                // Fix: Access applicationId from response.data
                const applicationId = response.data?.applicationId || response.applicationId;
                if (applicationId) {
                    setTimeout(() => {
                        window.location.href = `/boarding/application/${applicationId}`;
                    }, 1500);
                } else {
                    // If no ID, just reload the page
                    setTimeout(() => {
                        location.reload();
                    }, 1500);
                }
            } else {
                throw new Error(response.error || 'Failed to create application');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, false);
            }
        }
    },

    closeNewApplicationModal() {
        CasaConnect.ModalManager.closeModal('newApplicationModal');
        const form = document.getElementById('newApplicationForm');
        if (form) form.reset();
    },
};

// Global functions
window.openNewApplicationModal = () => {
    CasaConnect.ModalManager.openModal('newApplicationModal');
};

window.closeNewApplicationModal = () => {
    BoardingDashboard.closeNewApplicationModal();
};

window.viewApplication = (applicationId) => {
    window.location.href = `/boarding/application/${applicationId}`;
};

window.editApplication = (applicationId) => {
    window.location.href = `/boarding/application/${applicationId}`;
};
