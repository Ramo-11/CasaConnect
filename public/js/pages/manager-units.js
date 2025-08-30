// Units Page Specific JavaScript

CasaConnect.ready(() => {
    UnitsPageManager.init();
});

const UnitsPageManager = {
    currentView: 'grid',

    init() {
        this.loadViewPreference();
        this.initializeAutoRefresh();
        this.initializeGoogleMaps();
    },

    loadViewPreference() {
        const savedView = CasaConnect.StorageHelper.get('unitsViewPreference');
        if (savedView) {
            this.setView(savedView);
        }
    },

    setView(view) {
        this.currentView = view;
        const display = document.getElementById('unitsDisplay');
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        
        toggleBtns.forEach(btn => btn.classList.remove('active'));
        
        if (view === 'grid') {
            display.className = 'units-grid-view';
            toggleBtns[0]?.classList.add('active');
        } else {
            display.className = 'units-list-view';
            toggleBtns[1]?.classList.add('active');
        }
        
        CasaConnect.StorageHelper.set('unitsViewPreference', view);
    },

    filterUnits() {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const buildingFilter = document.getElementById('buildingFilter')?.value || 'all';
        const bedroomFilter = document.getElementById('bedroomFilter')?.value || 'all';
        const searchTerm = document.getElementById('unitSearch')?.value.toLowerCase() || '';
        
        const unitCards = document.querySelectorAll('.unit-card-full');
        let visibleCount = 0;
        
        unitCards.forEach(card => {
            const status = card.getAttribute('data-status');
            const building = card.getAttribute('data-building') || '';
            const bedrooms = card.getAttribute('data-bedrooms');
            const unitNumber = card.getAttribute('data-unit-number').toLowerCase();
            
            let show = true;
            
            if (statusFilter !== 'all' && status !== statusFilter) show = false;
            if (buildingFilter !== 'all' && building !== buildingFilter) show = false;
            if (bedroomFilter !== 'all' && bedrooms !== bedroomFilter) show = false;
            if (searchTerm && !unitNumber.includes(searchTerm)) show = false;
            
            card.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });
        
        this.handleEmptyState(visibleCount, unitCards.length);
    },

    handleEmptyState(visibleCount, totalCount) {
        const existingNoResults = document.querySelector('.no-results');
        
        if (visibleCount === 0 && totalCount > 0) {
            if (!existingNoResults) {
                const noResults = document.createElement('div');
                noResults.className = 'empty-state no-results';
                noResults.innerHTML = `
                    <i class="fas fa-search"></i>
                    <h3>No units match your filters</h3>
                    <p>Try adjusting your search criteria</p>
                `;
                document.getElementById('unitsDisplay').appendChild(noResults);
            }
        } else if (existingNoResults) {
            existingNoResults.remove();
        }
    },

    initializeAutoRefresh() {
        setInterval(async () => {
            try {
                const response = await CasaConnect.APIClient.get('/api/manager/units/stats');
                if (response.success) {
                    console.log('Unit stats updated:', response.data);
                }
            } catch (error) {
                console.error('Failed to update unit stats:', error);
            }
        }, 120000); // Every 2 minutes
    },

    initializeGoogleMaps() {
        if (window.google?.maps) {
            window.initAddressAutocomplete?.();
        }
    }
};

// Global functions for onclick handlers
window.setView = (view) => UnitsPageManager.setView(view);
window.filterUnits = () => UnitsPageManager.filterUnits();
window.viewTenant = (tenantId) => {
    window.location.href = `/manager/tenant/${tenantId}`;
};