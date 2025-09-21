// Tenant Details JavaScript
let currentTenantId = null;

// Initialize tenant details page
PM.ready(() => {
    const tenantElement = document.querySelector('[data-tenant-id]');
    if (tenantElement) {
        currentTenantId = tenantElement.getAttribute('data-tenant-id');
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
    document.querySelectorAll('[title]').forEach((el) => {
        // Could add tooltip library here
    });
}

// Edit Tenant
function editTenant(tenantId) {
    window.location.href = `/manager/tenant/${tenantId}/edit`;
}

async function resetPassword(tenantId) {
    if (
        !confirm(
            'Reset password for this tenant? They will receive a new temporary password via email.'
        )
    ) {
        return;
    }

    try {
        const response = await PM.APIClient.post('/api/manager/tenant/reset-password', {
            tenantId: tenantId,
        });

        if (response.success) {
            PM.NotificationManager.success('Password reset successfully. Email sent to tenant.');
        } else {
            throw new Error(response.error || 'Failed to reset password');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// View Request
function viewRequest(requestId) {
    window.location.href = `/manager/service-requests/${requestId}`;
}

// Send Notification
function sendNotification(tenantId) {
    PM.NotificationManager.info('Notification feature coming soon');
}

// Generate Lease Document
async function generateLeaseDocument(tenantId) {
    try {
        PM.NotificationManager.info('Generating lease document...');
        const response = await PM.APIClient.get(`/manager/tenant/${tenantId}/lease`);

        if (response.success) {
            window.open(response.data.downloadUrl, '_blank');
            PM.NotificationManager.success('Lease document generated successfully');
        } else {
            throw new Error(response.error || 'Failed to generate lease');
        }
    } catch (error) {
        PM.NotificationManager.error('Lease generation feature coming soon');
    }
}

// View Documents
function viewDocuments(tenantId) {
    window.location.href = `/manager/tenant/${tenantId}/documents`;
}

// Export Tenant Data
async function exportTenantData(tenantId) {
    try {
        PM.NotificationManager.info('Exporting tenant data...');
        const response = await PM.APIClient.get(`/api/manager/tenant/${tenantId}/export`);

        if (response.success) {
            const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                type: 'application/json',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tenant-${tenantId}-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            PM.NotificationManager.success('Data exported successfully');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// Service Request Management Functions
let currentStatusFilter = 'all';

function filterByStatus(status) {
    currentStatusFilter = status;

    // Update active tab
    document.querySelectorAll('.filter-tab').forEach((tab) => {
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

    allRequests.forEach((request) => {
        const status = request.dataset.status;
        const priority = request.dataset.priority;
        const category = request.dataset.category;
        const title = request.querySelector('h3')?.textContent?.toLowerCase() || '';
        const description =
            request.querySelector('.request-description')?.textContent?.toLowerCase() || '';

        let show = true;

        if (statusFilter !== 'all' && status !== statusFilter) show = false;
        if (priorityFilter !== 'all' && priority !== priorityFilter) show = false;
        if (categoryFilter !== 'all' && category !== categoryFilter) show = false;
        if (searchTerm && !title.includes(searchTerm) && !description.includes(searchTerm))
            show = false;

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
        const response = await PM.APIClient.put(
            `/api/manager/service-requests/${requestId}/status`,
            { status: newStatus }
        );

        if (response.success) {
            PM.NotificationManager.success('Status updated successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to update status');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

async function cancelRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this service request?')) return;

    try {
        const response = await PM.APIClient.put(
            `/api/manager/service-requests/${requestId}/status`,
            { status: 'cancelled' }
        );

        if (response.success) {
            PM.NotificationManager.success('Request cancelled successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to cancel request');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

async function deleteServiceRequest(requestId) {
    if (
        !confirm(
            'Are you sure you want to permanently delete this service request? This action cannot be undone.'
        )
    ) {
        return;
    }

    try {
        const response = await PM.APIClient.delete(`/api/manager/service-requests/${requestId}`);

        if (response.success) {
            PM.NotificationManager.success('Service request deleted successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.message || 'Failed to delete request');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// Assignment Modal Functions
function openAssignModal(requestId) {
    document.getElementById('assignRequestId').value = requestId;
    PM.ModalManager.openModal('assignModal');
}

function closeAssignModal() {
    PM.ModalManager.closeModal('assignModal');
    document.getElementById('assignForm').reset();
}

function addNote(requestId) {
    document.getElementById('noteRequestId').value = requestId;
    PM.ModalManager.openModal('noteModal');
}

function closeNoteModal() {
    PM.ModalManager.closeModal('noteModal');
    document.getElementById('noteForm').reset();
}

function viewDetails(requestId) {
    // Could expand the card or navigate to a details page
    const card = document.querySelector(`[data-request-id="${requestId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
// Payment Recording Functions
let currentMonthlyRent = 0;

function openRecordPaymentModal(tenantId) {
    // Get tenant data
    const dataContainer = document.getElementById('tenantData');
    if (dataContainer) {
        const tenantName = dataContainer.dataset.tenantName;
        const tenantEmail = dataContainer.dataset.tenantEmail;
        const unitNumber = dataContainer.dataset.unitNumber;

        // Get monthly rent from the page
        const rentElement = document.querySelector('.rent-amount');
        if (rentElement) {
            const rentText = rentElement.textContent.replace('$', '').replace(',', '');
            currentMonthlyRent = parseFloat(rentText) || 0;
        }

        // Populate modal
        document.getElementById('paymentTenantId').value = tenantId;
        document.getElementById('paymentTenantName').textContent = tenantName || 'Unknown Tenant';
        document.getElementById('paymentTenantEmail').textContent = tenantEmail || 'No email';
        document.getElementById('paymentUnitInfo').textContent = unitNumber
            ? `Unit ${unitNumber}`
            : 'No unit assigned';
    }

    // Reset form
    const form = document.getElementById('recordPaymentForm');
    if (form) form.reset();

    // Hide rent details initially
    document.getElementById('rentDetailsSection').style.display = 'none';
    document.getElementById('rentAmountInfo').style.display = 'none';

    PM.ModalManager.openModal('recordPaymentModal');
}

function closeRecordPaymentModal() {
    PM.ModalManager.closeModal('recordPaymentModal');
}

function handlePaymentTypeChange() {
    const paymentType = document.getElementById('paymentType').value;
    const rentDetailsSection = document.getElementById('rentDetailsSection');

    if (paymentType === 'rent') {
        rentDetailsSection.style.display = 'block';
        checkRentAmount();
    } else {
        rentDetailsSection.style.display = 'none';
        document.getElementById('rentAmountInfo').style.display = 'none';
    }
}

function checkRentAmount() {
    const paymentType = document.getElementById('paymentType').value;
    const amountInput = document.getElementById('paymentAmount');
    const rentInfo = document.getElementById('rentAmountInfo');
    const rentMessage = document.getElementById('rentAmountMessage');

    if (paymentType === 'rent' && currentMonthlyRent > 0) {
        const amount = parseFloat(amountInput.value) || 0;

        if (amount > 0) {
            rentInfo.style.display = 'block';

            if (amount < currentMonthlyRent) {
                const remaining = currentMonthlyRent - amount;
                rentMessage.innerHTML = `Monthly rent is <strong>$${currentMonthlyRent.toFixed(
                    2
                )}</strong>. After this payment, <strong>$${remaining.toFixed(
                    2
                )}</strong> will remain due.`;
                rentInfo.className = 'alert alert-warning';
            } else if (amount > currentMonthlyRent) {
                const overpayment = amount - currentMonthlyRent;
                rentMessage.innerHTML = `Monthly rent is <strong>$${currentMonthlyRent.toFixed(
                    2
                )}</strong>. This payment includes an overpayment of <strong>$${overpayment.toFixed(
                    2
                )}</strong>.`;
                rentInfo.className = 'alert alert-info';
            } else {
                rentMessage.innerHTML = `This payment covers the full monthly rent of <strong>$${currentMonthlyRent.toFixed(
                    2
                )}</strong>.`;
                rentInfo.className = 'alert alert-success';
            }
        } else {
            rentInfo.style.display = 'none';
        }
    }
}

// Initialize payment form submission
PM.ready(() => {
    const recordPaymentForm = document.getElementById('recordPaymentForm');
    if (recordPaymentForm) {
        recordPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = e.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;

            try {
                const formData = PM.FormUtils.serializeForm(e.target);
                const tenantId = formData.tenantId;

                const response = await PM.APIClient.post(
                    `/api/manager/tenant/${tenantId}/payment`,
                    formData
                );

                if (response.success) {
                    PM.NotificationManager.success('Payment recorded successfully!');
                    closeRecordPaymentModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to record payment');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);
                btnText.style.display = 'inline-flex';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }
});

// Initialize forms
PM.ready(() => {
    const assignForm = document.getElementById('assignForm');
    if (assignForm) {
        assignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = PM.FormUtils.serializeForm(assignForm);

            try {
                const response = await PM.APIClient.post(
                    '/api/manager/service-requests/assign',
                    formData
                );
                if (response.success) {
                    PM.NotificationManager.success('Technician assigned successfully');
                    closeAssignModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.message || 'Failed to assign technician');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);
            }
        });
    }

    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = PM.FormUtils.serializeForm(noteForm);

            try {
                const response = await PM.APIClient.post(
                    '/api/manager/service-requests/note',
                    formData
                );
                if (response.success) {
                    PM.NotificationManager.success('Note added successfully');
                    closeNoteModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.message || 'Failed to add note');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);
            }
        });
    }
});

// Suspend Account
async function suspendAccount(tenantId) {
    if (
        !confirm(
            'Are you sure you want to suspend this tenant account? They will not be able to log in.'
        )
    ) {
        return;
    }

    try {
        const response = await PM.APIClient.put(`/api/manager/tenant/${tenantId}/suspend`, {});

        if (response.success) {
            PM.NotificationManager.success('Account suspended successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to suspend account');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

async function activateAccount(tenantId) {
    if (!confirm('Are you sure you want to activate this tenant account?')) {
        return;
    }

    try {
        const response = await PM.APIClient.put(`/api/manager/tenant/${tenantId}/activate`, {});

        if (response.success) {
            PM.NotificationManager.success('Account activated successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to activate account');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// Auto-refresh payment status
function autoRefreshData() {
    setInterval(async () => {
        try {
            const response = await PM.APIClient.get(
                `/api/tenant/${currentTenantId}/payment-status`
            );
            if (response.success) {
                console.log('Payment status refreshed');
            }
        } catch (error) {
            console.error('Failed to refresh payment status:', error);
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

const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        printTenantDetails();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
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
