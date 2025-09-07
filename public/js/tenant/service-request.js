// public/js/tenant/service-request.js
// Service request management module

const TenantServiceRequest = {
    processing: false,
    
    init() {
        this.initializeFormHandlers();
        this.loadRequestHistory();
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
    const required = ['requestCategory', 'requestTitle', 'requestDescription'];
    const missing = required.filter(id => !document.getElementById(id)?.value);
    if (missing.length > 0) {
        CasaConnect.NotificationManager.error('Please fill in all required fields');
        this.processing = false; return;
    }

    // Get selected payment method (must be pm_...)
    const selectedMethod = form.querySelector('input[name="servicePaymentMethodId"]:checked');
    if (!selectedMethod) {
        CasaConnect.NotificationManager.error('Please select a payment method');
        this.processing = false; return;
    }

    // Optional client-side size guard: 3 files max, 5MB each, 15MB total
    const photosInput = form.querySelector('input[name="photos"]');
    if (photosInput?.files?.length) {
        if (photosInput.files.length > 3) {
        CasaConnect.NotificationManager.error('Max 3 photos allowed'); 
        this.processing = false; return;
        }
        const tooBig = [...photosInput.files].some(f => f.size > 5 * 1024 * 1024);
        const total = [...photosInput.files].reduce((s,f)=>s+f.size,0);
        if (tooBig) {
        CasaConnect.NotificationManager.error('Each photo must be under 5MB.');
        this.processing = false; return;
        }
        if (total > 15 * 1024 * 1024) {
        CasaConnect.NotificationManager.error('Total photo size exceeds 15MB.');
        this.processing = false; return;
        }
    }

    // Show loading
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    submitBtn.disabled = true;

    try {
        // Build form data and include Stripe PM id
        const formData = new FormData(form);
        formData.append('paymentMethodId', selectedMethod.value); // <-- pm_...

        const response = await CasaConnect.APIClient.post('/api/tenant/service-request', formData);

        if (response.success) {
        CasaConnect.NotificationManager.success('Service request submitted successfully!');
        this.closeServiceRequestModal();
        setTimeout(() => {
            this.refreshRequests();
            location.reload();
        }, 1200);
        } else {
        throw new Error(response.error || 'Submission failed');
        }
    } catch (error) {
        // Show Multer-friendly messages or generic errors
        CasaConnect.NotificationManager.error(error.message || 'Failed to submit request');
    } finally {
        this.processing = false;
        btnText.style.display = 'inline-flex';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
    },
    
    async openServiceRequestModal() {
        // First check for payment methods
        const response = await CasaConnect.APIClient.get('/api/tenant/payment-methods');
        
        CasaConnect.ModalManager.openModal('serviceRequestModal');
        
        if (!response.success || !response.data.data || response.data.data.length === 0) {
            // Show no payment methods UI
            document.getElementById('noServicePaymentMethods').style.display = 'block';
            document.getElementById('servicePaymentMethods').style.display = 'none';
            document.querySelector('#serviceRequestForm button[type="submit"]').disabled = true;
            return;
        }
        
        // Display payment methods for selection
        this.displayServicePaymentMethods(response.data.data);
    },
    
    displayServicePaymentMethods(methods) {
        const container = document.getElementById('servicePaymentMethods');
        const noMethodsDiv = document.getElementById('noServicePaymentMethods');
        const submitBtn = document.querySelector('#serviceRequestForm button[type="submit"]');
        
        if (!methods || methods.length === 0) {
            container.style.display = 'none';
            noMethodsDiv.style.display = 'block';
            if (submitBtn) submitBtn.disabled = true;
            return;
        }
        
        container.style.display = 'block';
        noMethodsDiv.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
        
        container.innerHTML = `
            <div class="payment-methods-list">
                ${methods.map((method, index) => `
                    <label class="payment-method-option">
                        <input type="radio" name="servicePaymentMethodId" value="${method.stripePaymentMethodId}"
                            ${index === 0 || method.isDefault ? 'checked' : ''}>
                        <div class="method-card">
                            <i class="fas fa-${method.type === 'card' ? 'credit-card' : 'university'}"></i>
                            <div class="method-info">
                                <span class="method-name">${method.type === 'card' 
                                    ? `${method.brand || 'Card'} •••• ${method.last4}` 
                                    : `Bank •••• ${method.last4}`}</span>
                                ${method.isDefault ? '<span class="badge badge-primary">Default</span>' : ''}
                            </div>
                        </div>
                    </label>
                `).join('')}
            </div>
        `;
    },
    
    closeServiceRequestModal() {
        CasaConnect.ModalManager.closeModal('serviceRequestModal');
        
        // Clear form
        const form = document.getElementById('serviceRequestForm');
        if (form) form.reset();
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