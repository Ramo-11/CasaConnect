// Form Management Utilities
class FormManager {
    // Validation utilities
    static validateForm(formElement) {
        let isValid = true;
        
        // Clear previous errors
        formElement.querySelectorAll('.form-group.error').forEach(group => {
            group.classList.remove('error');
        });
        
        // Validate required fields
        const requiredFields = formElement.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field);
                isValid = false;
            }
        });
        
        // Validate specific field types
        formElement.querySelectorAll('input[type="email"]').forEach(field => {
            if (field.value && !CasaConnect.FormUtils.validateEmail(field.value)) {
                this.showFieldError(field);
                CasaConnect.NotificationManager.error('Please enter a valid email address');
                isValid = false;
            }
        });
        
        formElement.querySelectorAll('input[type="tel"], input[data-format="phone"]').forEach(field => {
            if (field.value && !CasaConnect.FormUtils.validatePhone(field.value)) {
                this.showFieldError(field);
                CasaConnect.NotificationManager.error('Please enter a valid 10-digit phone number');
                isValid = false;
            }
        });
        
        if (!isValid) {
            CasaConnect.NotificationManager.error('Please fill in all required fields correctly');
        }
        
        return isValid;
    }
    
    static showFieldError(field) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
        }
    }
    
    static clearFieldError(field) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
        }
    }
    
    // Draft handling
    static initializeDraftHandling(formElement, draftKey) {
        let autoSaveTimer = null;
        
        const autoSave = () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                const formData = CasaConnect.FormUtils.serializeForm(formElement);
                CasaConnect.StorageHelper.set(draftKey, formData);
                console.log('Draft saved');
            }, 2000);
        };
        
        formElement.addEventListener('input', autoSave);
        formElement.addEventListener('change', autoSave);
        
        // Load draft on init
        this.loadDraft(formElement, draftKey);
        
        return autoSave;
    }
    
    static loadDraft(formElement, draftKey) {
        const draft = CasaConnect.StorageHelper.get(draftKey);
        if (draft) {
            if (confirm('A draft of your changes was found. Would you like to restore it?')) {
                Object.keys(draft).forEach(key => {
                    const field = formElement.querySelector(`[name="${key}"]`);
                    if (field) {
                        field.value = draft[key];
                    }
                });
            }
            CasaConnect.StorageHelper.remove(draftKey);
        }
    }
    
    static clearDraft(draftKey) {
        CasaConnect.StorageHelper.remove(draftKey);
    }
    
    // Unsaved changes handling
    static trackUnsavedChanges(formElement, originalDataKey) {
        const originalData = CasaConnect.FormUtils.serializeForm(formElement);
        CasaConnect.StorageHelper.set(originalDataKey, originalData);
        
        const handler = (e) => {
            const currentData = CasaConnect.FormUtils.serializeForm(formElement);
            const savedData = CasaConnect.StorageHelper.get(originalDataKey);
            
            if (JSON.stringify(currentData) !== JSON.stringify(savedData)) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        };
        
        window.addEventListener('beforeunload', handler);
        
        return handler;
    }
    
    // Submit button state management
    static setSubmitButtonLoading(button, isLoading = true, loadingText = 'Saving...') {
        const btnText = button.querySelector('.btn-text');
        const btnLoading = button.querySelector('.btn-loading');
        
        if (isLoading) {
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) {
                btnLoading.style.display = 'inline-flex';
                const spinner = btnLoading.querySelector('.spinner');
                if (spinner && loadingText) {
                    btnLoading.innerHTML = `<span class="spinner"></span> ${loadingText}`;
                }
            }
            button.disabled = true;
        } else {
            if (btnText) btnText.style.display = 'inline-flex';
            if (btnLoading) btnLoading.style.display = 'none';
            button.disabled = false;
        }
    }
    
    // Password generation (moved from tenant modal manager)
    static generatePassword(length = 12) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }
    
    static setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
            // Trigger change event for any listeners
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// Export for use in other files
window.FormManager = FormManager;