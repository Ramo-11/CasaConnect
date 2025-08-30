// Tenant Details JavaScript

let currentTenantId = null;

// Initialize tenant details page
CasaConnect.ready(() => {
    const tenantElement = document.querySelector("[data-tenant-id]");
    if (tenantElement) {
        currentTenantId = tenantElement.getAttribute("data-tenant-id");
    }

    // THEN load documents if we have a tenant ID
    if (currentTenantId) {
        loadDocuments(currentTenantId);
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
    if (
        !confirm(
            "Reset password for this tenant? They will receive a new temporary password via email."
        )
    ) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.post(
            "/api/manager/tenant/reset-password",
            {
                tenantId: tenantId,
            }
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Password reset successfully. Email sent to tenant."
            );
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
    // This would open a modal to compose a notification
    CasaConnect.NotificationManager.info("Notification feature coming soon");
}

// Generate Lease Document
async function generateLeaseDocument(tenantId) {
    try {
        CasaConnect.NotificationManager.info("Generating lease document...");

        const response = await CasaConnect.APIClient.get(
            `/manager/tenant/${tenantId}/lease`
        );

        if (response.success) {
            // Download the generated document
            window.open(response.data.downloadUrl, "_blank");
            CasaConnect.NotificationManager.success(
                "Lease document generated successfully"
            );
        } else {
            throw new Error(response.error || "Failed to generate lease");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(
            "Lease generation feature coming soon"
        );
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

        const response = await CasaConnect.APIClient.get(
            `/api/manager/tenant/${tenantId}/export`
        );

        if (response.success) {
            const blob = new Blob([JSON.stringify(response.data, null, 2)], {
                type: "application/json",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `tenant-${tenantId}-data-${
                new Date().toISOString().split("T")[0]
            }.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            CasaConnect.NotificationManager.success(
                "Data exported successfully"
            );
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// Suspend Account
async function suspendAccount(tenantId) {
    if (
        !confirm(
            "Are you sure you want to suspend this tenant account? They will not be able to log in."
        )
    ) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.put(
            `/api/manager/tenant/${tenantId}/suspend`,
            {}
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Account suspended successfully"
            );
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || "Failed to suspend account");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

async function activateAccount(tenantId) {
    if (
        !confirm(
            "Are you sure you want to activate this tenant account?"
        )
    ) {
        return;
    }

    try {
        const response = await CasaConnect.APIClient.put(
            `/api/manager/tenant/${tenantId}/activate`,
            {}
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Account activated successfully"
            );
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
            const response = await CasaConnect.APIClient.get(
                `/api/tenant/${currentTenantId}/payment-status`
            );
            if (response.success) {
                // Update payment status on page if needed
                console.log("Payment status refreshed");
            }
        } catch (error) {
            console.error("Failed to refresh payment status:", error);
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
const styleSheet = document.createElement("style");
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + P for print
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        printTenantDetails();
    }

    // Ctrl/Cmd + E for edit
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (currentTenantId) {
            editTenant(currentTenantId);
        }
    }
});

// Fix the loading documents bug - update loadDocuments function:
async function loadDocuments(tenantId) {
    const container = document.getElementById("documentsContainer");
    container.innerHTML =
        '<div class="loading-spinner">Loading documents...</div>';

    try {
        const response = await CasaConnect.APIClient.get(
            `/api/manager/documents?relatedModel=User&relatedId=${tenantId}`
        );

        if (response.success) {
            renderDocuments(response.data.data);
        } else {
            container.innerHTML =
                '<p class="no-data">Failed to load documents</p>';
        }
    } catch (error) {
        console.error("Failed to load documents:", error);
        container.innerHTML = '<p class="no-data">Failed to load documents</p>';
    }
}

// Render documents list
function renderDocuments(documents) {
    const container = document.getElementById("documentsContainer");

    if (!documents || documents.length === 0) {
        container.innerHTML = '<p class="no-data">No documents uploaded</p>';
        return;
    }
    const html = documents
        .map(
            (doc) => `
    <div class="document-item">
      <div class="document-icon">
        <i class="fas ${getDocumentIcon(doc.type)}"></i>
      </div>
      <div class="document-info">
        <h5>${doc.title}</h5>
        <span class="document-meta">
          ${doc.type} • ${formatFileSize(doc.size)} • ${new Date(
                doc.createdAt
            ).toLocaleDateString()}
        </span>
      </div>
      <div class="document-actions">
        <button class="btn-icon" onclick="viewDocument('${
            doc._id
        }')" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon" onclick="downloadDocument('${doc._id}')" title="Download">
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>
  `
        )
        .join("");

    container.innerHTML = html;
}

// Get document icon based on type
function getDocumentIcon(type) {
    const icons = {
        lease: "fa-file-contract",
        contract: "fa-file-signature",
        notice: "fa-file-alt",
        invoice: "fa-file-invoice",
        other: "fa-file",
    };
    return icons[type] || "fa-file";
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// View document
function viewDocument(documentId) {
    // This would open the document in a new tab
    window.open(`/api/manager/documents/${documentId}/view`, "_blank");
}

// Download document
function downloadDocument(documentId) {
    window.open(`/api/manager/documents/${documentId}/download`, "_blank");
}

// Delete document
// async function deleteDocument(documentId, tenantId) {
//     if (!confirm("Are you sure you want to delete this document?")) return;

//     try {
//         const response = await CasaConnect.APIClient.delete(
//             `/api/manager/documents/${documentId}`
//         );

//         if (response.success) {
//             CasaConnect.NotificationManager.success(
//                 "Document deleted successfully"
//             );
//             loadDocuments(tenantId);
//         } else {
//             throw new Error(response.message);
//         }
//     } catch (error) {
//         CasaConnect.NotificationManager.error(error.message);
//     }
// }
