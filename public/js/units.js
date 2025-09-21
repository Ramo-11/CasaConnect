// Units Management JavaScript

let currentView = 'grid';
let selectedUnitId = null;

// Initialize Google Places Autocomplete
window.initAddressAutocomplete = function () {
    // Initialize for Add Unit form
    const addAddressInput = document.getElementById('streetAddress');
    if (addAddressInput) {
        setupAutocomplete(addAddressInput, 'add');
    }
};

function setupAutocomplete(input, formType) {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.error('Google Maps Places API not loaded');
        return;
    }

    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
    });

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();

        if (!place.address_components) {
            console.warn('No address components found');
            return;
        }

        let streetNumber = '';
        let route = '';
        let city = '';
        let state = '';
        let zipCode = '';

        place.address_components.forEach((component) => {
            const types = component.types;

            if (types.includes('street_number')) {
                streetNumber = component.long_name;
            }
            if (types.includes('route')) {
                route = component.long_name;
            }
            if (types.includes('locality')) {
                city = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
                state = component.short_name;
            }
            if (types.includes('postal_code')) {
                zipCode = component.long_name;
            }
        });

        // Determine which form we're working with
        const form =
            formType === 'edit'
                ? document.getElementById('editUnitForm')
                : document.getElementById('addUnitForm');

        if (form) {
            // Update the street address field
            input.value = `${streetNumber} ${route}`.trim();

            // Update other fields
            const cityInput = form.querySelector('input[name="city"]');
            const stateInput = form.querySelector('input[name="state"]');
            const zipInput = form.querySelector('input[name="zipCode"]');

            if (cityInput) cityInput.value = city;
            if (stateInput) stateInput.value = state;
            if (zipInput) zipInput.value = zipCode;
        }
    });

    // Prevent form submission on Enter key in autocomplete
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && document.querySelector('.pac-container')) {
            e.preventDefault();
        }
    });
}

// Initialize when document is ready - update your PM.ready function
PM.ready(() => {
    // Wait for Google Maps to load
    if (window.google && window.google.maps) {
        initAddressAutocomplete();
    } else if (window.GOOGLE_API_KEY) {
        // If Google Maps hasn't loaded yet, wait for the callback
    }

    // Initialize edit form autocomplete when modal opens
    const editModal = document.getElementById('editUnitModal');
    if (editModal) {
        const observer = new MutationObserver((mutations) => {
            const editAddressInput = document.querySelector(
                '#editUnitForm input[name="streetAddress"]'
            );
            if (
                editAddressInput &&
                !editAddressInput.hasAttribute('data-autocomplete-initialized')
            ) {
                setupAutocomplete(editAddressInput, 'edit');
                editAddressInput.setAttribute('data-autocomplete-initialized', 'true');
            }
        });

        observer.observe(editModal, { childList: true, subtree: true });
    }

    // Rest of your initialization code...
    initializeAddUnitForm();
    initializeEditUnitForm();
    initializeStatusChange();
    initializeAssignTenantForm();
});

// Add Unit Modal
function openAddUnitModal() {
    PM.ModalManager.openModal('addUnitModal');
}

function closeAddUnitModal() {
    PM.ModalManager.closeModal('addUnitModal');
    document.getElementById('addUnitForm').reset();
}

