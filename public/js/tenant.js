// Tenant Dashboard JavaScript - Modular Approach

// Initialize when DOM is ready
CasaConnect.ready(() => {
    TenantDashboard.init();
});

// Main Dashboard Manager
const TenantDashboard = {
    currentTab: 'overview',
    paymentInfo: null,
    
    init() {
        this.initializeTabs();
        this.initializePaymentHandlers();
        this.initializeServiceRequestHandlers();
        this.loadPaymentStatus();
        this.initializeFilters();
        this.checkUrgentNotifications();
    },
    
    // Tab Management
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanes = document.querySelectorAll('.tab-pane');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
        
        // Handle tab links
        document.querySelectorAll('[data-tab-target]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = link.getAttribute('data-tab-target');
                this.switchTab(targetTab);
            });
        });
    },
    
    switchTab(targetTab) {
        this.currentTab = targetTab;
        
        // Update buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            if (button.getAttribute('data-tab') === targetTab) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.id === targetTab) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
        
        // Save preference
        CasaConnect.StorageHelper.set('tenantLastTab', targetTab);
    },
    
    // Add this function for logout handling
    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                const response = await fetch('/logout', {
                    method: 'GET',
                    credentials: 'same-origin'
                });
                
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/login';
            }
        }
    },

    // Payment Status Check
    async loadPaymentStatus() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-status');
            if (response.success) {
                this.paymentInfo = response.data;
                this.updatePaymentDisplay(response.data);
            }
        } catch (error) {
            console.error('Failed to load payment status:', error);
        }
    },
    
    updatePaymentDisplay(paymentInfo) {
        // Update payment status card if needed
        if (paymentInfo.urgent) {
            this.showUrgentPaymentNotice();
        }
    },
    
    showUrgentPaymentNotice() {
        if (this.paymentInfo && this.paymentInfo.daysOverdue > 5) {
            CasaConnect.NotificationManager.warning(
                'Your rent payment is overdue. Please contact management immediately.',
                10000 // Show for 10 seconds
            );
        }
    },
    
    // Check for urgent notifications
    checkUrgentNotifications() {
        const paymentCard = document.querySelector('.payment-status-card');
        if (paymentCard && paymentCard.classList.contains('danger')) {
            const daysOverdue = parseInt(paymentCard.getAttribute('data-days-overdue') || '0');
            
            if (daysOverdue > 5) {
                CasaConnect.NotificationManager.error(
                    'URGENT: Your rent payment is overdue. Please contact management immediately.',
                    true // Persistent
                );
            } else if (daysOverdue > 0) {
                CasaConnect.NotificationManager.warning(
                    'Reminder: Your rent payment is due. Pay by the 5th to avoid late fees.',
                    true // Persistent
                );
            }
        }
    }
};

// Payment Modal Manager
const PaymentModal = {
    init() {
        this.initializePaymentMethods();
        this.initializeFormValidation();
    },
    
    open() {
        CasaConnect.ModalManager.openModal('paymentModal');
    },
    
    close() {
        CasaConnect.ModalManager.closeModal('paymentModal');
    },
    
    initializePaymentMethods() {
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        const achFields = document.getElementById('achFields');
        const cardFields = document.getElementById('cardFields');
        
        paymentMethods.forEach(method => {
            method.addEventListener('change', () => {
                if (method.value === 'ach') {
                    achFields.style.display = 'block';
                    cardFields.style.display = 'none';
                } else {
                    achFields.style.display = 'none';
                    cardFields.style.display = 'block';
                }
            });
        });
    },
    
    initializeFormValidation() {
        const form = document.getElementById('paymentForm');
        if (!form) return;
        
        // Format card expiry
        const expiryInput = document.getElementById('expiry');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                CasaConnect.FormUtils.formatExpiry(e.target);
            });
        }
        
        // Format card number
        const cardNumberInput = document.getElementById('cardNumber');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', (e) => {
                CasaConnect.FormUtils.formatCardNumber(e.target);
            });
        }
        
        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processPayment(e);
        });
    },
    
    async processPayment(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        CasaConnect.LoadingManager.show(submitBtn, 'Processing...');
        
        try {
            const formData = new FormData(form);
            const response = await CasaConnect.APIClient.post('/tenant/payment', formData);
            
            if (response.success) {
                CasaConnect.NotificationManager.success('Payment processed successfully!');
                this.close();
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Payment failed');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
            CasaConnect.LoadingManager.hide(submitBtn);
        }
    }
};

// Service Request Modal Manager
const ServiceRequestModal = {
    init() {
        this.initializeFormHandlers();
        this.initializePaymentFields();
    },
    
    open() {
        CasaConnect.ModalManager.openModal('serviceRequestModal');
    },
    
    close() {
        CasaConnect.ModalManager.closeModal('serviceRequestModal');
    },
    
    initializeFormHandlers() {
        const form = document.getElementById('serviceRequestForm');
        if (!form) return;
        
        // Priority change handler
        const prioritySelect = document.getElementById('requestPriority');
        if (prioritySelect) {
            prioritySelect.addEventListener('change', (e) => {
                if (e.target.value === 'emergency') {
                    CasaConnect.NotificationManager.warning(
                        'For true emergencies, please call maintenance directly at (555) 123-4567'
                    );
                }
            });
        }
        
        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitRequest(e);
        });
    },
    
    initializePaymentFields() {
        // Format service card expiry
        const serviceExpiry = document.getElementById('serviceExpiry');
        if (serviceExpiry) {
            serviceExpiry.addEventListener('input', (e) => {
                CasaConnect.FormUtils.formatExpiry(e.target);
            });
        }
        
        // Format service card number
        const serviceCardNumber = document.getElementById('serviceCardNumber');
        if (serviceCardNumber) {
            serviceCardNumber.addEventListener('input', (e) => {
                CasaConnect.FormUtils.formatCardNumber(e.target);
            });
        }
    },
    
    async submitRequest(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        // Validate form
        const category = document.getElementById('requestCategory').value;
        const title = document.getElementById('requestTitle').value;
        const description = document.getElementById('requestDescription').value;
        
        if (!category || !title || !description) {
            CasaConnect.NotificationManager.error('Please fill in all required fields');
            return;
        }
        
        CasaConnect.LoadingManager.show(submitBtn, 'Processing Payment...');
        
        try {
            const formData = new FormData(form);
            const response = await CasaConnect.APIClient.post('/tenant/service-request', formData);
            
            if (response.success) {
                CasaConnect.NotificationManager.success('Service request submitted successfully!');
                this.close();
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Submission failed');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
            CasaConnect.LoadingManager.hide(submitBtn);
        }
    }
};

