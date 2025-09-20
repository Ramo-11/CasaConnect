// Tenant Details JavaScript
let currentTenantId = null;

// Initialize tenant details page
CasaConnect.ready(() => {
    const tenantElement = document.querySelector("[data-tenant-id]");
    if (tenantElement) {
        currentTenantId = tenantElement.getAttribute("data-tenant-id");
    }

    // Initialize document upload form with reload callback
    DocumentManager.initializeUploadForm(() => {
        setTimeout(() => {
            location.reload();
        }, 1500);
    });

    // Load documents if we have a tenant ID
    if (currentTenantId) {
        DocumentManager.loadDocuments('documentsContainer', 'User', currentTenantId);
    }

    initializeActions();
});

// Initialize Actions
function initializeActions() {
    // Initialize tooltips if needed
    document.querySelectorAll("[title]").forEach((el) => {
        // Could add tooltip library here
    });
}

// Edit Tenant
function editTenant(tenantId) {
    window.location.href = `/manager/tenant/${tenantId}/edit`;
}

async function resetPassword(tenantId) {
    if (!confirm("Reset password for this tenant? They will receive a new temporary password via email.")) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.post("/api/manager/tenant/reset-password", {
            tenantId: tenantId,
        });

        if (response.success) {
            CasaConnect.NotificationManager.success("Password reset successfully. Email sent to tenant.");
        } else {
            throw new Error(response.error || "Failed to reset password");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// View Request
function viewRequest(requestId) {
    window.location.href = `/manager/service-requests/${requestId}`;
}

// Send Notification
function sendNotification(tenantId) {
    CasaConnect.NotificationManager.info("Notification feature coming soon");
}

// Generate Lease Document
async function generateLeaseDocument(tenantId) {
    try {
        CasaConnect.NotificationManager.info("Generating lease document...");
        const response = await CasaConnect.APIClient.get(`/manager/tenant/${tenantId}/lease`);

        if (response.success) {
            window.open(response.data.downloadUrl, "_blank");
            CasaConnect.NotificationManager.success("Lease document generated successfully");
        } else {
            throw new Error(response.error || "Failed to generate lease");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error("Lease generation feature coming soon");
    }
}

// View Documents
function viewDocuments(tenantId) {
    window.location.href = `/manager/tenant/${tenantId}/documents`;
}

// Export Tenant Data
async function exportTenantData(tenantId) {
    try {
        CasaConnect.NotificationManager.info("Exporting tenant data...");
        const response = await CasaConnect.APIClient.get(`/api/manager/tenant/${tenantId}/export`);

        if (response.success) {
            const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                type: "application/json",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `tenant-${tenantId}-data-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            CasaConnect.NotificationManager.success("Data exported successfully");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// Service Request Management Functions
let currentStatusFilter = 'all';

function filterByStatus(status) {
    currentStatusFilter = status;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    applyFilters();
}

function applyFilters() {
    const statusFilter = currentStatusFilter;
    const priorityFilter = document.getElementById('priorityFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const searchTerm = document.getElementById('requestSearch')?.value?.toLowerCase() || '';
    
    const allRequests = document.querySelectorAll('.request-card-full');
    
    allRequests.forEach(request => {
        const status = request.dataset.status;
        const priority = request.dataset.priority;
        const category = request.dataset.category;
        const title = request.querySelector('h3')?.textContent?.toLowerCase() || '';
        const description = request.querySelector('.request-description')?.textContent?.toLowerCase() || '';
        
        let show = true;
        
        if (statusFilter !== 'all' && status !== statusFilter) show = false;
        if (priorityFilter !== 'all' && priority !== priorityFilter) show = false;
        if (categoryFilter !== 'all' && category !== categoryFilter) show = false;
        if (searchTerm && !title.includes(searchTerm) && !description.includes(searchTerm)) show = false;
        
        request.style.display = show ? 'flex' : 'none';
    });
}

function toggleRequestNotes(requestId) {
    const notesContainer = document.getElementById(`notes-${requestId}`);
    if (notesContainer) {
        notesContainer.style.display = notesContainer.style.display === 'none' ? 'block' : 'none';
    }
}

async function updateStatus(requestId, newStatus) {
    if (!confirm(`Update status to ${newStatus.replace('_', ' ')}?`)) return;
    
    try {
        const response = await CasaConnect.APIClient.put(
            `/api/manager/service-requests/${requestId}/status`,
            { status: newStatus }
        );
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Status updated successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to update status');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

async function cancelRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this service request?')) return;
    
    try {
        const response = await CasaConnect.APIClient.put(
            `/api/manager/service-requests/${requestId}/status`,
            { status: 'cancelled' }
        );
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Request cancelled successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to cancel request');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

async function deleteServiceRequest(requestId) {
    if (!confirm('Are you sure you want to permanently delete this service request? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await CasaConnect.APIClient.delete(
            `/api/manager/service-requests/${requestId}`
        );
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Service request deleted successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to delete request');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// Assignment Modal Functions
function openAssignModal(requestId) {
    document.getElementById('assignRequestId').value = requestId;
    CasaConnect.ModalManager.openModal('assignModal');
}

function closeAssignModal() {
    CasaConnect.ModalManager.closeModal('assignModal');
    document.getElementById('assignForm').reset();
}

function addNote(requestId) {
    document.getElementById('noteRequestId').value = requestId;
    CasaConnect.ModalManager.openModal('noteModal');
}

function closeNoteModal() {
    CasaConnect.ModalManager.closeModal('noteModal');
    document.getElementById('noteForm').reset();
}

function viewDetails(requestId) {
    // Could expand the card or navigate to a details page
    const card = document.querySelector(`[data-request-id="${requestId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Initialize forms
CasaConnect.ready(() => {
    const assignForm = document.getElementById('assignForm');
    if (assignForm) {
        assignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = CasaConnect.FormUtils.serializeForm(assignForm);
            
            try {
                const response = await CasaConnect.APIClient.post('/api/manager/service-requests/assign', formData);
                if (response.success) {
                    CasaConnect.NotificationManager.success('Technician assigned successfully');
                    closeAssignModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.message || 'Failed to assign technician');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        });
    }
    
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = CasaConnect.FormUtils.serializeForm(noteForm);
            
            try {
                const response = await CasaConnect.APIClient.post('/api/manager/service-requests/note', formData);
                if (response.success) {
                    CasaConnect.NotificationManager.success('Note added successfully');
                    closeNoteModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.message || 'Failed to add note');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        });
    }
});

// Suspend Account
async function suspendAccount(tenantId) {
    if (!confirm("Are you sure you want to suspend this tenant account? They will not be able to log in.")) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.put(`/api/manager/tenant/${tenantId}/suspend`, {});

        if (response.success) {
            CasaConnect.NotificationManager.success("Account suspended successfully");
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || "Failed to suspend account");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

async function activateAccount(tenantId) {
    if (!confirm("Are you sure you want to activate this tenant account?")) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.put(`/api/manager/tenant/${tenantId}/activate`, {});

        if (response.success) {
            CasaConnect.NotificationManager.success("Account activated successfully");
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || "Failed to activate account");
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
                console.log("Payment status refreshed");
            }
        } catch (error) {
            console.error("Failed to refresh payment status:", error);
        }
    }, 60000);
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

const styleSheet = document.createElement("style");
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        printTenantDetails();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (currentTenantId) {
            editTenant(currentTenantId);
        }
    }
});

// Global functions that use DocumentManager
window.viewDocument = (documentId) => DocumentManager.viewDocument(documentId);
window.downloadDocument = (documentId) => DocumentManager.downloadDocument(documentId);
window.deleteDocument = (documentId) => {
    DocumentManager.deleteDocument(documentId, () => {
        setTimeout(() => {
            location.reload();
        }, 1500);
    });
};
window.attachDocument = (tenantId, relatedModel, hasActiveLease) => 
    DocumentManager.attachDocument(tenantId, relatedModel || 'User', hasActiveLease);
window.closeUploadDocumentModal = () => DocumentManager.closeUploadDocumentModal();
window.filterByStatus = filterByStatus;
window.applyFilters = applyFilters;
window.toggleRequestNotes = toggleRequestNotes;
window.updateStatus = updateStatus;
window.cancelRequest = cancelRequest;
window.deleteServiceRequest = deleteServiceRequest;
window.openAssignModal = openAssignModal;
window.closeAssignModal = closeAssignModal;
window.addNote = addNote;
window.closeNoteModal = closeNoteModal;
window.viewDetails = viewDetails;