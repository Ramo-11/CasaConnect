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