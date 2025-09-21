// Manager Tenant Edit Page JavaScript

// Initialize edit form
PM.ready(() => {
    const form = document.getElementById('editTenantForm');
    if (form) {
        const tenantId = form.getAttribute('data-tenant-id');
        TenantEditManager.init(tenantId);
    }
});

// Tenant Edit Manager
const TenantEditManager = {
    tenantId: null,
    beforeUnloadHandler: null,

    init(tenantId) {
        this.tenantId = tenantId;
        this.initializeForm();
    },

    initializeForm() {
        const form = document.getElementById('editTenantForm');
        if (!form) return;

        // Initialize draft handling if FormManager is available
        if (window.FormManager) {
            FormManager.initializeDraftHandling(form, `tenant-edit-draft-${this.tenantId}`);
            this.beforeUnloadHandler = FormManager.trackUnsavedChanges(
                form,
                `tenant-original-${this.tenantId}`
            );
        }

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(e);
        });

        // Password reset checkbox
        const resetCheckbox = document.getElementById('resetPassword');
        if (resetCheckbox) {
            resetCheckbox.addEventListener('change', (e) => {
                this.togglePasswordField(e.target.checked);
            });
        }

        // Unit/Lease field change warnings
        this.initializeFieldWarnings();
    },

    async handleSubmit(e) {
        const form = e.target;

        // Use FormManager validation if available, otherwise basic validation
        if (window.FormManager && !FormManager.validateForm(form)) {
            return;
        } else if (!window.FormManager && !form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');

        // Use FormManager or manual loading state
        if (window.FormManager) {
            FormManager.setSubmitButtonLoading(submitBtn, true, 'Saving...');
        } else {
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;
        }

        try {
            const formData = PM.FormUtils.serializeForm(form);
            const response = await PM.APIClient.post(
                `/api/manager/tenant/${this.tenantId}/update`,
                formData
            );

            if (response.success) {
                // Clear draft if FormManager available
                if (window.FormManager) {
                    FormManager.clearDraft(`tenant-edit-draft-${this.tenantId}`);
                }

                // Remove beforeunload handler
                if (this.beforeUnloadHandler) {
                    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
                }

                PM.NotificationManager.success('Tenant information updated successfully!');
                setTimeout(() => {
                    window.location.href = `/manager/tenant/${this.tenantId}`;
                }, 1500);
            } else {
                throw new Error(response.error || 'Failed to update tenant');
            }
        } catch (error) {
            PM.NotificationManager.error(error.message);

            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, false);
            } else {
                const btnText = submitBtn.querySelector('.btn-text');
                const btnLoading = submitBtn.querySelector('.btn-loading');
                if (btnText) btnText.style.display = 'inline-flex';
                if (btnLoading) btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        }
    },

    togglePasswordField(show) {
        const passwordGroup = document.getElementById('newPasswordGroup');
        if (passwordGroup) {
            passwordGroup.style.display = show ? 'block' : 'none';
            if (!show) {
                const passwordField = document.getElementById('newPassword');
                if (passwordField) passwordField.value = '';
            }
        }
    },

    initializeFieldWarnings() {
        // Lease status change warning
        const leaseStatusSelect = document.getElementById('leaseStatus');
        if (leaseStatusSelect) {
            const originalStatus = leaseStatusSelect.value;
            leaseStatusSelect.addEventListener('change', function () {
                if (this.value === 'terminated' && originalStatus !== 'terminated') {
                    PM.NotificationManager.warning(
                        'Warning: Terminating a lease will end the rental agreement immediately.'
                    );
                }
            });
        }

        // Account status change warning
        const accountStatusSelect = document.getElementById('isActive');
        if (accountStatusSelect) {
            const originalStatus = accountStatusSelect.value;
            accountStatusSelect.addEventListener('change', function () {
                if (this.value === 'false' && originalStatus === 'true') {
                    PM.NotificationManager.warning(
                        'Warning: Deactivating this account will prevent the tenant from logging in.'
                    );
                }
            });
        }
    },
};

// Global helper functions for onclick handlers in HTML
window.togglePasswordField = () => {
    const checkbox = document.getElementById('resetPassword');
    TenantEditManager.togglePasswordField(checkbox?.checked);
};

window.generatePassword = () => {
    // Use FormManager if available, otherwise use modal manager
    if (window.FormManager) {
        const password = FormManager.generatePassword();
        FormManager.setFieldValue('newPassword', password);
    } else if (window.generateNewPassword) {
        // This calls the modal manager's method
        window.generateNewPassword();
    }
};

window.navigateBack = () => {
    if (TenantEditManager.tenantId) {
        window.location.href = `/manager/tenant/${TenantEditManager.tenantId}`;
    } else {
        window.history.back();
    }
};
