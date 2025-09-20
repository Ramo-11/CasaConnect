// Tenants Page Specific JavaScript

// Initialize tenants page
CasaConnect.ready(() => {
    TenantsPageManager.init();
});

const TenantsPageManager = {
    currentView: 'grid',

    init() {
        this.loadViewPreference();
        this.initializeAutoRefresh();
        this.initializeKeyboardShortcuts();
    },

    loadViewPreference() {
        const savedView = CasaConnect.StorageHelper.get('tenantsViewPreference');
        if (savedView) {
            this.setView(savedView);
        }
    },

    setView(view) {
        this.currentView = view;
        const display = document.getElementById('tenantsDisplay');
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        
        toggleBtns.forEach(btn => btn.classList.remove('active'));
        
        if (view === 'grid') {
            display.className = 'tenants-grid-view';
            toggleBtns[0]?.classList.add('active');
            
            // Clean up any list-specific modifications
            document.querySelectorAll('.payment-status-column').forEach(col => col.remove());
            document.querySelectorAll('.no-unit-placeholder').forEach(ph => ph.remove());
            document.querySelectorAll('.payment-status').forEach(ps => ps.style.display = '');
        } else {
            display.className = 'tenants-list-view';
            toggleBtns[1]?.classList.add('active');
            
            // Reorganize content for list view
            document.querySelectorAll('.tenant-card-full').forEach(card => {
                const body = card.querySelector('.tenant-card-body');
                if (body) {
                    // Check if already reorganized
                    if (body.querySelector('.payment-status-column')) return;
                    
                    const unitBox = body.querySelector('.unit-info-box');
                    const lastLogin = body.querySelector('.last-login');
                    
                    // Create payment/status column
                    const paymentColumn = document.createElement('div');
                    paymentColumn.className = 'payment-status-column';
                    
                    if (unitBox) {
                        const paymentStatus = unitBox.querySelector('.payment-status');
                        if (paymentStatus) {
                            paymentColumn.appendChild(paymentStatus.cloneNode(true));
                            paymentStatus.style.display = 'none';
                        }
                    }
                    
                    if (lastLogin) {
                        paymentColumn.appendChild(lastLogin.cloneNode(true));
                    }
                    
                    body.appendChild(paymentColumn);
                    
                    // Create no unit placeholder if needed
                    if (!unitBox) {
                        const infoGrid = body.querySelector('.tenant-info-grid');
                        const noUnitItem = infoGrid?.querySelector('.no-unit');
                        
                        if (noUnitItem) {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'no-unit-placeholder';
                            placeholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No Active Lease';
                            
                            // Insert before payment column
                            body.insertBefore(placeholder, paymentColumn);
                        }
                    }
                }
            });
        }
        
        CasaConnect.StorageHelper.set('tenantsViewPreference', view);
    },

    filterTenants() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const unitStatusFilter = document.getElementById('unitStatusFilter')?.value || 'all';
        const paymentFilter = document.getElementById('paymentFilter')?.value || 'all';
        const searchTerm = document.getElementById('tenantSearch')?.value.toLowerCase() || '';
        
        const tenantCards = document.querySelectorAll('.tenant-card-full');
        let visibleCount = 0;
        
        tenantCards.forEach(card => {
            const status = card.getAttribute('data-status');
            const unitStatus = card.getAttribute('data-unit-status');
            const paymentStatus = card.getAttribute('data-payment-status');
            const name = card.getAttribute('data-name').toLowerCase();
            const email = card.getAttribute('data-email').toLowerCase();
            
            let show = true;
            
            if (statusFilter !== 'all' && status !== statusFilter) show = false;
            if (unitStatusFilter !== 'all' && unitStatus !== unitStatusFilter) show = false;
            if (paymentFilter !== 'all' && paymentStatus !== paymentFilter) show = false;
            if (searchTerm && !name.includes(searchTerm) && !email.includes(searchTerm)) show = false;
            
            card.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });
        
        this.handleEmptyState(visibleCount, tenantCards.length);
    },

    handleEmptyState(visibleCount, totalCount) {
        const existingNoResults = document.querySelector('.no-results');
        
        if (visibleCount === 0 && totalCount > 0) {
            if (!existingNoResults) {
                const noResults = document.createElement('div');
                noResults.className = 'empty-state no-results';
                noResults.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>No tenants match your filters</h3>
                    <p>Try adjusting your search criteria</p>
                `;
                document.getElementById('tenantsDisplay').appendChild(noResults);
            }
        } else if (existingNoResults) {
            existingNoResults.remove();
        }
    },

    initializeAutoRefresh() {
        setInterval(async () => {
            try {
                const response = await CasaConnect.APIClient.get('/api/manager/tenants/updates');
                if (response.success && response.data?.hasUpdates) {
                    CasaConnect.NotificationManager.info('New updates available. Refreshing...');
                    setTimeout(() => location.reload(), 2000);
                }
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, 60000);
    },

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (window.openAddTenantModal) {
                    window.openAddTenantModal();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('tenantSearch')?.focus();
            }
        });
    }
};

// Global functions for onclick handlers
window.setView = (view) => TenantsPageManager.setView(view);
window.filterTenants = () => TenantsPageManager.filterTenants();

// View Lease function (specific to tenants page)
window.viewLease = (leaseId) => {
    window.location.href = `/manager/lease/${leaseId}`;
};