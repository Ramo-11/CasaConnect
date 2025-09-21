// Manager Application Review JavaScript

CasaConnect.ready(() => {
    ApplicationReview.init();
});

const ApplicationReview = {
    applicationId: null,

    init() {
        const element = document.querySelector('[data-application-id]');
        if (element) {
            this.applicationId = element.getAttribute('data-application-id');
        }

        this.initializeForms();
    },

    initializeForms() {
        // Approve Form
        const approveForm = document.getElementById('approveForm');
        if (approveForm) {
            approveForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleApprove(e);
            });
        }

        // Decline Form
        const declineForm = document.getElementById('declineForm');
        if (declineForm) {
            declineForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleDecline(e);
            });
        }
    },

    async handleApprove(e) {
        const form = e.target;
        const formData = CasaConnect.FormUtils.serializeForm(form);

        try {
            const response = await CasaConnect.APIClient.post(
                `/api/manager/application/${this.applicationId}/approve`,
                formData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success(
                    'Application approved and tenant account created!'
                );
                this.closeApproveModal();

                // Redirect to new tenant details
                setTimeout(() => {
                    window.location.href = `/manager/applications-review`;
                }, 1500);
            } else {
                throw new Error(response.error || 'Failed to approve application');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        }
    },

    async handleDecline(e) {
        const form = e.target;
        const formData = CasaConnect.FormUtils.serializeForm(form);

        try {
            const response = await CasaConnect.APIClient.post(
                `/api/manager/application/${this.applicationId}/decline`,
                formData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success('Application declined');
                this.closeDeclineModal();

                // Redirect back to applications list
                setTimeout(() => {
                    window.location.href = '/manager/applications-review';
                }, 1500);
            } else {
                throw new Error(response.error || 'Failed to decline application');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        }
    },

    closeApproveModal() {
        CasaConnect.ModalManager.closeModal('approveModal');
        const form = document.getElementById('approveForm');
        if (form) form.reset();
    },

    closeDeclineModal() {
        CasaConnect.ModalManager.closeModal('declineModal');
        const form = document.getElementById('declineForm');
        if (form) form.reset();
    },
};

// Global functions
window.approveApplication = (applicationId) => {
    CasaConnect.ModalManager.openModal('approveModal');
};

window.unapproveApplication = async (applicationId) => {
    if (!confirm('Are you sure you want to unapprove this application?')) return;

    try {
        const response = await CasaConnect.APIClient.post(
            `/api/manager/application/${applicationId}/unapprove`
        );

        if (response.success) {
            CasaConnect.NotificationManager.success('Application unapproved');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message);
        }
    } catch (err) {
        CasaConnect.NotificationManager.error(err.message);
    }
};

window.declineApplication = (applicationId) => {
    CasaConnect.ModalManager.openModal('declineModal');
};

window.undeclineApplication = async (applicationId) => {
    if (!confirm('Are you sure you want to undecline this application?')) return;

    try {
        const response = await CasaConnect.APIClient.post(
            `/api/manager/application/${applicationId}/undecline`
        );

        if (response.success) {
            CasaConnect.NotificationManager.success('Application undeclined');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message);
        }
    } catch (err) {
        CasaConnect.NotificationManager.error(err.message);
    }
};

window.closeApproveModal = () => {
    ApplicationReview.closeApproveModal();
};

window.closeDeclineModal = () => {
    ApplicationReview.closeDeclineModal();
};

window.generateTempPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    document.getElementById('tempPassword').value = password;
};

window.viewDocument = (documentId) => {
    window.open(`/api/documents/${documentId}/view`, '_blank');
};

window.downloadDocument = (documentId) => {
    window.open(`/api/documents/${documentId}/download`, '_blank');
};
