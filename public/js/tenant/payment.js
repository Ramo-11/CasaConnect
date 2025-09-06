// public/js/tenant/payment.js
// Payment processing module with Stripe integration for Card and ACH

const TenantPayment = {
    stripe: null,
    elements: null,
    cardElement: null,
    currentPaymentMethod: 'card',
    processing: false,
    
    init() {
        // Initialize Stripe
        if (window.Stripe && window.STRIPE_CONFIG?.publicKey) {
            this.stripe = Stripe(window.STRIPE_CONFIG.publicKey);
            this.elements = this.stripe.elements();
            this.setupStripeElements();
        }
        
        this.initializePaymentMethods();
        this.initializeFormValidation();
        this.loadSavedPaymentMethods();
    },
    
    setupStripeElements() {
        // Card element styling
        const style = {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        };
        
        // Create card element
        this.cardElement = this.elements.create('card', { style });
        
        // Mount card element when modal opens
        document.addEventListener('modalOpened', (e) => {
            if (e.detail.modalId === 'paymentModal') {
                this.mountStripeElements();
            }
        });
    },
    
    mountStripeElements() {
        const cardContainer = document.getElementById('stripe-card-element');
        if (cardContainer && this.cardElement) {
            this.cardElement.mount('#stripe-card-element');
            
            // Listen for errors
            this.cardElement.on('change', (event) => {
                const displayError = document.getElementById('card-errors');
                if (displayError) {
                    displayError.textContent = event.error ? event.error.message : '';
                }
            });
        }
    },
    
    initializePaymentMethods() {
        const methodCards = document.querySelectorAll('.payment-method');
        const achFields = document.getElementById('achFields');
        const cardFields = document.getElementById('cardFields');
        
        methodCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove active from all
                methodCards.forEach(m => m.classList.remove('active'));
                card.classList.add('active');
                
                // Get method type
                const input = card.querySelector('input[type="radio"]');
                if (input) {
                    input.checked = true;
                    this.currentPaymentMethod = input.value;
                    
                    // Toggle fields
                    if (this.currentPaymentMethod === 'ach') {
                        achFields.style.display = 'block';
                        cardFields.style.display = 'none';
                    } else {
                        achFields.style.display = 'none';
                        cardFields.style.display = 'block';
                        this.mountStripeElements();
                    }
                }
            });
        });
    },
    
    initializeFormValidation() {
        const form = document.getElementById('paymentForm');
        if (!form) return;
        
        // ACH field formatting
        const routingInput = document.getElementById('routingNumber');
        if (routingInput) {
            routingInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
            });
            
            routingInput.addEventListener('blur', () => {
                this.validateRoutingNumber(routingInput.value);
            });
        }
        
        const accountInput = document.getElementById('accountNumber');
        if (accountInput) {
            accountInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 17);
            });
        }
        
        // Form submission
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
            // Get amount from the form
            const amountElement = document.querySelector('.amount-due .amount');
            const amount = parseFloat(amountElement?.textContent.replace('$', '') || '0');
            
            if (amount <= 0) {
                throw new Error('Invalid payment amount');
            }
            
            let paymentIntentData;
            
            if (this.currentPaymentMethod === 'card') {
                paymentIntentData = await this.processCardPayment(amount);
            } else {
                paymentIntentData = await this.processACHPayment(form, amount);
            }
            
            if (paymentIntentData.success) {
                CasaConnect.NotificationManager.success('Payment processed successfully!');
                this.closePaymentModal();
                
                // Reload after delay
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error(paymentIntentData.error || 'Payment failed');
            }
            
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        } finally {
            this.processing = false;
            btnText.style.display = 'inline-flex';
            btnLoading.style.display = 'none';
            submitBtn.disabled = false;
        }
    },
    
    async processCardPayment(amount) {
        try {
            // Step 1: Create payment intent on server
            const intentResponse = await CasaConnect.APIClient.post('/api/tenant/payment/create-intent', {
                amount,
                paymentMethod: 'card'
            });
            
            if (!intentResponse.success) {
                throw new Error(intentResponse.message || 'Failed to create payment intent');
            }
            
            // Step 2: Confirm payment with Stripe
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(
                intentResponse.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: document.getElementById('cardholderName')?.value || '',
                            address: {
                                postal_code: document.getElementById('billingZip')?.value || ''
                            }
                        }
                    }
                }
            );
            
            if (error) {
                throw new Error(error.message);
            }
            
            // Step 3: Confirm payment on server
            const confirmResponse = await CasaConnect.APIClient.post('/api/tenant/payment/confirm', {
                paymentIntentId: paymentIntent.id
            });
            
            return confirmResponse;
            
        } catch (error) {
            console.error('Card payment error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async processACHPayment(form, amount) {
        try {
            const formData = new FormData(form);
            
            // Step 1: Create payment intent for ACH
            const intentResponse = await CasaConnect.APIClient.post('/api/tenant/payment/create-intent', {
                amount,
                paymentMethod: 'ach',
                accountType: formData.get('accountType'),
                routingNumber: formData.get('routingNumber'),
                accountNumber: formData.get('accountNumber'),
                accountHolder: formData.get('accountHolder')
            });
            
            if (!intentResponse.success) {
                throw new Error(intentResponse.message || 'Failed to create ACH payment');
            }
            
            // Step 2: For ACH, we typically need to verify micro-deposits
            // This is a simplified flow - in production you'd handle verification
            if (intentResponse.requiresVerification) {
                CasaConnect.NotificationManager.info(
                    'ACH payment initiated. You will receive micro-deposits for verification within 1-2 business days.'
                );
                return { success: true, pendingVerification: true };
            }
            
            // Step 3: Confirm payment if no verification needed (saved method)
            const confirmResponse = await CasaConnect.APIClient.post('/api/tenant/payment/confirm', {
                paymentIntentId: intentResponse.paymentIntentId
            });
            
            return confirmResponse;
            
        } catch (error) {
            console.error('ACH payment error:', error);
            return { success: false, error: error.message };
        }
    },
    
    validateRoutingNumber(routing) {
        if (!routing || routing.length !== 9) {
            this.showFieldError('routingNumber', 'Routing number must be 9 digits');
            return false;
        }
        
        // Basic checksum validation for US routing numbers
        const digits = routing.split('').map(Number);
        const checksum = (3 * (digits[0] + digits[3] + digits[6]) +
                         7 * (digits[1] + digits[4] + digits[7]) +
                         (digits[2] + digits[5] + digits[8])) % 10;
        
        if (checksum !== 0) {
            this.showFieldError('routingNumber', 'Invalid routing number');
            return false;
        }
        
        this.clearFieldError('routingNumber');
        return true;
    },
    
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
            
            // Remove existing error
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) existingError.remove();
            
            // Add new error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            formGroup.appendChild(errorDiv);
        }
    },
    
    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
            const error = formGroup.querySelector('.error-message');
            if (error) error.remove();
        }
    },
    
    async loadSavedPaymentMethods() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-methods');
            if (response.success && response.data.length > 0) {
                this.displaySavedMethods(response.data);
            }
        } catch (error) {
            console.error('Failed to load payment methods:', error);
        }
    },
    
    displaySavedMethods(methods) {
        const container = document.getElementById('savedPaymentMethods');
        if (!container) return;
        
        container.innerHTML = methods.map(method => `
            <div class="saved-method" data-method-id="${method.id}">
                <input type="radio" name="savedMethod" id="method-${method.id}" value="${method.id}">
                <label for="method-${method.id}">
                    <i class="fas fa-${method.type === 'card' ? 'credit-card' : 'university'}"></i>
                    <span>${method.displayName}</span>
                    <small>Ending in ${method.last4}</small>
                </label>
            </div>
        `).join('');
        
        container.style.display = 'block';
    },
    
    openPaymentModal() {
        // Check if payment is allowed
        const payButton = document.querySelector('.btn-pay-now');
        if (payButton?.disabled) {
            CasaConnect.NotificationManager.error('Payment is currently not available. Please contact management.');
            return;
        }
        
        CasaConnect.ModalManager.openModal('paymentModal');
        
        // Trigger mount event
        document.dispatchEvent(new CustomEvent('modalOpened', { 
            detail: { modalId: 'paymentModal' } 
        }));
    },
    
    closePaymentModal() {
        CasaConnect.ModalManager.closeModal('paymentModal');
        
        // Clear Stripe elements
        if (this.cardElement) {
            this.cardElement.clear();
        }
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