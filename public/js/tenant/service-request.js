// public/js/tenant/service-request.js
// Service request management module

const TenantServiceRequest = {
    stripe: null,
    cardElement: null,
    processing: false,
    
    init() {
        // Initialize Stripe for service fee payment
        if (window.Stripe && window.STRIPE_CONFIG?.publicKey) {
            this.stripe = Stripe(window.STRIPE_CONFIG.publicKey);
            this.setupServicePayment();
        }
        
        this.initializeFormHandlers();
        this.loadRequestHistory();
    },
    
    setupServicePayment() {
        const elements = this.stripe.elements();
        
        const style = {
            base: {
                fontSize: '16px',
                color: '#32325d',
                '::placeholder': {
                    color: '#aab7c4'
                }
            }
        };
        
        this.cardElement = elements.create('card', { style });
    },
    
    initializeFormHandlers() {
        const form = document.getElementById('serviceRequestForm');
        if (!form) return;
        
        // Priority change handler
        const prioritySelect = document.getElementById('requestPriority');
        if (prioritySelect) {
            prioritySelect.addEventListener('change', (e) => {
                if (e.target.value === 'emergency') {
                    this.showEmergencyWarning();
                }
            });
        }
        
        // Category change handler
        const categorySelect = document.getElementById('requestCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.updateRequestTitle(e.target.value);
            });
        }
        
        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitRequest(e.target);
        });
    },
    
    showEmergencyWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert alert-warning mt-2';
        warningDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Emergency Notice:</strong> For true emergencies, please call maintenance directly at 
            <a href="tel:5551234567">(555) 123-4567</a>
        `;
        
        const priorityField = document.getElementById('requestPriority').closest('.form-group');
        const existingWarning = priorityField.querySelector('.alert-warning');
        
        if (!existingWarning) {
            priorityField.appendChild(warningDiv);
            setTimeout(() => warningDiv.remove(), 10000);
        }
    },
    
    updateRequestTitle(category) {
        const titleInput = document.getElementById('requestTitle');
        if (!titleInput || titleInput.value) return;
        
        const titleSuggestions = {
            electrical: 'Electrical Issue - ',
            plumbing: 'Plumbing Issue - ',
            hvac: 'HVAC/Temperature Issue - ',
            appliance: 'Appliance Repair - ',
            general_repair: 'General Repair - ',
            other: ''
        };
        
        titleInput.placeholder = titleSuggestions[category] + 'Brief description';
    },
    
    async submitRequest(form) {
        if (this.processing) return;
        this.processing = true;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // Validate required fields
        const requiredFields = ['requestCategory', 'requestTitle', 'requestDescription'];
        const missingFields = requiredFields.filter(id => !document.getElementById(id)?.value);
        
        if (missingFields.length > 0) {
            CasaConnect.NotificationManager.error('Please fill in all required fields');
            this.processing = false;
            return;
        }
        
        // Show loading
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        submitBtn.disabled = true;
        
        try {
            // Step 1: Process $10 service fee payment
            const paymentResult = await this.processServiceFee();
            
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || 'Payment failed');
            }
            
            // Step 2: Submit service request with payment confirmation
            const formData = new FormData(form);
            formData.append('paymentIntentId', paymentResult.paymentIntentId);
            
            const response = await CasaConnect.APIClient.post('/api/tenant/service-request', formData);
            
            if (response.success) {
                CasaConnect.NotificationManager.success('Service request submitted successfully!');
                this.closeServiceRequestModal();
                
                // Refresh the requests list
                setTimeout(() => {
                    this.refreshRequests();
                    location.reload();
                }, 1500);
            } else {
                throw new Error(response.error || 'Submission failed');
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
    
    async processServiceFee() {
        try {
            // Mount card element
            const cardContainer = document.getElementById('service-card-element');
            if (cardContainer && this.cardElement) {
                this.cardElement.mount('#service-card-element');
            }
            
            // Create payment intent for $10 service fee
            const intentResponse = await CasaConnect.APIClient.post('/api/tenant/service-fee/create-intent', {
                amount: 10,
                description: 'Service Request Fee'
            });
            
            if (!intentResponse.success) {
                throw new Error(intentResponse.message || 'Failed to create payment');
            }
            
            // Confirm payment with Stripe
            const { error, paymentIntent } = await this.stripe.confirmCardPayment(
                intentResponse.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: document.getElementById('serviceCardName')?.value || ''
                        }
                    }
                }
            );
            
            if (error) {
                throw new Error(error.message);
            }
            
            return {
                success: true,
                paymentIntentId: paymentIntent.id
            };
            
        } catch (error) {
            console.error('Service fee payment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    openServiceRequestModal() {
        CasaConnect.ModalManager.openModal('serviceRequestModal');
        
        // Mount Stripe element
        setTimeout(() => {
            const cardContainer = document.getElementById('service-card-element');
            if (cardContainer && this.cardElement) {
                this.cardElement.mount('#service-card-element');
            }
        }, 100);
    },
    
    closeServiceRequestModal() {
        CasaConnect.ModalManager.closeModal('serviceRequestModal');
        
        // Clear form
        const form = document.getElementById('serviceRequestForm');
        if (form) form.reset();
        
        // Clear Stripe element
        if (this.cardElement) {
            this.cardElement.clear();
        }
    },
    
    toggleNotes(requestId) {
        const notesDiv = document.getElementById(`notes-${requestId}`);
        if (!notesDiv) return;
        
        const isHidden = notesDiv.style.display === 'none';
        notesDiv.style.display = isHidden ? 'block' : 'none';
        
        // Update button text
        const toggleBtn = notesDiv.previousElementSibling;
        if (toggleBtn?.classList.contains('btn-link')) {
            const noteCount = notesDiv.querySelectorAll('.note-item').length;
            toggleBtn.innerHTML = isHidden 
                ? `Hide Updates (${noteCount})` 
                : `View Updates (${noteCount})`;
        }
    },
    
    async loadRequestHistory() {
        try {
            const response = await CasaConnect.APIClient.get('/api/tenant/service-requests');
            if (response.success) {
                this.updateRequestsDisplay(response.data);
            }
        } catch (error) {
            console.error('Failed to load service requests:', error);
        }
    },
    
    updateRequestsDisplay(requests) {
        const activeContainer = document.getElementById('activeRequestsContainer');
        const historyContainer = document.getElementById('requestHistoryContainer');
        
        if (!activeContainer && !historyContainer) return;
        
        const activeRequests = requests.filter(r => 
            ['pending', 'assigned', 'in_progress'].includes(r.status)
        );
        
        const completedRequests = requests.filter(r => r.status === 'completed');
        
        if (activeContainer) {
            this.renderActiveRequests(activeContainer, activeRequests);
        }
        
        if (historyContainer) {
            this.renderRequestHistory(historyContainer, completedRequests);
        }
    },
    
    renderActiveRequests(container, requests) {
        if (requests.length === 0) {
            container.innerHTML = '<p class="no-data">No active service requests</p>';
            return;
        }
        
        container.innerHTML = requests.map(request => `
            <div class="request-card">
                <div class="request-header">
                    <h4>${request.title}</h4>
                    <span class="status-badge status-${request.status}">
                        ${request.status.replace('_', ' ')}
                    </span>
                </div>
                <div class="request-meta">
                    <span class="meta-item">
                        <i class="fas fa-tag"></i> ${request.category}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-calendar"></i> ${request.date}
                    </span>
                    <span class="meta-item priority-${request.priority}">
                        <i class="fas fa-flag"></i> ${request.priority}
                    </span>
                </div>
                <p class="request-description">${request.description}</p>
                ${request.assignedTo ? `
                    <div class="assigned-info">
                        <i class="fas fa-user"></i> Assigned to: ${request.assignedTo}
                    </div>
                ` : ''}
                ${request.notes && request.notes.length > 0 ? `
                    <button class="btn-link" onclick="TenantServiceRequest.toggleNotes('${request.id}')">
                        View Updates (${request.notes.length})
                    </button>
                    <div id="notes-${request.id}" class="notes-list" style="display: none;">
                        ${request.notes.map(note => `
                            <div class="note-item">
                                <p>${note.content}</p>
                                <small>${note.date}</small>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    },
    
    renderRequestHistory(container, requests) {
        if (requests.length === 0) {
            container.innerHTML = '<p class="no-data">No completed requests</p>';
            return;
        }
        
        container.innerHTML = requests.map(request => `
            <div class="request-card completed">
                <div class="request-header">
                    <h4>${request.title}</h4>
                    <span class="completion-date">
                        Completed: ${request.completedDate}
                    </span>
                </div>
                <div class="request-meta">
                    <span class="meta-item">
                        <i class="fas fa-tag"></i> ${request.category}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-clock"></i> Resolved in ${request.resolutionTime}
                    </span>
                </div>
            </div>
        `).join('');
    },
    
    async refreshRequests() {
        await this.loadRequestHistory();
    }
};

// Global exports
window.TenantServiceRequest = TenantServiceRequest;
window.openServiceRequestModal = () => TenantServiceRequest.openServiceRequestModal();
window.closeServiceRequestModal = () => TenantServiceRequest.closeServiceRequestModal();