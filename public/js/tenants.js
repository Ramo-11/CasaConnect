// Tenants Management JavaScript

let currentView = 'grid';
let selectedTenantId = null;

// Initialize tenants page
CasaConnect.ready(() => {
  initializeAddTenantForm();
  initializeAssignUnitForm();
  initializePasswordGenerator();
});

// View Management
function setView(view) {
  currentView = view;
  const display = document.getElementById('tenantsDisplay');
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  
  toggleBtns.forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (view === 'grid') {
    display.className = 'tenants-grid-view';
    toggleBtns[0].classList.add('active');
  } else {
    display.className = 'tenants-list-view';
    toggleBtns[1].classList.add('active');
  }
  
  // Save preference
  CasaConnect.StorageHelper.set('tenantsViewPreference', view);
}

// Load view preference
CasaConnect.ready(() => {
  const savedView = CasaConnect.StorageHelper.get('tenantsViewPreference');
  if (savedView) {
    setView(savedView);
  }
});

// Filter Tenants
function filterTenants() {
  const statusFilter = document.getElementById('statusFilter').value;
  const unitStatusFilter = document.getElementById('unitStatusFilter').value;
  const paymentFilter = document.getElementById('paymentFilter').value;
  const searchTerm = document.getElementById('tenantSearch').value.toLowerCase();
  
  const tenantCards = document.querySelectorAll('.tenant-card-full');
  
  tenantCards.forEach(card => {
    const status = card.getAttribute('data-status');
    const unitStatus = card.getAttribute('data-unit-status');
    const paymentStatus = card.getAttribute('data-payment-status');
    const name = card.getAttribute('data-name').toLowerCase();
    const email = card.getAttribute('data-email').toLowerCase();
    
    let show = true;
    
    if (statusFilter !== 'all' && status !== statusFilter) show = false;
    if (unitStatusFilter !== 'all' && unitStatus !== unitStatusFilter) show = false;
    if (paymentFilter !== 'all' && paymentStatus !== paymentFilter) show = false;
    if (searchTerm && !name.includes(searchTerm) && !email.includes(searchTerm)) show = false;
    
    card.style.display = show ? '' : 'none';
  });
  
  // Show empty state if no tenants visible
  const visibleCards = document.querySelectorAll('.tenant-card-full:not([style*="display: none"])');
  if (visibleCards.length === 0 && tenantCards.length > 0) {
    if (!document.querySelector('.no-results')) {
      const noResults = document.createElement('div');
      noResults.className = 'empty-state no-results';
      noResults.innerHTML = `
        <i class="fas fa-search"></i>
        <h3>No tenants match your filters</h3>
        <p>Try adjusting your search criteria</p>
      `;
      document.getElementById('tenantsDisplay').appendChild(noResults);
    }
  } else {
    const noResults = document.querySelector('.no-results');
    if (noResults) noResults.remove();
  }
}

// Add Tenant Modal
function openAddTenantModal() {
  CasaConnect.ModalManager.openModal('addTenantModal');
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

// View Unit
function viewUnit(unitId) {
  window.location.href = `/manager/units/${unitId}`;
}

// Send Credentials
function sendCredentials(tenantId) {
  selectedTenantId = tenantId;
  
  // Get tenant info from card
  const card = document.querySelector(`[data-tenant-id="${tenantId}"]`);
  if (card) {
    const name = card.getAttribute('data-name');
    const email = card.getAttribute('data-email');
    const unitInfo = card.querySelector('.unit-details strong');
    
    document.getElementById('credentialTenantName').textContent = name;
    document.getElementById('credentialTenantEmail').textContent = email;
    document.getElementById('credentialUnitNumber').textContent = unitInfo ? unitInfo.textContent : 'No unit assigned';
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

// Assign Unit to Tenant
function assignUnitToTenant(tenantId) {
  selectedTenantId = tenantId;
  
  // Get tenant info from card
  const card = document.querySelector(`[data-tenant-id="${tenantId}"]`);
  if (card) {
    const name = card.getAttribute('data-name');
    const email = card.getAttribute('data-email');
    
    document.getElementById('assignTenantId').value = tenantId;
    document.getElementById('assignTenantName').textContent = name;
    document.getElementById('assignTenantEmail').textContent = email;
  }
  
  CasaConnect.ModalManager.openModal('assignUnitModal');
}

function closeAssignUnitModal() {
  CasaConnect.ModalManager.closeModal('assignUnitModal');
  document.getElementById('assignUnitForm').reset();
  selectedTenantId = null;
}

// Initialize Assign Unit Form
function initializeAssignUnitForm() {
  const form = document.getElementById('assignUnitForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = CasaConnect.FormUtils.serializeForm(form);
      
      try {
        const response = await CasaConnect.APIClient.post('/api/manager/tenant/assign-unit', formData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Unit assigned successfully!');
          closeAssignUnitModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to assign unit');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
      }
    });
  }
}

// Delete Tenant
async function deleteTenant(tenantId) {
  const confirmMsg = `Are you sure you want to delete this tenant account?
This action cannot be undone and will:
- Remove all tenant data
- Remove unit assignment
- Delete payment history

Type "DELETE" to confirm:`;
  
  const confirmation = prompt(confirmMsg);
  
  if (confirmation !== 'DELETE') {
    CasaConnect.NotificationManager.info('Deletion cancelled');
    return;
  }
  
  try {
    const response = await CasaConnect.APIClient.delete(`/api/manager/tenant/${tenantId}`);
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Tenant deleted successfully');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error(response.error || 'Failed to delete tenant');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Auto-refresh tenant data
function autoRefreshTenants() {
  setInterval(async () => {
    try {
      const response = await CasaConnect.APIClient.get('/api/manager/tenants/updates');
      if (response.success && response.data.hasUpdates) {
        CasaConnect.NotificationManager.info('New updates available. Refreshing...');
        setTimeout(() => location.reload(), 2000);
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, 60000); // Check every minute
}

// Initialize auto-refresh
autoRefreshTenants();

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