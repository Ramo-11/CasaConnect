// Tenant Details JavaScript

let currentTenantId = null;
let availableUnits = [];

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

// Send Credentials
function sendCredentials(tenantId) {
    CasaConnect.ModalManager.openModal("sendCredentialsModal");
}

function closeSendCredentialsModal() {
    CasaConnect.ModalManager.closeModal("sendCredentialsModal");
    document.getElementById("newPassword").value = "";
}

function generateNewPassword() {
    const length = 12;
    const charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";

    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    document.getElementById("newPassword").value = password;
}

async function confirmSendCredentials(tenantId) {
    const newPassword = document.getElementById("newPassword").value;

    try {
        const data = {
            tenantId: tenantId,
        };

        if (newPassword) {
            data.newPassword = newPassword;
        }

        const response = await CasaConnect.APIClient.post(
            "/api/manager/tenant/send-credentials",
            data
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Credentials sent successfully!"
            );
            closeSendCredentialsModal();
        } else {
            throw new Error(response.error || "Failed to send credentials");
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
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

    if (confirmation !== "DELETE") {
        CasaConnect.NotificationManager.info("Deletion cancelled");
        return;
    }

    try {
        const response = await CasaConnect.APIClient.delete(
            `/manager/tenant/${tenantId}`
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Tenant deleted successfully"
            );
            setTimeout(() => {
                window.location.href = "/manager/dashboard";
            }, 1500);
        } else {
            throw new Error(response.error || "Failed to delete tenant");
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

async function openCreateLeaseModal(tenantId) {
    // Load available units first
    try {
        const response = await CasaConnect.APIClient.get(
            "/api/manager/units/available"
        );
        if (response.success) {
            availableUnits = response.data.data;
            populateUnitSelect(availableUnits);
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(
            `Failed to load available units: ${error.message}`
        );
        return;
    }

    CasaConnect.ModalManager.openModal("createLeaseModal");
}

function closeCreateLeaseModal() {
    CasaConnect.ModalManager.closeModal("createLeaseModal");
    document.getElementById("createLeaseForm").reset();
}

function populateUnitSelect(units) {
    const select = document.getElementById("leaseUnit");
    select.innerHTML = '<option value="">Choose available unit...</option>';

    units.forEach((unit) => {
        const option = document.createElement("option");
        option.value = unit._id;
        option.dataset.rent = unit.monthlyRent;
        option.textContent = `Unit ${unit.unitNumber} - ${unit.bedrooms} bed, ${unit.bathrooms} bath - $${unit.monthlyRent}/mo`;
        select.appendChild(option);
    });

    // Auto-fill rent when unit selected
    select.onchange = function () {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.dataset.rent) {
            document.getElementById("monthlyRent").value =
                selectedOption.dataset.rent;
            document.getElementById("securityDeposit").value =
                selectedOption.dataset.rent;
        }
    };
}

async function createLease(tenantId) {
  const formEl = document.getElementById("createLeaseForm");
  const formData = new FormData(formEl);
  formData.append("tenantId", tenantId);

  const btn = formEl.querySelector('button.btn-primary');
  btn.querySelector(".btn-text").style.display = "none";
  btn.querySelector(".btn-loading").style.display = "inline-block";
  btn.disabled = true;

  try {
    const res = await CasaConnect.APIClient.post("/api/manager/lease/create", formData);

    if (res.success) {
      CasaConnect.NotificationManager.success("Lease created successfully");
      closeCreateLeaseModal();
      setTimeout(() => location.reload(), 1500);
    } else {
      console.log(res)
      throw new Error(res.message || "Failed to create lease");
    }
  } catch (err) {
    console.error("Create lease error:", err);
    CasaConnect.NotificationManager.error(err.message || "Request failed");
  } finally {
    btn.querySelector(".btn-text").style.display = "inline-block";
    btn.querySelector(".btn-loading").style.display = "none";
    btn.disabled = false;
  }
}

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
            renderDocuments(response.data);
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
        <button class="btn-icon" onclick="downloadDocument('${doc.url}', '${
                doc.title
            }')" title="Download">
          <i class="fas fa-download"></i>
        </button>
        <button class="btn-icon danger" onclick="deleteDocument('${
            doc._id
        }', '${currentTenantId}')" title="Delete">
          <i class="fas fa-trash"></i>
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
function downloadDocument(url, title) {
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Delete document
async function deleteDocument(documentId, tenantId) {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
        const response = await CasaConnect.APIClient.delete(
            `/api/manager/documents/${documentId}`
        );

        if (response.success) {
            CasaConnect.NotificationManager.success(
                "Document deleted successfully"
            );
            loadDocuments(tenantId);
        } else {
            throw new Error(response.message);
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}
