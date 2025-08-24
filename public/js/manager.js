// Manager Dashboard JavaScript

let selectedTenantId = null;

// Initialize manager dashboard
CasaConnect.ready(() => {
  initializeTenantSearch();
  initializeAddTenantForm();
  initializePasswordGenerator();
});

// Tenant Search
function initializeTenantSearch() {
  const searchInput = document.getElementById('tenantSearch');
  if (searchInput) {
    searchInput.addEventListener('input', CasaConnect.debounce((e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#tenantsTableBody tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    }, 300));
  }
}

// View Tenant
function viewTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}`;
}

// Edit Tenant
function editTenant(tenantId) {
  window.location.href = `/manager/tenant/${tenantId}/edit`;
}

// Assign Unit
function assignUnit(unitId) {
  // Open add tenant modal with unit pre-selected
  openAddTenantModal();
  
  // Wait for modal to open then select unit
  setTimeout(() => {
    const unitSelect = document.getElementById('unitId');
    if (unitSelect) {
      unitSelect.value = unitId;
    }
  }, 100);
}

// Auto-refresh dashboard data
function autoRefreshDashboard() {
  setInterval(async () => {
    try {
      const response = await CasaConnect.APIClient.get('/manager/dashboard-stats');
      if (response.success) {
        updateDashboardStats(response.data);
      }
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }, 60000); // Refresh every minute
}

function updateDashboardStats(data) {
  // Update stat cards
  document.querySelectorAll('.stat-value').forEach((el, index) => {
    const values = [data.totalUnits, data.occupiedUnits, data.availableUnits, data.activeRequests];
    if (values[index] !== undefined) {
      el.textContent = values[index];
    }
  });
}

// Initialize auto-refresh
autoRefreshDashboard();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + N for new tenant
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    openAddTenantModal();
  }
  
  // Ctrl/Cmd + F for search focus
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.getElementById('tenantSearch');
    if (searchInput) {
      searchInput.focus();
    }
  }
});