// Notes Toggle Handler
const NotesManager = {
    toggleNotes(requestId) {
        const notesDiv = document.getElementById(`notes-${requestId}`);
        if (notesDiv) {
            const isHidden = notesDiv.style.display === 'none';
            notesDiv.style.display = isHidden ? 'block' : 'none';
            
            // Update button text
            const toggleBtn = notesDiv.previousElementSibling;
            if (toggleBtn && toggleBtn.classList.contains('btn-link')) {
                const noteCount = notesDiv.querySelectorAll('.note-item').length;
                toggleBtn.innerHTML = isHidden 
                    ? `Hide Updates (${noteCount})` 
                    : `View Updates (${noteCount})`;
            }
        }
    }
};

// Filter Manager
const FilterManager = {
    init() {
        this.initializePaymentFilter();
        this.initializeRequestFilter();
    },
    
    initializePaymentFilter() {
        const paymentFilter = document.getElementById('payment-filter');
        if (paymentFilter) {
            paymentFilter.addEventListener('change', (e) => {
                this.filterPayments(e.target.value);
            });
        }
    },
    
    filterPayments(filterValue) {
        const rows = document.querySelectorAll('.payment-table tbody tr');
        
        rows.forEach(row => {
            if (filterValue === 'all' || row.getAttribute('data-type') === filterValue) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
        
        // Show no results message if needed
        const visibleRows = document.querySelectorAll('.payment-table tbody tr:not([style*="display: none"])');
        this.handleEmptyState(visibleRows.length, 'payment-table');
    },
    
    initializeRequestFilter() {
        // Add filter for service requests if needed
    },
    
    handleEmptyState(visibleCount, tableClass) {
        const table = document.querySelector(`.${tableClass}`);
        if (!table) return;
        
        let emptyRow = table.querySelector('.empty-row');
        
        if (visibleCount === 0) {
            if (!emptyRow) {
                const tbody = table.querySelector('tbody');
                const colCount = table.querySelectorAll('thead th').length;
                emptyRow = document.createElement('tr');
                emptyRow.className = 'empty-row';
                emptyRow.innerHTML = `<td colspan="${colCount}" class="no-data">No records found</td>`;
                tbody.appendChild(emptyRow);
            }
        } else if (emptyRow) {
            emptyRow.remove();
        }
    }
};

// Auto-refresh Manager
const AutoRefresh = {
    init() {
        this.startPaymentStatusRefresh();
        this.checkForMaintenanceAlerts();
    },
    
    startPaymentStatusRefresh() {
        // Refresh payment status every hour
        setInterval(async () => {
            await TenantDashboard.loadPaymentStatus();
        }, 3600000); // 1 hour
    },
    
    checkForMaintenanceAlerts() {
        // Check for new maintenance alerts every 5 minutes
        setInterval(async () => {
            try {
                const response = await CasaConnect.APIClient.get('/api/tenant/notifications');
                if (response.success && response.data.length > 0) {
                    response.data.forEach(notification => {
                        if (notification.priority === 'high') {
                            CasaConnect.NotificationManager.warning(notification.message);
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to check notifications:', error);
            }
        }, 300000); // 5 minutes
    }
};

// Initialize Payment Handlers
CasaConnect.ready(() => {
    TenantDashboard.initializePaymentHandlers = function() {
        PaymentModal.init();
        ServiceRequestModal.init();
        FilterManager.init();
        AutoRefresh.init();
    };
    
    TenantDashboard.initializeServiceRequestHandlers = function() {
        // Already handled in ServiceRequestModal.init()
    };
    
    document.querySelectorAll('.progress-fill[data-progress]').forEach(bar => {
        const progress = bar.getAttribute('data-progress');
        bar.style.width = progress + '%';
    });
    
    TenantDashboard.initializeFilters = function() {
        FilterManager.init();
    };
});

// Global function exports for onclick handlers
window.openPaymentModal = () => PaymentModal.open();
window.closePaymentModal = () => PaymentModal.close();
window.openServiceRequestModal = () => ServiceRequestModal.open();
window.closeServiceRequestModal = () => ServiceRequestModal.close();
window.toggleNotes = (requestId) => NotesManager.toggleNotes(requestId);
window.handleLogout = () => TenantDashboard.handleLogout();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Ctrl/Cmd + P for payment
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        const payBtn = document.querySelector('.btn-pay-now');
        if (payBtn && !payBtn.disabled) {
            PaymentModal.open();
        }
    }
    
    // Ctrl/Cmd + S for service request
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        ServiceRequestModal.open();
    }
});