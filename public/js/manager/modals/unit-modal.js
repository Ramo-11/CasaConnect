// Unit Modal Manager - Handles all unit-related modals
(function () {
    "use strict";

    class UnitModalManager {
        constructor() {
            this.selectedUnitId = null;
            this.initializeModals();
        }

        initializeModals() {
            this.initializeFormHandlers();
            this.initializeEventListeners();
        }

        initializeFormHandlers() {
            // Add Unit Form
            const addUnitForm = document.getElementById("addUnitForm");
            if (addUnitForm && !addUnitForm.dataset.initialized) {
                addUnitForm.dataset.initialized = "true";
                addUnitForm.addEventListener("submit", this.handleAddUnit.bind(this));
            }

            // Edit Unit Form
            const editUnitForm = document.getElementById("editUnitForm");
            if (editUnitForm && !editUnitForm.dataset.initialized) {
                editUnitForm.dataset.initialized = "true";
                editUnitForm.addEventListener("submit", this.handleEditUnit.bind(this));
            }
        }

        initializeEventListeners() {
            // Property type change
            const propertyTypeSelect = document.getElementById("propertyType");
            if (propertyTypeSelect) {
                propertyTypeSelect.addEventListener("change", this.togglePropertyFields.bind(this));
            }
        }

        // === MODAL OPEN METHODS ===
        openAddUnitModal() {
            CasaConnect.ModalManager.openModal("addUnitModal");
            this.initializeGoogleAutocomplete('streetAddress');
        }

        openEditUnitModal(unitId) {
            this.selectedUnitId = unitId;
            this.loadUnitDataForEdit(unitId);
            CasaConnect.ModalManager.openModal("editUnitModal");
        }

        closeAddUnitModal() {
            CasaConnect.ModalManager.closeModal("addUnitModal");
            const form = document.getElementById("addUnitForm");
            if (form) form.reset();
        }

        closeEditUnitModal() {
            CasaConnect.ModalManager.closeModal("editUnitModal");
            this.selectedUnitId = null;
        }

        // === FORM HANDLERS ===
        async handleAddUnit(e) {
            e.preventDefault();
            const form = e.target;
            
            if (window.FormManager && !FormManager.validateForm(form)) {
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, true, 'Adding...');
            }

            try {
                const formData = new FormData(form);
                const unitData = this.prepareUnitData(formData);

                const response = await CasaConnect.APIClient.post("/api/manager/units", unitData);

                if (response.success) {
                    CasaConnect.NotificationManager.success("Unit added successfully!");
                    this.closeAddUnitModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || "Failed to add unit");
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                if (window.FormManager) {
                    FormManager.setSubmitButtonLoading(submitBtn, false);
                }
            }
        }

        async handleEditUnit(e) {
            e.preventDefault();
            if (!this.selectedUnitId) return;

            const form = e.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, true, 'Updating...');
            }

            try {
                const formData = new FormData(form);
                const unitData = this.prepareUnitData(formData);

                const response = await CasaConnect.APIClient.put(
                    `/api/manager/units/${this.selectedUnitId}`,
                    unitData
                );

                if (response.success) {
                    CasaConnect.NotificationManager.success("Unit updated successfully!");
                    this.closeEditUnitModal();
                    setTimeout(() => {
                        if (window.location.pathname.includes('/edit')) {
                            window.location.href = `/manager/units/${this.selectedUnitId}`;
                        } else {
                            location.reload();
                        }
                    }, 1500);
                } else {
                    throw new Error(response.error || "Failed to update unit");
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
                if (window.FormManager) {
                    FormManager.setSubmitButtonLoading(submitBtn, false);
                }
            }
        }

        // === HELPER METHODS ===
        prepareUnitData(formData) {
            const amenities = formData.getAll("amenities");
            
            const unitData = {
                unitNumber: formData.get("unitNumber"),
                propertyType: formData.get("propertyType"),
                streetAddress: formData.get("streetAddress"),
                city: formData.get("city"),
                state: formData.get("state"),
                zipCode: formData.get("zipCode"),
                bedrooms: parseInt(formData.get("bedrooms")),
                bathrooms: parseFloat(formData.get("bathrooms")),
                squareFeet: parseInt(formData.get("squareFeet")),
                monthlyRent: parseFloat(formData.get("monthlyRent")),
                amenities: amenities,
            };

            // Add optional fields
            const building = formData.get("building");
            const floor = formData.get("floor");
            if (building?.trim()) unitData.building = building;
            if (floor) unitData.floor = parseInt(floor);

            return unitData;
        }

        async loadUnitDataForEdit(unitId) {
            try {
                const response = await CasaConnect.APIClient.get(`/api/manager/units/${unitId}`);
                if (response.success) {
                    this.populateEditForm(response.data.data || response.data);
                }
            } catch (error) {
                CasaConnect.NotificationManager.error("Failed to load unit data");
            }
        }

        populateEditForm(unitData) {
            const form = document.getElementById("editUnitForm");
            if (!form) return;

            // Clone add form structure
            const addForm = document.getElementById("addUnitForm");
            if (addForm) {
                form.innerHTML = addForm.innerHTML;
                
                // Update button text
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.innerHTML = `
                        <span class="btn-text">Update Unit</span>
                        <span class="btn-loading" style="display: none;">
                            <span class="spinner"></span> Updating...
                        </span>
                    `;
                }
            }

            // Populate fields after DOM updates
            setTimeout(() => {
                Object.keys(unitData).forEach(key => {
                    const field = form.querySelector(`[name="${key}"]`);
                    if (field && key !== 'amenities') {
                        field.value = unitData[key] || '';
                    }
                });

                // Handle amenities
                if (unitData.amenities) {
                    unitData.amenities.forEach(amenity => {
                        const checkbox = form.querySelector(`[name="amenities"][value="${amenity}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }

                // Initialize Google autocomplete for edit form
                this.initializeGoogleAutocomplete('streetAddress', form);
                
                // Show/hide building fields
                this.togglePropertyFields(unitData.propertyType);
            }, 100);
        }

        togglePropertyFields(propertyTypeOrEvent) {
            const propertyType = typeof propertyTypeOrEvent === 'string' 
                ? propertyTypeOrEvent 
                : document.getElementById("propertyType")?.value;
                
            const buildingFloorRow = document.getElementById("buildingFloorRow");
            const editBuildingFloorRow = document.querySelector("#editUnitForm #buildingFloorRow");
            const targetRow = editBuildingFloorRow || buildingFloorRow;
            
            if (targetRow) {
                if (["apartment", "condo", "studio"].includes(propertyType)) {
                    targetRow.style.display = "flex";
                } else {
                    targetRow.style.display = "none";
                    const buildingInput = targetRow.querySelector('[name="building"]');
                    const floorInput = targetRow.querySelector('[name="floor"]');
                    if (buildingInput) buildingInput.value = "";
                    if (floorInput) floorInput.value = "";
                }
            }
        }

        initializeGoogleAutocomplete(fieldName, form = null) {
            if (!window.google?.maps?.places) return;
            
            const input = form 
                ? form.querySelector(`[name="${fieldName}"]`)
                : document.getElementById(fieldName);
                
            if (!input || input.hasAttribute('data-autocomplete-initialized')) return;
            
            const autocomplete = new google.maps.places.Autocomplete(input, {
                types: ['address'],
                componentRestrictions: { country: 'us' }
            });
            
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (!place.address_components) return;
                
                this.fillAddressFields(place, form || input.closest('form'));
            });
            
            input.setAttribute('data-autocomplete-initialized', 'true');
        }

        fillAddressFields(place, form) {
            if (!form) return;
            
            const components = {
                street_number: '',
                route: '',
                locality: '',
                administrative_area_level_1: '',
                postal_code: ''
            };
            
            place.address_components.forEach(component => {
                const types = component.types;
                if (types.includes('street_number')) components.street_number = component.long_name;
                if (types.includes('route')) components.route = component.long_name;
                if (types.includes('locality')) components.locality = component.long_name;
                if (types.includes('administrative_area_level_1')) components.administrative_area_level_1 = component.short_name;
                if (types.includes('postal_code')) components.postal_code = component.long_name;
            });
            
            const streetInput = form.querySelector('[name="streetAddress"]');
            const cityInput = form.querySelector('[name="city"]');
            const stateInput = form.querySelector('[name="state"]');
            const zipInput = form.querySelector('[name="zipCode"]');
            
            if (streetInput) streetInput.value = `${components.street_number} ${components.route}`.trim();
            if (cityInput) cityInput.value = components.locality;
            if (stateInput) stateInput.value = components.administrative_area_level_1;
            if (zipInput) zipInput.value = components.postal_code;
        }

        // Navigation methods
        viewUnit(unitId) {
            window.location.href = `/manager/units/${unitId}`;
        }

        editUnitPage(unitId) {
            window.location.href = `/manager/units/${unitId}/edit`;
        }

        async deleteUnit(unitId) {
            if (!confirm("Are you sure you want to delete this unit? This action cannot be undone.")) {
                return;
            }

            try {
                const response = await CasaConnect.APIClient.delete(`/api/manager/units/${unitId}`);
                
                if (response.success) {
                    CasaConnect.NotificationManager.success("Unit deleted successfully");
                    setTimeout(() => {
                        if (window.location.pathname.includes('/units/')) {
                            window.location.href = '/manager/units';
                        } else {
                            location.reload();
                        }
                    }, 1500);
                } else {
                    throw new Error(response.error || "Failed to delete unit");
                }
            } catch (error) {
                CasaConnect.NotificationManager.error(error.message);
            }
        }
    }

    // Singleton pattern
    let instance = null;
    
    function getInstance() {
        if (!instance) {
            instance = new UnitModalManager();
        }
        return instance;
    }
    
    // Expose global functions
    window.openAddUnitModal = () => getInstance().openAddUnitModal();
    window.closeAddUnitModal = () => getInstance().closeAddUnitModal();
    window.editUnit = (unitId) => getInstance().openEditUnitModal(unitId);
    window.editUnitPage = (unitId) => getInstance().editUnitPage(unitId);
    window.closeEditUnitModal = () => getInstance().closeEditUnitModal();
    window.viewUnit = (unitId) => getInstance().viewUnit(unitId);
    window.deleteUnit = (unitId) => getInstance().deleteUnit(unitId);
    window.togglePropertyFields = () => getInstance().togglePropertyFields();
    
    // Initialize on ready
    CasaConnect.ready(() => {
        getInstance();
    });
})();