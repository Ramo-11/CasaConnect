// public/js/tenant/payment.js
// Payment processing module with Stripe integration for Card and ACH

const TenantPayment = {
    processing: false,
    
    init() {
        // Initialize Stripe
        if (window.Stripe && window.STRIPE_CONFIG?.publicKey) {
            this.stripe = Stripe(window.STRIPE_CONFIG.publicKey);
            this.elements = this.stripe.elements();
        }
        
        this.initializeFormValidation();
        this.loadSavedPaymentMethods();
    },
    
    initializeFormValidation() {
        const form = document.getElementById('confirmPaymentForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processPayment(e.target);
        });
    },
    
    async processPayment(form) {
        if (this.processing) return;
        this.processing = true;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // Show loading
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        submitBtn.disabled = true;
        
        try {
            // Get selected payment method
            const selectedMethod = form.querySelector('input[name="paymentMethodId"]:checked');
            if (!selectedMethod) {
                throw new Error('Please select a payment method');
            }
            
            // Get amount
            const amountElement = document.getElementById('paymentAmount');
            const amount = parseFloat(amountElement?.textContent || '0');
            
            if (amount <= 0) {
                throw new Error('Invalid payment amount');
            }
            
            // Process payment with saved method
            const response = await CasaConnect.APIClient.post('/api/tenant/payment/process', {
                paymentMethodId: selectedMethod.value,
                amount: amount
            });
            
            if (response.success) {
                CasaConnect.NotificationManager.success('Payment processed successfully!');
                this.closePaymentModal();
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(response.error || 'Payment failed');
            }
            
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        } finally {
            this.processing = false;
            if (btnText) btnText.style.display = 'inline-flex';
            if (btnLoading) btnLoading.style.display = 'none';
            submitBtn.disabled = false;
        }
    },
    
    async loadSavedPaymentMethods() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-methods');
            if (response.success && response.data.length > 0) {
                this.displaySavedMethods(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load payment methods:', error);
        }
    },
    
    displaySavedMethods(methods) {
        const container = document.getElementById('savedPaymentMethods');
        if (!container) return;

        if (methods.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.innerHTML = methods.map(method => `
            <div class="saved-method" data-method-id="${method._id}">
                <input type="radio" name="savedMethod" id="method-${method._id}" value="${method._id}">
                <label for="method-${method._id}">
                    <i class="fas fa-${method.type === 'card' ? 'credit-card' : 'university'}"></i>
                    <span>${method.displayName}</span>
                    <small>Ending in ${method.last4}</small>
                </label>
            </div>
        `).join('');
        
        container.style.display = 'block';
    },
    
    async openPaymentModal() {
        // First check if user has payment methods
        const response = await CasaConnect.APIClient.get('/api/tenant/payment-methods');
        
        const availableDiv = document.getElementById('paymentMethodsAvailable');
        const noMethodsDiv = document.getElementById('noPaymentMethodsAvailable');
        
        // Set the payment amount first
        const amountElement = document.querySelector('.amount-due .amount');
        if (amountElement) {
            document.getElementById('paymentAmount').textContent = amountElement.textContent.replace('$', '');
        }
        
        // Check if there are payment methods
        if (!response.success || !response.data.data || response.data.data.length === 0) {
            availableDiv.style.display = 'none';
            noMethodsDiv.style.display = 'block';
            CasaConnect.ModalManager.openModal('paymentModal');
            return;
        }
        
        availableDiv.style.display = 'block';
        noMethodsDiv.style.display = 'none';
        
        // Display saved methods
        this.displaySavedMethodsForPayment(response.data.data);
        
        CasaConnect.ModalManager.openModal('paymentModal');
    },

    displaySavedMethodsForPayment(methods) {
        const container = document.getElementById('savedPaymentMethods');
        
        container.innerHTML = methods.map((method, index) => `
            <label class="saved-method-option">
                <div class="method-display">
                    <i class="fas fa-${method.type === 'card' ? 'credit-card' : 'university'}"></i>
                    <span>${method.type === 'card' 
                        ? `${method.brand} •••• ${method.last4}` 
                        : `Bank •••• ${method.last4}`}</span>
                    <input type="radio" name="paymentMethodId" value="${method._id}" 
                    ${index === 0 || method.isDefault ? 'checked' : ''}>
                </div>
            </label>
        `).join('');
    },
    
    closePaymentModal() {
        CasaConnect.ModalManager.closeModal('paymentModal');
    },
    
    async refreshPaymentHistory() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-history');
            if (response.success) {
                this.updatePaymentTable(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh payment history:', error);
        }
    },
    
    updatePaymentTable(payments) {
        const tbody = document.querySelector('.payment-table tbody');
        if (!tbody || !payments.length) return;
        
        tbody.innerHTML = payments.map(payment => `
            <tr data-type="${payment.type}">
                <td>${payment.date}</td>
                <td>
                    <span class="type-badge type-${payment.type}">
                        ${payment.typeLabel}
                    </span>
                </td>
                <td>$${payment.amount.toFixed(2)}</td>
                <td>${payment.method}</td>
                <td>
                    <span class="status-badge status-${payment.status}">
                        ${payment.status}
                    </span>
                </td>
                <td>
                    ${payment.status === 'completed' 
                        ? `<a href="/receipt/${payment.id}" class="btn-link" target="_blank">View</a>`
                        : '-'
                    }
                </td>
            </tr>
        `).join('');
    }
};

// Global exports
window.TenantPayment = TenantPayment;
window.openPaymentModal = () => TenantPayment.openPaymentModal();
window.closePaymentModal = () => TenantPayment.closePaymentModal();