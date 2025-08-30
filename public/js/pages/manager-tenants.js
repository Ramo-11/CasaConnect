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
        } else {
            display.className = 'tenants-list-view';
            toggleBtns[1]?.classList.add('active');
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