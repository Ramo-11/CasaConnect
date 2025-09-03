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
    currentLeaseId = leaseId;
    CasaConnect.ModalManager.openModal('editLeaseModal');
}

function closeEditLeaseModal() {
    CasaConnect.ModalManager.closeModal('editLeaseModal');
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

function renewLease(leaseId) {
    currentLeaseId = leaseId;
    CasaConnect.ModalManager.openModal('renewLeaseModal');
}

function closeRenewLeaseModal() {
    CasaConnect.ModalManager.closeModal('renewLeaseModal');
    document.getElementById('renewLeaseForm').reset();
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

// Delete Lease (completely removes lease)
async function deleteLease(leaseId) {
    if (!confirm('Are you sure you want to permanently delete this lease? This will remove all associated documents and cannot be undone.')) {
        return;
    }
    
    try {
        const response = await CasaConnect.APIClient.delete(`/api/manager/lease/${leaseId}`);
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Lease deleted successfully');
            setTimeout(() => {
                window.history.back();
            }, 1500);
        } else {
            throw new Error(response.error || 'Failed to delete lease');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// Initialize Edit Lease Form Submission
CasaConnect.ready(() => {
    const editForm = document.getElementById('editLeaseForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const leaseId = document.getElementById('editLeaseId').value;
            const formData = new FormData(editForm);
            
            const updates = {};
            for (let [key, value] of formData.entries()) {
                if (key !== 'document') {
                    updates[key] = value;
                }
            }
            
            const btn = editForm.querySelector('button[type="submit"]');
            const btnText = btn.querySelector('.btn-text');
            const btnLoading = btn.querySelector('.btn-loading');
            
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
            btn.disabled = true;
            
            try {
                const fileInput = document.getElementById('editLeaseDocument');
                let documentId = null;
                
                if (fileInput.files && fileInput.files[0]) {
                    const docFormData = new FormData();
                    docFormData.append('file', fileInput.files[0]);
                    docFormData.append('title', `Updated Lease Agreement - ${new Date().toLocaleDateString()}`);
                    docFormData.append('type', 'lease');
                    docFormData.append('relatedModel', 'Lease');
                    docFormData.append('relatedId', leaseId);
                    
                    const docResponse = await CasaConnect.APIClient.post('/api/manager/documents', docFormData);
                    
                    if (docResponse.success) {
                        documentId = docResponse.data._id;
                        updates.document = documentId;
                    }
                }
                
                const response = await CasaConnect.APIClient.put(`/api/manager/lease/${leaseId}`, updates);
                
                if (response.success) {
                    CasaConnect.NotificationManager.success('Lease updated successfully');
                    closeEditLeaseModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to update lease');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                btnText.style.display = 'inline-block';
                btnLoading.style.display = 'none';
                btn.disabled = false;
            }
        });
    }
});

// Initialize Renew Lease Form Submission
CasaConnect.ready(() => {
    const renewForm = document.getElementById('renewLeaseForm');
    if (renewForm) {
        renewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const leaseId = document.getElementById('renewalLeaseId').value;
            const formData = new FormData(renewForm);
            
            const startDate = new Date(formData.get('startDate'));
            const endDate = new Date(formData.get('endDate'));
            
            if (endDate <= startDate) {
                CasaConnect.NotificationManager.error('End date must be after start date');
                return;
            }
            
            const termMonths = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));
            if (termMonths < 1) {
                CasaConnect.NotificationManager.error('Renewal term must be at least 1 month');
                return;
            }
            
            const fileInput = document.getElementById('renewalDocument');
            if (!fileInput.files || !fileInput.files[0]) {
                CasaConnect.NotificationManager.error('Please upload the renewal agreement document');
                return;
            }
            
            const btn = renewForm.querySelector('button[type="submit"]');
            const btnText = btn.querySelector('.btn-text');
            const btnLoading = btn.querySelector('.btn-loading');
            
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
            btn.disabled = true;
            
            try {
                formData.append('currentLeaseId', leaseId);
                const response = await CasaConnect.APIClient.post(`/api/manager/lease/${leaseId}/renew`, formData);
                
                if (response.success) {
                    CasaConnect.NotificationManager.success('Lease renewed successfully!');
                    closeRenewLeaseModal();
                    setTimeout(() => {
                        window.location.href = `/manager/lease/${response.data.data.newLeaseId}`;
                    }, 1500);
                } else {
                    throw new Error(response.error || 'Failed to renew lease');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                btnText.style.display = 'inline-block';
                btnLoading.style.display = 'none';
                btn.disabled = false;
            }
        });
    }
    
    const renewalStartDate = document.getElementById('renewalStartDate');
    if (renewalStartDate) {
        renewalStartDate.addEventListener('change', (e) => {
            const startDate = new Date(e.target.value);
            const endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
            document.getElementById('renewalEndDate').value = endDate.toISOString().split('T')[0];
        });
    }
});

// Initialize Terminate Form
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

CasaConnect.ready(() => {
    if (currentLeaseId) {
        DocumentManager.initializeUploadForm(() => {
            location.reload();
        });
    }
});

// Upload Lease Document
function uploadLeaseDocument(leaseId) {
    DocumentManager.attachDocument(leaseId, 'Lease');
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

const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);

// Global functions that use DocumentManager
window.viewDocument = (documentId) => DocumentManager.viewDocument(documentId);
window.downloadDocument = (documentId) => DocumentManager.downloadDocument(documentId);
window.deleteDocument = (documentId) => {
    DocumentManager.deleteDocument(documentId, () => {
        location.reload();
    });
};
window.uploadLeaseDocument = (leaseId) => {
    DocumentManager.attachDocument(leaseId, 'Lease');
};
window.attachDocument = (leaseId) => DocumentManager.attachDocument(leaseId, 'Lease');
window.closeUploadDocumentModal = () => DocumentManager.closeUploadDocumentModal();