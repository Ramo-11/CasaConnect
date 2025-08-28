// Lease Details JavaScript

let currentLeaseId = null;

// Initialize lease details page
CasaConnect.ready(() => {
  const leaseElement = document.querySelector('[data-lease-id]');
  if (leaseElement) {
    currentLeaseId = leaseElement.getAttribute('data-lease-id');
  }
});

// View Tenant
function viewTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}`;
}

// View Unit
function viewUnit(unitId) {
  window.location.href = `/manager/units/${unitId}`;
}

// Edit Lease
function editLease(leaseId) {
  // For now, redirect to a basic edit form
  CasaConnect.NotificationManager.info('Edit lease feature coming soon');
}

// Print Lease
function printLease(leaseId) {
  window.print();
}

// Email Lease to Tenant
async function emailLease(leaseId) {
  if (!confirm('Send lease document to tenant via email?')) return;
  
  try {
    const response = await CasaConnect.APIClient.post(`/api/manager/lease/${leaseId}/email`, {});
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Lease emailed to tenant successfully');
    } else {
      throw new Error(response.error || 'Failed to send email');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Renew Lease
function renewLease(leaseId) {
  // Open renewal modal or redirect to renewal page
  if (confirm('Start lease renewal process?')) {
    window.location.href = `/manager/lease/${leaseId}/renew`;
  }
}

// Terminate Lease Modal
function terminateLease(leaseId) {
  currentLeaseId = leaseId;
  CasaConnect.ModalManager.openModal('terminateModal');
}

function closeTerminateModal() {
  CasaConnect.ModalManager.closeModal('terminateModal');
  document.getElementById('terminateForm').reset();
}

// Initialize terminate form
CasaConnect.ready(() => {
  const form = document.getElementById('terminateForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const reason = document.getElementById('terminationReason').value;
      
      if (!reason.trim()) {
        CasaConnect.NotificationManager.error('Please provide a termination reason');
        return;
      }
      
      try {
        const response = await CasaConnect.APIClient.post(
          `/api/manager/lease/${currentLeaseId}/terminate`,
          { reason }
        );
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Lease terminated successfully');
          closeTerminateModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to terminate lease');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
      }
    });
  }
});

// View/Download Document
function viewDocument(documentId) {
  window.open(`/api/manager/documents/${documentId}/view`, '_blank');
}

function downloadDocument(documentId) {
  window.location.href = `/api/manager/documents/${documentId}/download`;
}

// Upload Lease Document
function uploadLeaseDocument(leaseId) {
  CasaConnect.NotificationManager.info('Document upload feature - use the upload modal');
}

// Add print styles
const printStyles = `
@media print {
  .header-actions,
  .action-button,
  .btn,
  .modal,
  .document-actions {
    display: none !important;
  }
  
  .details-grid {
    grid-template-columns: 1fr !important;
  }
  
  .card {
    page-break-inside: avoid;
    box-shadow: none !important;
    border: 1px solid #000;
  }
  
  .page-header {
    page-break-after: avoid;
  }
}
`;

// Inject print styles
const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);