// Initialize Add Unit Form
function initializeAddUnitForm() {
    const form = document.getElementById('addUnitForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            // Show loading state
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;

            // Get form data
            const formData = new FormData(form);
            const amenities = formData.getAll('amenities');

            const unitData = {
                unitNumber: formData.get('unitNumber'),
                propertyType: formData.get('propertyType'),
                streetAddress: formData.get('streetAddress'),
                city: formData.get('city'),
                state: formData.get('state'),
                zipCode: formData.get('zipCode'),
                bedrooms: parseInt(formData.get('bedrooms')),
                bathrooms: parseFloat(formData.get('bathrooms')),
                squareFeet: parseInt(formData.get('squareFeet')),
                monthlyRent: parseFloat(formData.get('monthlyRent')),
                status: formData.get('status'),
                amenities: amenities,
            };

            // Add optional fields only if they have values
            const building = formData.get('building');
            const floor = formData.get('floor');

            if (building && building.trim() !== '') {
                unitData.building = building;
            }
            if (floor && floor !== '') {
                unitData.floor = parseInt(floor);
            }

            try {
                const response = await PM.APIClient.post('/api/manager/units', unitData);

                if (response.success) {
                    PM.NotificationManager.success('Unit added successfully!');
                    closeAddUnitModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to add unit');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);

                // Reset button
                btnText.style.display = 'inline-flex';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }
}

// Edit Unit Modal
function editUnit(unitId) {
    selectedUnitId = unitId;

    // Get unit data from the card
    const unitCard = document.querySelector(`[data-unit-id="${unitId}"]`);
    if (!unitCard) return;

    // Populate edit form with current data
    // In production, fetch fresh data from server
    PM.ModalManager.openModal('editUnitModal');

    // Load unit data into form
    loadUnitDataForEdit(unitId);
}

function closeEditUnitModal() {
    PM.ModalManager.closeModal('editUnitModal');
    selectedUnitId = null;
}

async function loadUnitDataForEdit(unitId) {
    try {
        const response = await PM.APIClient.get(`/api/manager/units/${unitId}`);
        if (response.success) {
            populateEditForm(response.data);
        }
    } catch (error) {
        PM.NotificationManager.error('Failed to load unit data');
    }
}

function populateEditForm(unitData) {
    const form = document.getElementById('editUnitForm');
    if (!form) return;

    // Clone the add form structure for edit
    form.innerHTML = document.getElementById('addUnitForm').innerHTML;

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

    // Wait for DOM to update
    setTimeout(() => {
        // Populate fields
        if (form.querySelector('[name="unitNumber"]')) {
            form.querySelector('[name="unitNumber"]').value = unitData.unitNumber || '';
        }
        if (form.querySelector('[name="propertyType"]')) {
            form.querySelector('[name="propertyType"]').value = unitData.propertyType || '';
        }
        if (form.querySelector('[name="building"]')) {
            form.querySelector('[name="building"]').value = unitData.building || '';
        }
        if (form.querySelector('[name="floor"]')) {
            form.querySelector('[name="floor"]').value = unitData.floor || '';
        }
        if (form.querySelector('[name="streetAddress"]')) {
            const streetInput = form.querySelector('[name="streetAddress"]');
            streetInput.value = unitData.streetAddress || '';
            // Re-initialize autocomplete for edit form
            if (
                window.google &&
                window.google.maps &&
                !streetInput.hasAttribute('data-autocomplete-initialized')
            ) {
                setupAutocomplete(streetInput, 'edit');
                streetInput.setAttribute('data-autocomplete-initialized', 'true');
            }
        }
        if (form.querySelector('[name="city"]')) {
            form.querySelector('[name="city"]').value = unitData.city || '';
        }
        if (form.querySelector('[name="state"]')) {
            form.querySelector('[name="state"]').value = unitData.state || '';
        }
        if (form.querySelector('[name="zipCode"]')) {
            form.querySelector('[name="zipCode"]').value = unitData.zipCode || '';
        }
        if (form.querySelector('[name="bedrooms"]')) {
            form.querySelector('[name="bedrooms"]').value = unitData.bedrooms || '';
        }
        if (form.querySelector('[name="bathrooms"]')) {
            form.querySelector('[name="bathrooms"]').value = unitData.bathrooms || '';
        }
        if (form.querySelector('[name="squareFeet"]')) {
            form.querySelector('[name="squareFeet"]').value = unitData.squareFeet || '';
        }
        if (form.querySelector('[name="monthlyRent"]')) {
            form.querySelector('[name="monthlyRent"]').value = unitData.monthlyRent || '';
        }
        if (form.querySelector('[name="status"]')) {
            form.querySelector('[name="status"]').value = unitData.status || '';
        }

        // Check amenities
        if (unitData.amenities) {
            unitData.amenities.forEach((amenity) => {
                const checkbox = form.querySelector(`[name="amenities"][value="${amenity}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Show/hide building and floor based on property type
        togglePropertyFieldsInForm(form, unitData.propertyType);
    }, 100);
}

function togglePropertyFields() {
    const propertyType = document.getElementById('propertyType').value;
    const buildingFloorRow = document.getElementById('buildingFloorRow');

    if (propertyType === 'apartment' || propertyType === 'condo' || propertyType === 'studio') {
        buildingFloorRow.style.display = 'flex';
    } else {
        buildingFloorRow.style.display = 'none';
        document.getElementById('building').value = '';
        document.getElementById('floor').value = '';
    }
}

function togglePropertyFieldsInForm(form, propertyType) {
    const buildingFloorRow = form.querySelector('#buildingFloorRow');
    if (buildingFloorRow) {
        if (propertyType === 'apartment' || propertyType === 'condo' || propertyType === 'studio') {
            buildingFloorRow.style.display = 'flex';
        } else {
            buildingFloorRow.style.display = 'none';
        }
    }
}

function initializeEditUnitForm() {
    const form = document.getElementById('editUnitForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!selectedUnitId) return;

            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            // Show loading state
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;

            const formData = new FormData(form);
            const amenities = formData.getAll('amenities');

            const unitData = {
                unitNumber: formData.get('unitNumber'),
                building: formData.get('building'),
                floor: parseInt(formData.get('floor')),
                bedrooms: parseInt(formData.get('bedrooms')),
                bathrooms: parseFloat(formData.get('bathrooms')),
                squareFeet: parseInt(formData.get('squareFeet')),
                monthlyRent: parseFloat(formData.get('monthlyRent')),
                status: formData.get('status'),
                amenities: amenities,
            };

            try {
                const response = await PM.APIClient.put(
                    `/api/manager/units/${selectedUnitId}`,
                    unitData
                );

                if (response.success) {
                    PM.NotificationManager.success('Unit updated successfully!');
                    closeEditUnitModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to update unit');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);

                // Reset button
                btnText.style.display = 'inline-flex';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }
}

function initializeStatusChange() {
    const statusSelect = document.getElementById('status');
    const tenantGroup = document.getElementById('tenantSelectGroup');
    const tenantSelect = document.getElementById('currentTenant');

    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            if (e.target.value === 'occupied') {
                tenantGroup.style.display = 'block';
                tenantSelect.required = true;
            } else {
                tenantGroup.style.display = 'none';
                tenantSelect.required = false;
                tenantSelect.value = '';
            }
        });
    }
}

function initializeAssignTenantForm() {
    const form = document.getElementById('assignTenantForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = PM.FormUtils.serializeForm(form);

            try {
                const response = await PM.APIClient.post(
                    '/api/manager/unit/assign-tenant',
                    formData
                );

                if (response.success) {
                    PM.NotificationManager.success('Tenant assigned successfully!');
                    closeAssignTenantModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    throw new Error(response.error || 'Failed to assign tenant');
                }
            } catch (error) {
                PM.NotificationManager.error(error.message);
            }
        });
    }
}

// View Unit Details
function viewUnit(unitId) {
    window.location.href = `/manager/units/${unitId}`;
}

// Delete Unit
async function deleteUnit(unitId) {
    if (!confirm('Are you sure you want to delete this unit? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await PM.APIClient.delete(`/api/manager/units/${unitId}`);

        if (response.success) {
            PM.NotificationManager.success('Unit deleted successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to delete unit');
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// Assign Tenant to Unit
function assignTenant(unitId) {
    selectedUnitId = unitId;

    // Get unit data from the card
    const unitCard = document.querySelector(`[data-unit-id="${unitId}"]`);
    if (unitCard) {
        const unitNumber = unitCard.querySelector('h3').textContent;
        const unitDetails = unitCard.querySelector('.unit-info-grid').textContent;

        document.getElementById('assignUnitId').value = unitId;
        document.getElementById('assignUnitNumber').textContent = unitNumber;
        document.getElementById('assignUnitDetails').textContent = 'Available for assignment';
    }

    PM.ModalManager.openModal('assignTenantModal');
}

function closeAssignTenantModal() {
    PM.ModalManager.closeModal('assignTenantModal');
    document.getElementById('assignTenantForm').reset();
    selectedUnitId = null;
}

// View Tenant from Unit
function viewTenant(tenantId) {
    window.location.href = `/manager/tenant/${tenantId}`;
}

async function removeTenant(unitId) {
    if (!confirm('Remove tenant from this unit and mark as available?')) return;

    try {
        const response = await PM.APIClient.put(`/api/manager/units/${unitId}`, {
            status: 'available',
            currentTenant: null,
        });

        if (response.success) {
            PM.NotificationManager.success('Tenant removed successfully');
            setTimeout(() => location.reload(), 1500);
        }
    } catch (error) {
        PM.NotificationManager.error(error.message);
    }
}

// Filter Units
function filterUnits() {
    const statusFilter = document.getElementById('statusFilter').value;
    const buildingFilter = document.getElementById('buildingFilter').value;
    const bedroomFilter = document.getElementById('bedroomFilter').value;
    const searchTerm = document.getElementById('unitSearch').value.toLowerCase();

    const unitCards = document.querySelectorAll('.unit-card-full');

    unitCards.forEach((card) => {
        const status = card.getAttribute('data-status');
        const building = card.getAttribute('data-building');
        const bedrooms = card.getAttribute('data-bedrooms');
        const unitNumber = card.getAttribute('data-unit-number').toLowerCase();

        let show = true;

        if (statusFilter !== 'all' && status !== statusFilter) show = false;
        if (buildingFilter !== 'all' && building !== buildingFilter) show = false;
        if (bedroomFilter !== 'all' && bedrooms !== bedroomFilter) show = false;
        if (searchTerm && !unitNumber.includes(searchTerm)) show = false;

        card.style.display = show ? '' : 'none';
    });

    // Show empty state if no units visible
    const visibleUnits = document.querySelectorAll('.unit-card-full:not([style*="display: none"])');
    if (visibleUnits.length === 0 && unitCards.length > 0) {
        // Add no results message if not already present
        if (!document.querySelector('.no-results')) {
            const noResults = document.createElement('div');
            noResults.className = 'empty-state no-results';
            noResults.innerHTML = `
        <i class="icon-search-empty"></i>
        <h3>No units match your filters</h3>
        <p>Try adjusting your search criteria</p>
      `;
            document.getElementById('unitsDisplay').appendChild(noResults);
        }
    } else {
        // Remove no results message if present
        const noResults = document.querySelector('.no-results');
        if (noResults) noResults.remove();
    }
}

// Toggle View (Grid/List)
function setView(view) {
    currentView = view;
    const display = document.getElementById('unitsDisplay');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    toggleBtns.forEach((btn) => {
        btn.classList.remove('active');
    });

    if (view === 'grid') {
        display.className = 'units-grid-view';
        toggleBtns[0].classList.add('active');
    } else {
        display.className = 'units-list-view';
        toggleBtns[1].classList.add('active');
    }

    // Save preference
    PM.StorageHelper.set('unitsViewPreference', view);
}

// Load view preference
PM.ready(() => {
    const savedView = PM.StorageHelper.get('unitsViewPreference');
    if (savedView) {
        setView(savedView);
    }
});

// Quick Stats Update
async function updateUnitStats() {
    try {
        const response = await PM.APIClient.get('/api/manager/units/stats');
        if (response.success) {
            // Update any stats displays if present
            const stats = response.data;
            console.log('Unit stats updated:', stats);
        }
    } catch (error) {
        console.error('Failed to update unit stats:', error);
    }
}

// Auto-refresh stats every 2 minutes
setInterval(updateUnitStats, 120000);
