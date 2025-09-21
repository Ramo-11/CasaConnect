// Manager Dashboard JavaScript

let selectedTenantId = null;

// Initialize manager dashboard
PM.ready(() => {
    initializeTenantSearch();
});

// Tenant Search
function initializeTenantSearch() {
    const searchInput = document.getElementById('tenantSearch');
    if (searchInput) {
        searchInput.addEventListener(
            'input',
            PM.debounce((e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#tenantsTableBody tr');

                rows.forEach((row) => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            }, 300)
        );
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

// Auto-refresh dashboard data
function autoRefreshDashboard() {
    setInterval(async () => {
        try {
            const response = await PM.APIClient.get('/manager/dashboard-stats');
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
        const values = [
            data.totalUnits,
            data.occupiedUnits,
            data.availableUnits,
            data.activeRequests,
        ];
        if (values[index] !== undefined) {
            el.textContent = values[index];
        }
    });
}

async function updateApplicationStats() {
    try {
        const response = await PM.APIClient.get('/api/manager/application-stats');
        if (response.success) {
            const pendingCount = document.getElementById('pendingApplicationsCount');
            const approvedCount = document.getElementById('approvedTodayCount');

            if (pendingCount) pendingCount.textContent = response.data.pending || '0';
            if (approvedCount) approvedCount.textContent = response.data.approvedToday || '0';
        }
    } catch (error) {
        console.error('Failed to load application stats:', error);
    }
}

PM.ready(() => {
    updateApplicationStats();
});

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

// Payment Records Functions
function openPaymentRecordsModal() {
    const currentYear = new Date().getFullYear();
    document.getElementById('recordsYear').textContent = currentYear;
    loadPaymentRecords(currentYear);
    PM.ModalManager.openModal('paymentRecordsModal');
}

function closePaymentRecordsModal() {
    PM.ModalManager.closeModal('paymentRecordsModal');
}

async function loadPaymentRecords(year) {
    document.getElementById('recordsYear').textContent = year;
    const tbody = document.getElementById('paymentRecordsBody');
    tbody.innerHTML = '<tr><td colspan="17" class="text-center">Loading...</td></tr>';

    try {
        const response = await PM.APIClient.get(`/api/manager/payment-records?year=${year}`);

        if (response.success) {
            renderPaymentRecords(response.data.data.records);
        } else {
            tbody.innerHTML =
                '<tr><td colspan="17" class="text-center">Failed to load records</td></tr>';
        }
    } catch (error) {
        console.error('Failed to load payment records:', error);
        tbody.innerHTML =
            '<tr><td colspan="17" class="text-center">Error loading records</td></tr>';
    }
}

function renderPaymentRecords(records) {
    const tbody = document.getElementById('paymentRecordsBody');

    console.log('Rendering payment records:', records);
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="17" class="text-center">No records found</td></tr>';
        return;
    }

    let html = '';
    records.forEach((record) => {
        html += '<tr>';
        html += `<td>${record.unitNumber}</td>`;
        html += `<td>${record.tenantName}</td>`;
        html += `<td>${record.phone || '-'}</td>`;
        html += `<td>${record.email}</td>`;
        html += `<td>$${record.rentAmount}</td>`;

        for (let month = 1; month <= 12; month++) {
            const monthData = record.months[month];
            let cellContent = '';

            if (monthData.status === 'paid') {
                cellContent = '<span class="payment-box paid">PAID</span>';
            } else if (monthData.status === 'partial') {
                cellContent = `<span class="payment-box partial">$${monthData.remaining}</span>`;
            } else if (monthData.status === 'due') {
                cellContent = '<span class="payment-box due">DUE</span>';
            } else if (monthData.status === 'inactive') {
                cellContent = '<span class="payment-box inactive">N/A</span>';
            } else {
                cellContent = '<span>-</span>';
            }

            html += `<td>${cellContent}</td>`;
        }

        html += '</tr>';
    });

    tbody.innerHTML = html;
}

function exportPaymentRecords() {
    const year = document.getElementById('yearSelector').value;
    window.open(`/api/manager/payment-records/export?year=${year}`, '_blank');
}
