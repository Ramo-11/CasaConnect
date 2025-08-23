// Units Management JavaScript

let currentView = 'grid';
let selectedUnitId = null;

// Initialize units page
CasaConnect.ready(() => {
  initializeAddUnitForm();
  initializeEditUnitForm();
  initializeStatusChange();
});

// Add Unit Modal
function openAddUnitModal() {
  CasaConnect.ModalManager.openModal('addUnitModal');
}

function closeAddUnitModal() {
  CasaConnect.ModalManager.closeModal('addUnitModal');
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
        building: formData.get('building'),
        floor: parseInt(formData.get('floor')),
        bedrooms: parseInt(formData.get('bedrooms')),
        bathrooms: parseFloat(formData.get('bathrooms')),
        squareFeet: parseInt(formData.get('squareFeet')),
        monthlyRent: parseFloat(formData.get('monthlyRent')),
        status: formData.get('status'),
        amenities: amenities
      };
      
      try {
        const response = await CasaConnect.APIClient.post('/api/manager/units', unitData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Unit added successfully!');
          closeAddUnitModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to add unit');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
        
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
  CasaConnect.ModalManager.openModal('editUnitModal');
  
  // Load unit data into form
  loadUnitDataForEdit(unitId);
}

function closeEditUnitModal() {
  CasaConnect.ModalManager.closeModal('editUnitModal');
  selectedUnitId = null;
}

async function loadUnitDataForEdit(unitId) {
  try {
    const response = await CasaConnect.APIClient.get(`/api/manager/units/${unitId}`);
    if (response.success) {
      populateEditForm(response.data);
    }
  } catch (error) {
    CasaConnect.NotificationManager.error('Failed to load unit data');
  }
}

function populateEditForm(unitData) {
  // Populate the edit form with unit data
  const form = document.getElementById('editUnitForm');
  if (!form) return;
  
  // Clone the add form structure for edit
  form.innerHTML = document.getElementById('addUnitForm').innerHTML;
  
  // Populate fields
  form.querySelector('[name="unitNumber"]').value = unitData.unitNumber;
  form.querySelector('[name="building"]').value = unitData.building;
  form.querySelector('[name="floor"]').value = unitData.floor;
  form.querySelector('[name="bedrooms"]').value = unitData.bedrooms;
  form.querySelector('[name="bathrooms"]').value = unitData.bathrooms;
  form.querySelector('[name="squareFeet"]').value = unitData.squareFeet;
  form.querySelector('[name="monthlyRent"]').value = unitData.monthlyRent;
  form.querySelector('[name="status"]').value = unitData.status;
  
  // Check amenities
  if (unitData.amenities) {
    unitData.amenities.forEach(amenity => {
      const checkbox = form.querySelector(`[name="amenities"][value="${amenity}"]`);
      if (checkbox) checkbox.checked = true;
    });
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
        amenities: amenities
      };
      
      try {
        const response = await CasaConnect.APIClient.put(`/api/manager/units/${selectedUnitId}`, unitData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Unit updated successfully!');
          closeEditUnitModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to update unit');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
        
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
    const response = await CasaConnect.APIClient.delete(`/api/manager/units/${unitId}`);
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Unit deleted successfully');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error(response.error || 'Failed to delete unit');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Assign Tenant to Unit
function assignTenant(unitId) {
  openAddTenantModal();
  // Pre-select the unit
  setTimeout(() => {
    const unitSelect = document.getElementById('unitId');
    if (unitSelect) unitSelect.value = unitId;
  }, 100);
}

// View Tenant from Unit
function viewTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}`;
}

async function removeTenant(unitId) {
  if (!confirm('Remove tenant from this unit and mark as available?')) return;
  
  try {
    const response = await CasaConnect.APIClient.put(`/api/manager/units/${unitId}`, {
      status: 'available',
      currentTenant: null
    });
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Tenant removed successfully');
      setTimeout(() => location.reload(), 1500);
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Filter Units
function filterUnits() {
  const statusFilter = document.getElementById('statusFilter').value;
  const buildingFilter = document.getElementById('buildingFilter').value;
  const bedroomFilter = document.getElementById('bedroomFilter').value;
  const searchTerm = document.getElementById('unitSearch').value.toLowerCase();
  
  const unitCards = document.querySelectorAll('.unit-card-full');
  
  unitCards.forEach(card => {
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
  
  toggleBtns.forEach(btn => {
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
  CasaConnect.StorageHelper.set('unitsViewPreference', view);
}

// Load view preference
CasaConnect.ready(() => {
  const savedView = CasaConnect.StorageHelper.get('unitsViewPreference');
  if (savedView) {
    setView(savedView);
  }
});

// Quick Stats Update
async function updateUnitStats() {
  try {
    const response = await CasaConnect.APIClient.get('/api/manager/units/stats');
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