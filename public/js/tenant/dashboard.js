// public/js/tenant/dashboard.js
// Main Dashboard Controller - Coordinates all tenant dashboard functionality

const TenantDashboard = {
    currentTab: 'payments',
    initialized: false,
    
    init() {
        if (this.initialized) return;
        
        this.initializeTabs();
        this.loadInitialData();
        this.setupEventListeners();
        this.checkUrgentNotifications();
        
        // Initialize other modules
        if (window.TenantPayment) TenantPayment.init();
        if (window.TenantServiceRequest) TenantServiceRequest.init();
        if (window.TenantNotifications) TenantNotifications.init();
        
        this.initialized = true;
    },
    
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
        
        // Restore last tab from storage
        const lastTab = CasaConnect.StorageHelper.get('tenantLastTab');
        if (lastTab) {
            this.switchTab(lastTab);
        }
    },
    
    switchTab(targetTab) {
        this.currentTab = targetTab;
        
        // Update buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === targetTab);
        });
        
        // Update panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === targetTab);
        });
        
        // Save preference
        CasaConnect.StorageHelper.set('tenantLastTab', targetTab);
        
        // Trigger tab-specific loading if needed
        this.onTabChange(targetTab);
    },
    
    onTabChange(tab) {
        switch(tab) {
            case 'payments':
                if (window.TenantPayment) TenantPayment.refreshPaymentHistory();
                break;
            case 'service':
                if (window.TenantServiceRequest) TenantServiceRequest.refreshRequests();
                break;
            case 'documents':
                this.loadDocuments();
                break;
        }
    },
    
    loadInitialData() {
        // Load payment status
        this.loadPaymentStatus();
        
        // Initialize progress bars
        document.querySelectorAll('.progress-fill[data-progress]').forEach(bar => {
            const progress = bar.getAttribute('data-progress');
            setTimeout(() => {
                bar.style.width = progress + '%';
            }, 100);
        });
    },
    
    async loadPaymentStatus() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-status');
            if (response.success) {
                this.updatePaymentDisplay(response.data);
            }
        } catch (error) {
            console.error('Failed to load payment status:', error);
        }
    },
    
    updatePaymentDisplay(paymentInfo) {
        // Update payment card UI based on status
        const statusCard = document.querySelector('.payment-status-card');
        if (!statusCard) return;
        
        if (paymentInfo.urgent) {
            statusCard.classList.add('urgent');
            this.showUrgentPaymentNotice();
        }
        
        // Update payment button state
        const payButton = document.querySelector('.btn-pay-now');
        if (payButton) {
            payButton.disabled = paymentInfo.daysOverdue > 10;
        }
    },
    
    showUrgentPaymentNotice() {
        const paymentCard = document.querySelector('.payment-status-card');
        const daysOverdue = parseInt(paymentCard?.getAttribute('data-days-overdue') || '0');
        
        if (daysOverdue > 5) {
            CasaConnect.NotificationManager.error(
                'URGENT: Your rent payment is overdue. Please contact management immediately.',
                true
            );
        }
    },
    
    checkUrgentNotifications() {
        const paymentCard = document.querySelector('.payment-status-card');
        if (paymentCard?.classList.contains('danger')) {
            const daysOverdue = parseInt(paymentCard.getAttribute('data-days-overdue') || '0');
            
            if (daysOverdue > 5) {
                CasaConnect.NotificationManager.error(
                    'Your rent payment is overdue. Please contact management.',
                    true
                );
            } else if (daysOverdue > 0) {
                CasaConnect.NotificationManager.warning(
                    'Reminder: Your rent payment is due. Pay by the 5th to avoid late fees.',
                    true
                );
            }
        }
    },
    
    setupEventListeners() {
        // Payment filter
        const paymentFilter = document.getElementById('payment-filter');
        if (paymentFilter) {
            paymentFilter.addEventListener('change', (e) => {
                this.filterPayments(e.target.value);
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                CasaConnect.ModalManager.closeAll();
            }
            
            // Ctrl/Cmd + P for payment
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                if (window.TenantPayment) TenantPayment.openPaymentModal();
            }
        });
    },
    
    filterPayments(filterValue) {
        const rows = document.querySelectorAll('.payment-table tbody tr');
        
        rows.forEach(row => {
            const shouldShow = filterValue === 'all' || row.getAttribute('data-type') === filterValue;
            row.style.display = shouldShow ? '' : 'none';
        });
        
        // Handle empty state
        const visibleRows = document.querySelectorAll('.payment-table tbody tr:not([style*="display: none"])');
        this.handleEmptyState(visibleRows.length === 0);
    },
    
    handleEmptyState(isEmpty) {
        const table = document.querySelector('.payment-table');
        if (!table) return;
        
        let emptyRow = table.querySelector('.empty-row');
        
        if (isEmpty && !emptyRow) {
            const tbody = table.querySelector('tbody');
            const colCount = table.querySelectorAll('thead th').length;
            emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-row';
            emptyRow.innerHTML = `<td colspan="${colCount}" class="no-data">No records found</td>`;
            tbody.appendChild(emptyRow);
        } else if (!isEmpty && emptyRow) {
            emptyRow.remove();
        }
    },
    
    async loadDocuments() {
        // Document loading logic if needed
        const container = document.getElementById('tenantDocumentsContainer');
        if (container && !container.dataset.loaded) {
            try {
                const response = await CasaConnect.APIClient.get('/api/tenant/documents');
                if (response.success) {
                    this.renderDocuments(response.data);
                    container.dataset.loaded = 'true';
                }
            } catch (error) {
                console.error('Failed to load documents:', error);
            }
        }
    },
    
    renderDocuments(documents) {
        const container = document.getElementById('tenantDocumentsContainer');
        if (!container) return;
        
        const otherDocs = documents.filter(doc => doc.type !== 'lease');
        
        if (otherDocs.length === 0) {
            container.innerHTML = '<p class="no-data">No additional documents</p>';
            return;
        }
        
        container.innerHTML = otherDocs.map(doc => `
            <div class="document-item">
                <div class="document-icon">
                    <i class="fas fa-file"></i>
                </div>
                <div class="document-info">
                    <h5>${doc.title}</h5>
                    <span class="document-meta">
                        ${doc.type} • ${doc.sizeFormatted} • ${doc.uploadDate}
                    </span>
                </div>
                <div class="document-actions">
                    <button class="btn-icon" onclick="DocumentManager.viewDocument('${doc.id}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="DocumentManager.downloadDocument('${doc.id}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    async handleLogout() {
        if (!confirm('Are you sure you want to logout?')) return;
        
        try {
            const response = await fetch('/logout', {
                method: 'GET',
                credentials: 'same-origin'
            });
            
            window.location.href = response.redirected ? response.url : '/login';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    }
};

// Initialize when ready
CasaConnect.ready(() => {
    TenantDashboard.init();
});

// Global exports
window.TenantDashboard = TenantDashboard;
window.handleLogout = () => TenantDashboard.handleLogout();
window.toggleNotes = (requestId) => {
    if (window.TenantServiceRequest) {
        TenantServiceRequest.toggleNotes(requestId);
    }
};