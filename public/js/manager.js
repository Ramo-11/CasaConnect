// Manager Dashboard JavaScript

let selectedTenantId = null;

// Initialize manager dashboard
CasaConnect.ready(() => {
  initializeTenantSearch();
  initializeAddTenantForm();
  initializePasswordGenerator();
});

// Tenant Search
function initializeTenantSearch() {
  const searchInput = document.getElementById('tenantSearch');
  if (searchInput) {
    searchInput.addEventListener('input', CasaConnect.debounce((e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#tenantsTableBody tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    }, 300));
  }
}

// Add Tenant Modal
function openAddTenantModal() {
  CasaConnect.ModalManager.openModal('addTenantModal');
  
  // Set default lease dates
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  
  document.getElementById('leaseStart').value = today.toISOString().split('T')[0];
  document.getElementById('leaseEnd').value = nextYear.toISOString().split('T')[0];
  
  // Generate initial password
  generatePassword();
}

function closeAddTenantModal() {
  CasaConnect.ModalManager.closeModal('addTenantModal');
  document.getElementById('addTenantForm').reset();
}

// Initialize Add Tenant Form
function initializeAddTenantForm() {
  const form = document.getElementById('addTenantForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoading = submitBtn.querySelector('.btn-loading');
      
      // Validate form
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      // Show loading state
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline-flex';
      submitBtn.disabled = true;
      
      // Get form data
      const formData = CasaConnect.FormUtils.serializeForm(form);
      
      try {
        const response = await CasaConnect.APIClient.post('/manager/tenants', formData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Tenant account created successfully!');
          
          if (formData.sendCredentials) {
            CasaConnect.NotificationManager.info('Login credentials sent to tenant email');
          }
          
          // Close modal and refresh page
          closeAddTenantModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to create tenant');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
        
        // Reset button
        btnText.style.display = 'inline-flex';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
      }
    });
  }
}

// Password Generator
function initializePasswordGenerator() {
  // Auto-generate password on load
  if (document.getElementById('password')) {
    generatePassword();
  }
}

function generatePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.value = password;
  }
  
  return password;
}

function generateNewPassword() {
  const password = generatePassword();
  document.getElementById('newPassword').value = password;
}

// View Tenant
function viewTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}`;
}

// Edit Tenant
function editTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}/edit`;
}

// Send Credentials Modal
function sendCredentials(tenantId) {
  selectedTenantId = tenantId;
  
  // Get tenant info from table row
  const row = document.querySelector(`tr[data-tenant-id="${tenantId}"]`);
  if (row) {
    const name = row.querySelector('.name').textContent;
    const email = row.cells[2].textContent;
    const unit = row.cells[1].textContent;
    
    document.getElementById('credentialTenantName').textContent = name;
    document.getElementById('credentialTenantEmail').textContent = email;
    document.getElementById('credentialUnitNumber').textContent = `Unit: ${unit}`;
  }
  
  CasaConnect.ModalManager.openModal('sendCredentialsModal');
}

function closeSendCredentialsModal() {
  CasaConnect.ModalManager.closeModal('sendCredentialsModal');
  document.getElementById('newPassword').value = '';
  selectedTenantId = null;
}

async function confirmSendCredentials() {
  if (!selectedTenantId) return;
  
  const newPassword = document.getElementById('newPassword').value;
  
  try {
    const data = {
      tenantId: selectedTenantId
    };
    
    if (newPassword) {
      data.newPassword = newPassword;
    }
    
    const response = await CasaConnect.APIClient.post('/manager/send-credentials', data);
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Credentials sent successfully!');
      closeSendCredentialsModal();
    } else {
      throw new Error(response.error || 'Failed to send credentials');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Assign Unit
function assignUnit(unitId) {
  // Open add tenant modal with unit pre-selected
  openAddTenantModal();
  
  // Wait for modal to open then select unit
  setTimeout(() => {
    const unitSelect = document.getElementById('unitId');
    if (unitSelect) {
      unitSelect.value = unitId;
    }
  }, 100);
}

// Auto-refresh dashboard data
function autoRefreshDashboard() {
  setInterval(async () => {
    try {
      const response = await CasaConnect.APIClient.get('/manager/dashboard-stats');
      if (response.success) {
        updateDashboardStats(response.data);
      }
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }, 60000); // Refresh every minute
}

function updateDashboardStats(data) {
  // Update stat cards
  document.querySelectorAll('.stat-value').forEach((el, index) => {
    const values = [data.totalUnits, data.occupiedUnits, data.availableUnits, data.activeRequests];
    if (values[index] !== undefined) {
      el.textContent = values[index];
    }
  });
}

// Initialize auto-refresh
autoRefreshDashboard();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + N for new tenant
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    openAddTenantModal();
  }
  
  // Ctrl/Cmd + F for search focus
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.getElementById('tenantSearch');
    if (searchInput) {
      searchInput.focus();
    }
  }
});