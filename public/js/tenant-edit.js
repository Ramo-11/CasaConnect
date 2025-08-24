// Tenant Edit JavaScript

let currentTenantId = null;

// Initialize edit form
CasaConnect.ready(() => {
  const form = document.getElementById('editTenantForm');
  if (form) {
    currentTenantId = form.getAttribute('data-tenant-id');
    initializeEditForm();
  }
});

// Initialize Edit Form
function initializeEditForm() {
  const form = document.getElementById('editTenantForm');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // Show loading state
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    // Get form data
    const formData = CasaConnect.FormUtils.serializeForm(form);
    
    try {
      const response = await CasaConnect.APIClient.post(`/manager/tenant/${currentTenantId}/update`, formData);
      
      if (response.success) {
        CasaConnect.ModalManager.openModal('successModal');
        
        // If unit was changed, update the old unit status
        if (formData.unitId !== form.getAttribute('data-original-unit')) {
          // The backend should handle this
        }
      } else {
        throw new Error(response.error || 'Failed to update tenant');
      }
    } catch (error) {
      CasaConnect.NotificationManager.error(error.message);
      
      // Reset button
      btnText.style.display = 'inline-flex';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
  
  // Store original unit for comparison
  const unitSelect = document.getElementById('unitId');
  if (unitSelect) {
    form.setAttribute('data-original-unit', unitSelect.value);
  }
}

// Validate Form
function validateForm() {
  const form = document.getElementById('editTenantForm');
  let isValid = true;
  
  // Clear previous errors
  form.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
  });
  
  // Validate required fields
  const requiredFields = form.querySelectorAll('[required]');
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      const formGroup = field.closest('.form-group');
      if (formGroup) {
        formGroup.classList.add('error');
      }
      isValid = false;
    }
  });
  
  // Validate email
  const emailField = document.getElementById('email');
  if (emailField && !CasaConnect.FormUtils.validateEmail(emailField.value)) {
    const formGroup = emailField.closest('.form-group');
    if (formGroup) {
      formGroup.classList.add('error');
    }
    CasaConnect.NotificationManager.error('Please enter a valid email address');
    isValid = false;
  }
  
  // Validate phone
  const phoneField = document.getElementById('phone');
  if (phoneField && !CasaConnect.FormUtils.validatePhone(phoneField.value)) {
    const formGroup = phoneField.closest('.form-group');
    if (formGroup) {
      formGroup.classList.add('error');
    }
    CasaConnect.NotificationManager.error('Please enter a valid 10-digit phone number');
    isValid = false;
  }
  
  if (!isValid) {
    CasaConnect.NotificationManager.error('Please fill in all required fields correctly');
  }
  
  return isValid;
}

// Toggle Password Field
function togglePasswordField() {
  const checkbox = document.getElementById('resetPassword');
  const passwordGroup = document.getElementById('newPasswordGroup');
  
  if (checkbox.checked) {
    passwordGroup.style.display = 'block';
  } else {
    passwordGroup.style.display = 'none';
    document.getElementById('newPassword').value = '';
  }
}

// Generate Password
function generatePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  const passwordInput = document.getElementById('newPassword');
  if (passwordInput) {
    passwordInput.value = password;
  }
}

// Close Success Modal
function closeSuccessModal() {
  CasaConnect.ModalManager.closeModal('successModal');
}

// Redirect to Details
function redirectToDetails() {
  window.location.href = `/manager/tenant/${currentTenantId}`;
}

// Handle unit change warning
document.addEventListener('DOMContentLoaded', () => {
  const unitSelect = document.getElementById('unitId');
  if (unitSelect) {
    unitSelect.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      if (selectedOption.text.includes('Currently Occupied')) {
        CasaConnect.NotificationManager.warning(
          'Warning: This unit is currently occupied. Assigning it will remove the current tenant.'
        );
      }
    });
  }
});

// Auto-save draft (optional feature)
let autoSaveTimer = null;

function autoSaveDraft() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const form = document.getElementById('editTenantForm');
    const formData = CasaConnect.FormUtils.serializeForm(form);
    CasaConnect.StorageHelper.set(`tenant-edit-draft-${currentTenantId}`, formData);
    console.log('Draft saved');
  }, 2000);
}

// Load draft if exists
function loadDraft() {
  const draft = CasaConnect.StorageHelper.get(`tenant-edit-draft-${currentTenantId}`);
  if (draft) {
    if (confirm('A draft of your changes was found. Would you like to restore it?')) {
      const form = document.getElementById('editTenantForm');
      Object.keys(draft).forEach(key => {
        const field = form.querySelector(`[name="${key}"]`);
        if (field) {
          field.value = draft[key];
        }
      });
    }
    // Clear draft after loading or rejecting
    CasaConnect.StorageHelper.remove(`tenant-edit-draft-${currentTenantId}`);
  }
}

// Add change listeners for auto-save
CasaConnect.ready(() => {
  loadDraft();
  
  const form = document.getElementById('editTenantForm');
  if (form) {
    form.addEventListener('input', autoSaveDraft);
    form.addEventListener('change', autoSaveDraft);
  }
});

// Clear draft on successful save
window.addEventListener('beforeunload', (e) => {
  const form = document.getElementById('editTenantForm');
  if (form && form.querySelector('.btn-loading').style.display === 'none') {
    // Check if there are unsaved changes
    const currentData = CasaConnect.FormUtils.serializeForm(form);
    const originalData = CasaConnect.StorageHelper.get(`tenant-original-${currentTenantId}`);
    
    if (JSON.stringify(currentData) !== JSON.stringify(originalData)) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }
});

// Store original data on load
CasaConnect.ready(() => {
  const form = document.getElementById('editTenantForm');
  if (form) {
    const originalData = CasaConnect.FormUtils.serializeForm(form);
    CasaConnect.StorageHelper.set(`tenant-original-${currentTenantId}`, originalData);
  }
});