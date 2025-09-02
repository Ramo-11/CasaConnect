// Tenant Payment Management - Separate module for payment handling

const TenantPaymentManager = {
    currentPaymentMethod: 'ach',
    processingPayment: false,
    
    init() {
        this.initializePaymentUI();
        this.loadPaymentHistory();
        this.checkPaymentDue();
    },
    
    initializePaymentUI() {
        // Payment method selection
        const methodCards = document.querySelectorAll('.payment-method');
        methodCards.forEach(card => {
            card.addEventListener('click', () => {
                this.selectPaymentMethod(card);
            });
        });
        
        // Auto-format payment fields
        this.initializeFieldFormatting();
        
        // Payment form validation
        this.initializeValidation();
    },
    
    selectPaymentMethod(card) {
        // Remove active state from all
        document.querySelectorAll('.payment-method').forEach(m => {
            m.classList.remove('active');
        });
        
        // Add active state to selected
        card.classList.add('active');
        
        // Update payment method
        const input = card.querySelector('input[type="radio"]');
        if (input) {
            input.checked = true;
            this.currentPaymentMethod = input.value;
            this.togglePaymentFields(input.value);
        }
    },
    
    togglePaymentFields(method) {
        const achFields = document.getElementById('achFields');
        const cardFields = document.getElementById('cardFields');
        
        if (method === 'ach') {
            if (achFields) achFields.style.display = 'block';
            if (cardFields) cardFields.style.display = 'none';
            this.validateACHFields();
        } else {
            if (achFields) achFields.style.display = 'none';
            if (cardFields) cardFields.style.display = 'block';
            this.validateCardFields();
        }
    },
    
    initializeFieldFormatting() {
        // Routing number formatting (9 digits)
        const routingInput = document.getElementById('routingNumber');
        if (routingInput) {
            routingInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
            });
            
            routingInput.addEventListener('blur', () => {
                this.validateRoutingNumber(routingInput.value);
            });
        }
        
        // Account number formatting
        const accountInput = document.getElementById('accountNumber');
        if (accountInput) {
            accountInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 17);
            });
        }
        
        // Card number formatting with spaces
        const cardInput = document.getElementById('cardNumber');
        if (cardInput) {
            cardInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\s/g, '');
                let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
                e.target.value = formattedValue;
                this.detectCardType(value);
            });
        }
        
        // Expiry date formatting
        const expiryInput = document.getElementById('expiry');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 4);
                }
                e.target.value = value;
                this.validateExpiry(value);
            });
        }
        
        // CVV formatting
        const cvvInput = document.getElementById('cvv');
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
            });
        }
    },
    
    initializeValidation() {
        const paymentForm = document.getElementById('paymentForm');
        if (!paymentForm) return;
        
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (this.processingPayment) return;
            
            // Validate based on payment method
            let isValid = false;
            if (this.currentPaymentMethod === 'ach') {
                isValid = this.validateACHFields();
            } else {
                isValid = this.validateCardFields();
            }
            
            if (!isValid) {
                CasaConnect.NotificationManager.error('Please check your payment information');
                return;
            }
            
            await this.processPayment(e.target);
        });
    },
    
    validateACHFields() {
        const routing = document.getElementById('routingNumber').value;
        const account = document.getElementById('accountNumber').value;
        
        if (!routing || routing.length !== 9) {
            this.showFieldError('routingNumber', 'Routing number must be 9 digits');
            return false;
        }
        
        if (!account || account.length < 4) {
            this.showFieldError('accountNumber', 'Invalid account number');
            return false;
        }
        
        return true;
    },
    
    validateCardFields() {
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const expiry = document.getElementById('expiry').value;
        const cvv = document.getElementById('cvv').value;
        
        if (!this.validateCardNumber(cardNumber)) {
            this.showFieldError('cardNumber', 'Invalid card number');
            return false;
        }
        
        if (!this.validateExpiry(expiry)) {
            this.showFieldError('expiry', 'Invalid or expired date');
            return false;
        }
        
        if (cvv.length < 3) {
            this.showFieldError('cvv', 'Invalid CVV');
            return false;
        }
        
        return true;
    },
    
    validateCardNumber(number) {
        // Luhn algorithm validation
        if (number.length < 13 || number.length > 19) return false;
        
        let sum = 0;
        let isEven = false;
        
        for (let i = number.length - 1; i >= 0; i--) {
            let digit = parseInt(number[i]);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return sum % 10 === 0;
    },
    
    validateExpiry(expiry) {
        const parts = expiry.split('/');
        if (parts.length !== 2) return false;
        
        const month = parseInt(parts[0]);
        const year = parseInt('20' + parts[1]);
        
        if (month < 1 || month > 12) return false;
        
        const now = new Date();
        const expiryDate = new Date(year, month - 1);
        
        return expiryDate > now;
    },
    
    validateRoutingNumber(routing) {
        // Basic ABA routing number validation
        if (routing.length !== 9) return false;
        
        // Could add checksum validation here
        return true;
    },
    
    detectCardType(number) {
        const patterns = {
            visa: /^4/,
            mastercard: /^5[1-5]/,
            amex: /^3[47]/,
            discover: /^6(?:011|5)/
        };
        
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(number)) {
                this.updateCardTypeDisplay(type);
                return type;
            }
        }
        
        return 'unknown';
    },
    
    updateCardTypeDisplay(type) {
        // Update UI to show detected card type
        const cardIcon = document.querySelector('.card-type-icon');
        if (cardIcon) {
            cardIcon.className = `card-type-icon ${type}`;
        }
    },
    
    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
            
            // Remove existing error message
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) existingError.remove();
            
            // Add new error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            formGroup.appendChild(errorDiv);
            
            // Remove error on input
            field.addEventListener('input', () => {
                formGroup.classList.remove('error');
                errorDiv.remove();
            }, { once: true });
        }
    },
    
    async processPayment(form) {
        this.processingPayment = true;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Show processing state
        submitBtn.innerHTML = '<span class="spinner"></span> Processing Payment...';
        submitBtn.disabled = true;
        
        try {
            // Gather payment data
            const formData = new FormData(form);
            formData.append('paymentMethod', this.currentPaymentMethod);
            
            // Add payment amount
            const amountElement = document.querySelector('.amount-due .amount');
            if (amountElement) {
                const amount = parseFloat(amountElement.textContent.replace('$', ''));
                formData.append('amount', amount);
            }
            
            // Submit payment
            const response = await CasaConnect.APIClient.post('/tenant/payment', formData);
            
            if (response.success) {
                this.handlePaymentSuccess(response.data);
            } else {
                throw new Error(response.error || 'Payment failed');
            }
        } catch (error) {
            this.handlePaymentError(error);
        } finally {
            this.processingPayment = false;
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },
    
    handlePaymentSuccess(data) {
        // Close modal
        CasaConnect.ModalManager.closeModal('paymentModal');
        
        // Show success message
        CasaConnect.NotificationManager.success(
            `Payment of $${data.amount} processed successfully! Transaction ID: ${data.transactionId}`
        );
        
        // Update UI
        this.updatePaymentStatusUI();
        
        // Reload after delay
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    },
    
    handlePaymentError(error) {
        CasaConnect.NotificationManager.error(
            error.message || 'Payment failed. Please check your information and try again.'
        );
        
        // Log for debugging
        console.error('Payment error:', error);
    },
    
    updatePaymentStatusUI() {
        // Update payment status card
        const statusCard = document.querySelector('.payment-status-card');
        if (statusCard) {
            statusCard.classList.remove('warning', 'danger');
            statusCard.classList.add('success');
            
            const statusBadge = statusCard.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = 'Paid';
                statusBadge.className = 'status-badge success';
            }
            
            const cardBody = statusCard.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = `
                    <div class="payment-success">
                        <i class="fas fa-check-circle"></i>
                        <p>Payment received successfully!</p>
                        <p class="next-payment">Next payment due: ${this.getNextPaymentDate()}</p>
                    </div>
                `;
            }
        }
    },
    
    getNextPaymentDate() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
    },
    
    async loadPaymentHistory() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/payment-history');
            if (response.success) {
                this.renderPaymentHistory(response.data);
            }
        } catch (error) {
            console.error('Failed to load payment history:', error);
        }
    },
    
    renderPaymentHistory(payments) {
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
    },
    
    checkPaymentDue() {
        const paymentCard = document.querySelector('.payment-status-card');
        if (!paymentCard) return;
        
        const isDue = paymentCard.classList.contains('warning') || 
                     paymentCard.classList.contains('danger');
        
        if (isDue) {
            // Add visual indicator
            this.addPaymentReminder();
            
            // Check if overdue
            const daysOverdue = parseInt(paymentCard.getAttribute('data-days-overdue') || '0');
            if (daysOverdue > 0) {
                this.showOverdueWarning(daysOverdue);
            }
        }
    },
    
    addPaymentReminder() {
        const tabButton = document.querySelector('.tab-button[data-tab="payments"]');
        if (tabButton && !tabButton.querySelector('.badge')) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-warning';
            badge.textContent = '!';
            tabButton.appendChild(badge);
        }
    },
    
    showOverdueWarning(daysOverdue) {
        if (daysOverdue > 5) {
            // Show persistent warning for seriously overdue payments
            const warning = document.createElement('div');
            warning.className = 'overdue-banner';
            warning.innerHTML = `
                <div class="overdue-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Your rent is ${daysOverdue} days overdue. Please make payment immediately to avoid further action.</span>
                    <button class="btn btn-danger btn-small" onclick="openPaymentModal()">Pay Now</button>
                </div>
            `;
            
            // Insert at top of page
            const container = document.querySelector('.tenant-container');
            if (container && !document.querySelector('.overdue-banner')) {
                container.insertBefore(warning, container.firstChild);
            }
        }
    }
};

// Initialize on page load
CasaConnect.ready(() => {
    if (document.querySelector('.payment-status-card')) {
        TenantPaymentManager.init();
    }
});

// Export for global use
window.TenantPaymentManager = TenantPaymentManager;