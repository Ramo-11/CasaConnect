// Tenant Details JavaScript

let currentTenantId = null;

// Initialize tenant details page
CasaConnect.ready(() => {
  // Get tenant ID from page
  const tenantElement = document.querySelector('[data-tenant-id]');
  if (tenantElement) {
    currentTenantId = tenantElement.getAttribute('data-tenant-id');
  }
  
  initializeActions();
});

// Initialize Actions
function initializeActions() {
  // Initialize tooltips if needed
  document.querySelectorAll('[title]').forEach(el => {
    // Could add tooltip library here
  });
}

// Edit Tenant
function editTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}/edit`;
}

// Send Credentials
function sendCredentials(tenantId) {
  CasaConnect.ModalManager.openModal('sendCredentialsModal');
}

function closeSendCredentialsModal() {
  CasaConnect.ModalManager.closeModal('sendCredentialsModal');
  document.getElementById('newPassword').value = '';
}

function generateNewPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  document.getElementById('newPassword').value = password;
}

async function confirmSendCredentials(tenantId) {
  const newPassword = document.getElementById('newPassword').value;
  
  try {
    const data = {
      tenantId: tenantId
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

// Reset Password
async function resetPassword(tenantId) {
  if (!confirm('Reset password for this tenant? They will receive a new temporary password via email.')) {
    return;
  }
  
  try {
    const response = await CasaConnect.APIClient.post('/manager/reset-password', {
      tenantId: tenantId
    });
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Password reset successfully. Email sent to tenant.');
    } else {
      throw new Error(response.error || 'Failed to reset password');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Assign Unit to Tenant
function assignUnitToTenant(tenantId) {
  // This would open a modal to select a unit
  // For now, redirect to units page
  window.location.href = `/manager/units?assignTo=${tenantId}`;
}

// View Request
function viewRequest(requestId) {
  window.location.href = `/manager/service-requests/${requestId}`;
}

// Send Notification
function sendNotification(tenantId) {
  // This would open a modal to compose a notification
  CasaConnect.NotificationManager.info('Notification feature coming soon');
}

// Generate Lease Document
async function generateLeaseDocument(tenantId) {
  try {
    CasaConnect.NotificationManager.info('Generating lease document...');
    
    const response = await CasaConnect.APIClient.get(`/manager/tenant/${tenantId}/lease`);
    
    if (response.success) {
      // Download the generated document
      window.open(response.data.downloadUrl, '_blank');
      CasaConnect.NotificationManager.success('Lease document generated successfully');
    } else {
      throw new Error(response.error || 'Failed to generate lease');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error('Lease generation feature coming soon');
  }
}

// View Documents
function viewDocuments(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}/documents`;
}

// Export Tenant Data
async function exportTenantData(tenantId) {
  try {
    CasaConnect.NotificationManager.info('Exporting tenant data...');
    
    const response = await CasaConnect.APIClient.get(`/manager/tenant/${tenantId}/export`);
    
    if (response.success) {
      // Download the exported data
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-${tenantId}-data.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      CasaConnect.NotificationManager.success('Data exported successfully');
    } else {
      throw new Error(response.error || 'Failed to export data');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error('Export feature coming soon');
  }
}

// Suspend Account
async function suspendAccount(tenantId) {
  if (!confirm('Are you sure you want to suspend this tenant account? They will not be able to log in.')) {
    return;
  }
  
  try {
    const response = await CasaConnect.APIClient.put(`/manager/tenant/${tenantId}/suspend`, {});
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Account suspended successfully');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error(response.error || 'Failed to suspend account');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Delete Tenant
async function deleteTenant(tenantId) {
  const confirmMsg = `Are you sure you want to delete this tenant account?
This action cannot be undone and will:
- Remove all tenant data
- Cancel any active lease
- Remove unit assignment
- Delete payment history

Type "DELETE" to confirm:`;
  
  const confirmation = prompt(confirmMsg);
  
  if (confirmation !== 'DELETE') {
    CasaConnect.NotificationManager.info('Deletion cancelled');
    return;
  }
  
  try {
    const response = await CasaConnect.APIClient.delete(`/manager/tenant/${tenantId}`);
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Tenant deleted successfully');
      setTimeout(() => {
        window.location.href = '/manager/dashboard';
      }, 1500);
    } else {
      throw new Error(response.error || 'Failed to delete tenant');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Auto-refresh payment status
function autoRefreshData() {
  setInterval(async () => {
    try {
      const response = await CasaConnect.APIClient.get(`/api/tenant/${currentTenantId}/payment-status`);
      if (response.success) {
        // Update payment status on page if needed
        console.log('Payment status refreshed');
      }
    } catch (error) {
      console.error('Failed to refresh payment status:', error);
    }
  }, 60000); // Refresh every minute
}

// Initialize auto-refresh if on details page
if (currentTenantId) {
  autoRefreshData();
}

// Print tenant details
function printTenantDetails() {
  window.print();
}

// Add print styles
const printStyles = `
@media print {
  .header-actions,
  .action-button,
  .btn,
  .modal {
    display: none !important;
  }
  
  .details-grid {
    grid-template-columns: 1fr !important;
  }
  
  .page-header {
    page-break-after: avoid;
  }
  
  .card {
    page-break-inside: avoid;
  }
}
`;

// Inject print styles
const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + P for print
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    printTenantDetails();
  }
  
  // Ctrl/Cmd + E for edit
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    if (currentTenantId) {
      editTenant(currentTenantId);
    }
  }
});