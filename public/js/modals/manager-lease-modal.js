// Lease Modal Manager - Handles all lease-related modals
(function () {
    "use strict";

    class LeaseModalManager {
        constructor() {
            this.selectedTenantId = null;
            this.selectedUnitId = null;
            this.initializeModals();
        }

        initializeModals() {
            this.initializeFormHandlers();
        }

        initializeFormHandlers() {
            const createLeaseForm = document.getElementById("createLeaseForm");
            if (createLeaseForm && !createLeaseForm.dataset.initialized) {
                createLeaseForm.dataset.initialized = "true";
                createLeaseForm.addEventListener("submit", this.handleCreateLease.bind(this));
            }
        }

        openCreateLeaseModal(tenantId = null, unitId = null) {
            console.log(`Opening create lease modal for Tenant ID: ${tenantId}, Unit ID: ${unitId}`);
            const form = document.getElementById("createLeaseForm");
            const tenantSelect = document.getElementById("leaseTenant");
            const unitSelect = document.getElementById("leaseUnit");
            
            // Reset form
            if (form) form.reset();
            
            // Set default dates
            const today = new Date();
            const nextYear = new Date(today);
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            
            const startDateInput = document.getElementById("leaseStartDate");
            const endDateInput = document.getElementById("leaseEndDate");
            
            if (startDateInput) {
                startDateInput.value = today.toISOString().split("T")[0];
            }
            if (endDateInput) {
                endDateInput.value = nextYear.toISOString().split("T")[0];
            }
            
            // Handle pre-selection
            if (tenantId && tenantSelect) {
                tenantSelect.value = tenantId;
                // Lock the field if pre-selected
                tenantSelect.setAttribute('readonly', true);
                this.selectedTenantId = tenantId;
            } else if (tenantSelect) {
                tenantSelect.removeAttribute('readonly');
                this.selectedTenantId = null;
            }
            
            if (unitId && unitSelect) {
                unitSelect.value = unitId;
                // Lock the field if pre-selected
                unitSelect.setAttribute('readonly', true);
                this.selectedUnitId = unitId;
                
                // Auto-populate rent amount if unit is selected
                this.populateRentFromUnit(unitId);
            } else if (unitSelect) {
                unitSelect.removeAttribute('readonly');
                this.selectedUnitId = null;
            }
            
            CasaConnect.ModalManager.openModal("createLeaseModal");
        }

        closeCreateLeaseModal() {
            const tenantSelect = document.getElementById("leaseTenant");
            const unitSelect = document.getElementById("leaseUnit");
            
            // Remove readonly attributes
            if (tenantSelect) tenantSelect.removeAttribute('readonly');
            if (unitSelect) unitSelect.removeAttribute('readonly');
            
            this.selectedTenantId = null;
            this.selectedUnitId = null;
            
            CasaConnect.ModalManager.closeModal("createLeaseModal");
        }

        handleUnitChange(unitId) {
            console.log(`Unit selected: ${unitId}`);
            if (!unitId) return;
            
            // Get the selected option
            const unitSelect = document.getElementById("leaseUnit");
            const selectedOption = unitSelect.options[unitSelect.selectedIndex];
            
            // Auto-populate rent from data attribute
            const rent = selectedOption.getAttribute('data-rent');
            if (rent) {
                const rentInput = document.getElementById("leaseMonthlyRent");
                const depositInput = document.getElementById("leaseSecurityDeposit");
                
                if (rentInput) rentInput.value = rent;
                if (depositInput && !depositInput.value) {
                    depositInput.value = rent; // Default security deposit to monthly rent
                }
            }
        }

        handleTenantChange(tenantId) {
            // Can be used for future enhancements like showing tenant info
            console.log('Tenant selected:', tenantId);
        }

        async populateRentFromUnit(unitId) {
            try {
                const response = await CasaConnect.APIClient.get(`/api/manager/units/${unitId}`);
                if (response.success && response.data) {
                    const rentInput = document.getElementById("leaseMonthlyRent");
                    if (rentInput) {
                        rentInput.value = response.data.monthlyRent || '';
                    }
                }
            } catch (error) {
                console.error("Failed to fetch unit data:", error);
            }
        }

        async handleCreateLease(e) {
            e.preventDefault();
            const form = e.target;
            
            if (window.FormManager && !FormManager.validateForm(form)) {
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, true, 'Creating...');
            }

            try {
                // Use FormData to handle file upload
                const formData = new FormData(form);
                const response = await CasaConnect.APIClient.post('/api/manager/lease/create', formData);
                
                if (response.success) {
                    CasaConnect.NotificationManager.success('Lease created successfully!');
                    this.closeCreateLeaseModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to create lease');
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                if (window.FormManager) {
                    FormManager.setSubmitButtonLoading(submitBtn, false);
                }
            }
        }
    }

    // Singleton pattern
    let instance = null;
    
    function getInstance() {
        if (!instance) {
            instance = new LeaseModalManager();
        }
        return instance;
    }
    
    // Expose global functions
    window.openCreateLeaseModal = (tenantId, unitId) => getInstance().openCreateLeaseModal(tenantId, unitId);
    window.closeCreateLeaseModal = () => getInstance().closeCreateLeaseModal();

    window.LeaseModalManager = {
        handleUnitChange: (unitId) => getInstance().handleUnitChange(unitId),
        handleTenantChange: (tenantId) => getInstance().handleTenantChange(tenantId)
    };
    
    // Initialize on ready
    CasaConnect.ready(() => {
        getInstance();
    });
})();