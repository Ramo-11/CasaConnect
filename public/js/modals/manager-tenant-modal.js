// Tenant Modal Manager - Handles all tenant-related modals
(function () {
    "use strict";

    // State for tenant modals
    const tenantModalState = {
        selectedTenantId: null,
        availableUnits: [],
        availableTenants: [],
    };

    class TenantModalManager {
        constructor() {
            this.initializeModals();
            this.loadInitialData();
        }

        // Initialize all modal event listeners
        initializeModals() {
            this.initializeFormHandlers();
            this.initializeModalTriggers();
        }

        // Load initial data needed for modals
        async loadInitialData() {
            try {
                // Load available units for dropdowns
                const unitsResponse = await CasaConnect.APIClient.get(
                    "/api/manager/units/available"
                );
                if (unitsResponse.success) {
                    tenantModalState.availableUnits =
                        unitsResponse.data.data || [];
                }
            } catch (error) {
                console.error("Failed to load initial data:", error);
            }
        }

        // Initialize form handlers
        initializeFormHandlers() {
            // Add Tenant Form
            const addTenantForm = document.getElementById("addTenantForm");
            if (addTenantForm && !addTenantForm.dataset.initialized) {
                addTenantForm.dataset.initialized = "true";
                addTenantForm.addEventListener(
                    "submit",
                    this.handleAddTenant.bind(this)
                );
            }

            // Assign Unit Form
            const assignUnitForm = document.getElementById("assignUnitForm");
            if (assignUnitForm && !assignUnitForm.dataset.initialized) {
                assignUnitForm.dataset.initialized = "true";
                assignUnitForm.addEventListener(
                    "submit",
                    this.handleAssignUnit.bind(this)
                );
            }
        }

        // Initialize modal triggers
        initializeModalTriggers() {
            // When modals open, load necessary data
            document.addEventListener("tenantModalOpen", (e) => {
                if (e.detail.modalId === "assignUnitModal") {
                    this.loadAvailableUnits();
                }
                if (e.detail.modalId === "addTenantModal") {
                    this.loadAvailableUnits();
                    this.populateUnitSelectForNewTenant();
                }
            });
        }

        // === UI POPULATION METHODS ===

        populateUnitSelects() {
            const selects = ["assignUnitSelect"]; // Remove "leaseUnit" - that's for lease modal
            
            selects.forEach((selectId) => {
                const select = document.getElementById(selectId);
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">Choose available unit...</option>';

                    tenantModalState.availableUnits.forEach((unit) => {
                        const option = document.createElement("option");
                        option.value = unit._id;
                        option.textContent = `Unit ${unit.unitNumber} - ${unit.bedrooms} bed, ${unit.bathrooms} bath - $${unit.monthlyRent}/mo`;
                        select.appendChild(option);
                    });

                    if (currentValue) {
                        select.value = currentValue;
                    }
                }
            });
        }

        async loadAvailableUnits() {
            try {
                const response = await CasaConnect.APIClient.get("/api/manager/units/available");
                if (response.success) {
                    tenantModalState.availableUnits = response.data.data || response.data || [];
                    this.populateUnitSelects();
                }
            } catch (error) {
                console.error("Failed to load units:", error);
            }
        }

        populateUnitSelectForNewTenant() {
            const select = document.getElementById("unitId");
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">No unit assigned</option>';

                tenantModalState.availableUnits.forEach((unit) => {
                    const option = document.createElement("option");
                    option.value = unit._id;
                    option.textContent = `Unit ${unit.unitNumber} - ${unit.propertyType} - ${unit.bedrooms} bed, ${unit.bathrooms} bath - $${unit.monthlyRent}/mo`;
                    select.appendChild(option);
                });

                if (currentValue) {
                    select.value = currentValue;
                }
            }
        }

        // === FORM HANDLERS ===

        async handleAddTenant(e) {
            e.preventDefault();

            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector(".btn-text");
            const btnLoading = submitBtn.querySelector(".btn-loading");

            btnText.style.display = "none";
            btnLoading.style.display = "inline-flex";
            submitBtn.disabled = true;

            try {
                const formData = CasaConnect.FormUtils.serializeForm(form);
                const response = await CasaConnect.APIClient.post(
                    "/manager/tenants",
                    formData
                );

                if (response.success) {
                    CasaConnect.NotificationManager.success(
                        "Tenant created successfully!"
                    );
                    if (formData.sendCredentials) {
                        CasaConnect.NotificationManager.info(
                            "Login credentials sent to tenant email"
                        );
                    }
                    this.closeAddTenantModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(
                        response.error || "Failed to create tenant"
                    );
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                btnText.style.display = "inline-flex";
                btnLoading.style.display = "none";
                submitBtn.disabled = false;
            }
        }

        async handleAssignUnit(e) {
            e.preventDefault();

            const formData = CasaConnect.FormUtils.serializeForm(e.target);

            try {
                const response = await CasaConnect.APIClient.post(
                    "/api/manager/tenant/assign-unit",
                    formData
                );

                if (response.success) {
                    CasaConnect.NotificationManager.success(
                        "Unit assigned successfully!"
                    );
                    this.closeAssignUnitModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || "Failed to assign unit");
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        }

        // === MODAL OPEN METHODS ===

        openAddTenantModal() {
            this.generatePassword();
            this.populateUnitSelectForNewTenant();
            CasaConnect.ModalManager.openModal("addTenantModal");
            document.dispatchEvent(
                new CustomEvent("tenantModalOpen", {
                    detail: { modalId: "addTenantModal" },
                })
            );
        }

        openSendCredentialsModal(tenantId) {
            tenantModalState.selectedTenantId = tenantId;

            const nameEl = document.getElementById("credentialTenantName");
            const emailEl = document.getElementById("credentialTenantEmail");
            const unitEl = document.getElementById("credentialUnitNumber");

            // Check for tenant data container (on details page)
            const dataContainer = document.getElementById("tenantData");
            if (dataContainer) {
                if (nameEl)
                    nameEl.textContent =
                        dataContainer.dataset.tenantName || "-";
                if (emailEl)
                    emailEl.textContent =
                        dataContainer.dataset.tenantEmail || "-";
                if (unitEl) {
                    const unitNumber = dataContainer.dataset.unitNumber;
                    unitEl.textContent = unitNumber
                        ? `Unit: ${unitNumber}`
                        : "No unit assigned";
                }
            } else {
                // Look for tenant card (on list pages)
                const card = document.querySelector(
                    `[data-tenant-id="${tenantId}"]`
                );
                if (card) {
                    const name =
                        card.getAttribute("data-name") ||
                        card.querySelector(".tenant-name .name")?.textContent ||
                        card.querySelector("h3")?.textContent;
                    const email =
                        card.getAttribute("data-email") ||
                        card.querySelector(".email-text")?.textContent;

                    if (nameEl) nameEl.textContent = name || "-";
                    if (emailEl) emailEl.textContent = email || "-";

                    // Try to get unit info
                    const unitInfo =
                        card.querySelector(".unit-badge")?.textContent ||
                        card.querySelector(".unit-details strong")?.textContent;
                    if (unitEl) {
                        unitEl.textContent = unitInfo
                            ? `Unit: ${unitInfo}`
                            : "No unit assigned";
                    }
                } else {
                    // Fallback - set defaults
                    if (nameEl) nameEl.textContent = "-";
                    if (emailEl) emailEl.textContent = "-";
                    if (unitEl) unitEl.textContent = "-";
                }
            }

            CasaConnect.ModalManager.openModal("sendCredentialsModal");
            document.dispatchEvent(
                new CustomEvent("tenantModalOpen", {
                    detail: { modalId: "sendCredentialsModal" },
                })
            );
        }

        openAssignUnitModal(tenantId) {
            tenantModalState.selectedTenantId = tenantId;

            const tenantIdInput = document.getElementById("assignTenantId");
            if (tenantIdInput) tenantIdInput.value = tenantId;

            // Get tenant info
            const card = document.querySelector(
                `[data-tenant-id="${tenantId}"]`
            );
            if (card) {
                const name =
                    card.getAttribute("data-name") ||
                    card.querySelector("h3")?.textContent;
                const email =
                    card.getAttribute("data-email") ||
                    card.querySelector(".email-text")?.textContent;

                const nameEl = document.getElementById("assignTenantName");
                const emailEl = document.getElementById("assignTenantEmail");

                if (nameEl) nameEl.textContent = name || "-";
                if (emailEl) emailEl.textContent = email || "-";
            }

            this.loadAvailableUnits();
            CasaConnect.ModalManager.openModal("assignUnitModal");
            document.dispatchEvent(
                new CustomEvent("tenantModalOpen", {
                    detail: { modalId: "assignUnitModal" },
                })
            );
        }

        openDeleteTenantModal(tenantId) {
            tenantModalState.selectedTenantId = tenantId;
            const confirmInput = document.getElementById("deleteConfirmation");
            if (confirmInput) confirmInput.value = "";
            CasaConnect.ModalManager.openModal("deleteTenantModal");
            document.dispatchEvent(
                new CustomEvent("tenantModalOpen", {
                    detail: { modalId: "deleteTenantModal" },
                })
            );
        }

        // === MODAL CLOSE METHODS ===

        closeAddTenantModal() {
            CasaConnect.ModalManager.closeModal("addTenantModal");
            const form = document.getElementById("addTenantForm");
            if (form) form.reset();
        }

        closeSendCredentialsModal() {
            CasaConnect.ModalManager.closeModal("sendCredentialsModal");
            const passwordInput = document.getElementById("newPassword");
            if (passwordInput) passwordInput.value = "";
            tenantModalState.selectedTenantId = null;
        }

        closeAssignUnitModal() {
            CasaConnect.ModalManager.closeModal("assignUnitModal");
            const form = document.getElementById("assignUnitForm");
            if (form) form.reset();
            tenantModalState.selectedTenantId = null;
        }

        closeDeleteTenantModal() {
            CasaConnect.ModalManager.closeModal("deleteTenantModal");
            tenantModalState.selectedTenantId = null;
        }

        generatePassword() {
            const password = FormManager.generatePassword();
            FormManager.setFieldValue("password", password);
            return password;
        }

        generateNewPassword() {
            const password = FormManager.generatePassword();
            FormManager.setFieldValue("newPassword", password);
            return password;
        }

        openSuccessModal(title, message, callback) {
            const titleEl = document.getElementById("successModalTitle");
            const messageEl = document.getElementById("successModalMessage");
            const buttonEl = document.getElementById("successModalButton");

            if (titleEl) titleEl.textContent = title || "Success";
            if (messageEl)
                messageEl.textContent =
                    message || "Operation completed successfully.";

            if (callback && buttonEl) {
                buttonEl.onclick = () => {
                    this.closeSuccessModal();
                    callback();
                };
            }

            CasaConnect.ModalManager.openModal("successModal");
        }

        closeSuccessModal() {
            CasaConnect.ModalManager.closeModal("successModal");
            // Reset button onclick
            const buttonEl = document.getElementById("successModalButton");
            if (buttonEl) {
                buttonEl.onclick = () => this.closeSuccessModal();
            }
        }
        // === ACTION METHODS ===
        async confirmSendCredentials() {
            if (!tenantModalState.selectedTenantId) return;

            const newPassword = document.getElementById("newPassword")?.value;

            try {
                const data = {
                    tenantId: tenantModalState.selectedTenantId,
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
                    this.closeSendCredentialsModal();
                } else {
                    throw new Error(
                        response.error || "Failed to send credentials"
                    );
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        }

        async confirmDeleteTenant() {
            const confirmationInput =
                document.getElementById("deleteConfirmation");
            const confirmation = confirmationInput?.value;

            if (confirmation !== "DELETE") {
                CasaConnect.NotificationManager.error(
                    "Please type DELETE to confirm"
                );
                return;
            }

            if (!tenantModalState.selectedTenantId) return;

            try {
                const response = await CasaConnect.APIClient.delete(
                    `/api/manager/tenant/${tenantModalState.selectedTenantId}`
                );

                if (response.success) {
                    CasaConnect.NotificationManager.success(
                        "Tenant deleted successfully"
                    );
                    this.closeDeleteTenantModal();
                    setTimeout(() => {
                        if (window.location.pathname.includes("/tenant/")) {
                            window.location.href = "/manager/tenants";
                        } else {
                            location.reload();
                        }
                    }, 1500);
                } else {
                    throw new Error(
                        response.error || "Failed to delete tenant"
                    );
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        }

        // === HELPER METHODS ===
        viewTenant(tenantId) {
            window.location.href = `/manager/tenant/${tenantId}`;
        }

        editTenant(tenantId) {
            window.location.href = `/manager/tenant/${tenantId}/edit`;
        }
    }

    // === SINGLETON PATTERN - PUT THIS AFTER THE CLASS ===
    let instance = null;

    function getInstance() {
        if (!instance) {
            instance = new TenantModalManager();
        }
        return instance;
    }

    // Expose global functions that auto-initialize if needed
    window.openAddTenantModal = () => getInstance().openAddTenantModal();
    window.sendCredentials = (tenantId) =>
        getInstance().openSendCredentialsModal(tenantId);
    window.assignUnitToTenant = (tenantId) =>
        getInstance().openAssignUnitModal(tenantId);
    window.deleteTenant = (tenantId) =>
        getInstance().openDeleteTenantModal(tenantId);

    window.closeAddTenantModal = () => getInstance().closeAddTenantModal();
    window.closeSendCredentialsModal = () =>
        getInstance().closeSendCredentialsModal();
    window.closeAssignUnitModal = () => getInstance().closeAssignUnitModal();
    window.closeDeleteTenantModal = () =>
        getInstance().closeDeleteTenantModal();

    window.generatePassword = () => getInstance().generatePassword();
    window.generateNewPassword = () => getInstance().generateNewPassword();
    window.confirmSendCredentials = () =>
        getInstance().confirmSendCredentials();
    window.confirmDeleteTenant = () => getInstance().confirmDeleteTenant();

    window.viewTenant = (tenantId) => getInstance().viewTenant(tenantId);
    window.editTenant = (tenantId) => getInstance().editTenant(tenantId);

    CasaConnect.ready(() => {
        getInstance();
    });
})();
