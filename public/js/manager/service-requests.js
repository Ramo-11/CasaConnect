// Service Requests JavaScript

let currentStatusFilter = 'all';
let selectedRequestId = null;

// Initialize
CasaConnect.ready(() => {
  initializeAssignForm();
  initializeNoteForm();
});

// Filter by Status
function filterByStatus(status) {
  currentStatusFilter = status;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.textContent.toLowerCase().includes(status) || (status === 'all' && tab.textContent.includes('All'))) {
      tab.classList.add('active');
    }
  });
  
  applyFilters();
}

// Apply All Filters
function applyFilters() {
  const priorityFilter = document.getElementById('priorityFilter').value;
  const categoryFilter = document.getElementById('categoryFilter').value;
  const searchTerm = document.getElementById('requestSearch').value.toLowerCase();
  
  const requestCards = document.querySelectorAll('.request-card-full');
  
  requestCards.forEach(card => {
    const status = card.getAttribute('data-status');
    const priority = card.getAttribute('data-priority');
    const category = card.getAttribute('data-category');
    const text = card.textContent.toLowerCase();
    
    let show = true;
    
    // Status filter
    if (currentStatusFilter !== 'all' && status !== currentStatusFilter) show = false;
    
    // Priority filter
    if (priorityFilter !== 'all' && priority !== priorityFilter) show = false;
    
    // Category filter
    if (categoryFilter !== 'all' && category !== categoryFilter) show = false;
    
    // Search filter
    if (searchTerm && !text.includes(searchTerm)) show = false;
    
    card.style.display = show ? '' : 'none';
  });
  
  // Show empty state if no results
  const visibleCards = document.querySelectorAll('.request-card-full:not([style*="display: none"])');
  if (visibleCards.length === 0 && requestCards.length > 0) {
    if (!document.querySelector('.no-results')) {
      const noResults = document.createElement('div');
      noResults.className = 'empty-state no-results';
      noResults.innerHTML = `
        <i class="icon-search-empty"></i>
        <h3>No requests match your filters</h3>
        <p>Try adjusting your search criteria</p>
      `;
      document.querySelector('.requests-list').appendChild(noResults);
    }
  } else {
    const noResults = document.querySelector('.no-results');
    if (noResults) noResults.remove();
  }
}

// Toggle Request Notes
function toggleRequestNotes(requestId) {
  const notesDiv = document.getElementById(`notes-${requestId}`);
  if (notesDiv) {
    notesDiv.style.display = notesDiv.style.display === 'none' ? 'block' : 'none';
  }
}

// Assign Modal
function openAssignModal(requestId) {
  selectedRequestId = requestId;
  document.getElementById('assignRequestId').value = requestId;
  CasaConnect.ModalManager.openModal('assignModal');
}

function closeAssignModal() {
  CasaConnect.ModalManager.closeModal('assignModal');
  document.getElementById('assignForm').reset();
  selectedRequestId = null;
}

// Initialize Assign Form
function initializeAssignForm() {
  const form = document.getElementById('assignForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = CasaConnect.FormUtils.serializeForm(form);
      
      try {
        const response = await CasaConnect.APIClient.post('/api/manager/service-requests/assign', formData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Technician assigned successfully');
          closeAssignModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to assign technician');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
      }
    });
  }
}

// Note Modal
function addNote(requestId) {
  selectedRequestId = requestId;
  document.getElementById('noteRequestId').value = requestId;
  CasaConnect.ModalManager.openModal('noteModal');
}

function closeNoteModal() {
  CasaConnect.ModalManager.closeModal('noteModal');
  document.getElementById('noteForm').reset();
  selectedRequestId = null;
}

// Initialize Note Form
function initializeNoteForm() {
  const form = document.getElementById('noteForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = CasaConnect.FormUtils.serializeForm(form);
      
      try {
        const response = await CasaConnect.APIClient.post('/api/manager/service-requests/note', formData);
        
        if (response.success) {
          CasaConnect.NotificationManager.success('Note added successfully');
          closeNoteModal();
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error(response.error || 'Failed to add note');
        }
      } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
      }
    });
  }
}

// Update Request Status
async function updateStatus(requestId, newStatus) {
    const confirmMessages = {
        'in_progress': 'Start work on this request?',
        'completed': 'Mark this request as completed?',
        'assigned': 'Mark as assigned?'
    };
    
    if (!confirm(confirmMessages[newStatus] || 'Update status?')) {
        // If cancelled, revert the select to its original value
        const select = event.target;
        if (select && select.tagName === 'SELECT') {
            select.value = select.dataset.originalValue || 'pending';
        }
        return;
    }
    
    try {
        const response = await CasaConnect.APIClient.put(`/api/manager/service-requests/${requestId}/status`, {
            status: newStatus
        });
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Status updated successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to update status');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
        // Revert select on error
        const select = event.target;
        if (select && select.tagName === 'SELECT') {
            select.value = select.dataset.originalValue || 'pending';
        }
    }
}

// Cancel Request
async function cancelRequest(requestId) {
  if (!confirm('Are you sure you want to cancel this request?')) {
    return;
  }
  
  try {
    const response = await CasaConnect.APIClient.put(`/api/manager/service-requests/${requestId}/cancel`, {});
    
    if (response.success) {
      CasaConnect.NotificationManager.success('Request cancelled');
      setTimeout(() => location.reload(), 1500);
    } else {
      throw new Error(response.error || 'Failed to cancel request');
    }
  } catch (error) {
    CasaConnect.NotificationManager.error(error.message);
  }
}

// Delete Service Request
async function deleteServiceRequest(requestId) {
    if (!confirm('Are you sure you want to permanently delete this service request? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await CasaConnect.APIClient.delete(`/api/manager/service-requests/${requestId}`);
        
        if (response.success) {
            CasaConnect.NotificationManager.success('Service request deleted successfully');
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(response.error || 'Failed to delete request');
        }
    } catch (error) {
        CasaConnect.NotificationManager.error(error.message);
    }
}

// View Request Details
async function viewDetails(requestId) {
    try {
        const requestCard = document.querySelector(`[data-request-id="${requestId}"]`);
        if (!requestCard) return;
        
        // Extract data from the card
        const title = requestCard.querySelector('h3').textContent;
        const status = requestCard.dataset.status;
        const priority = requestCard.dataset.priority;
        const category = requestCard.dataset.category;
        const description = requestCard.querySelector('.request-description p').textContent;
        const tenant = requestCard.querySelector('.info-group .fa-user')?.nextSibling?.textContent?.trim();
        const unit = requestCard.querySelector('.info-group .fa-home')?.nextSibling?.textContent?.trim();
        const date = requestCard.querySelector('.info-group .fa-calendar')?.nextSibling?.textContent?.trim();
        const assignedTo = requestCard.querySelector('.info-group .fa-wrench')?.nextSibling?.textContent?.trim();
        
        // Get photos if any (you'll need to store this data)
        const photos = requestCard.dataset.photos ? JSON.parse(requestCard.dataset.photos) : [];
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal active" id="detailsModal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2>Service Request Details</h2>
                        <button class="modal-close" onclick="closeDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-section">
                            <h3>${title}</h3>
                            <div class="badges-row">
                                <span class="badge status-${status}">${status.replace('_', ' ')}</span>
                                <span class="badge priority-${priority}">${priority}</span>
                                <span class="category-badge">${category.replace('_', ' ')}</span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Request Information</h4>
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Tenant</label>
                                    <span>${tenant || 'N/A'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Unit</label>
                                    <span>${unit || 'N/A'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Date Submitted</label>
                                    <span>${date || 'N/A'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Assigned To</label>
                                    <span>${assignedTo || 'Not Assigned'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Description</h4>
                            <p>${description}</p>
                        </div>
                        
                        ${photos.length > 0 ? `
                            <div class="detail-section">
                                <h4>Photos (${photos.length})</h4>
                                <div class="photos-grid">
                                    ${photos.map(photo => `
                                        <div class="photo-item">
                                            <img src="${photo.url}" alt="${photo.originalName || 'Service photo'}" 
                                                 onclick="openPhotoViewer('${photo.url}')"
                                                 style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="detail-section">
                            <h4>Notes</h4>
                            <div id="detailNotes-${requestId}">
                                ${requestCard.querySelector(`#notes-${requestId}`)?.innerHTML || '<p class="no-data">No notes available</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeDetailsModal()">Close</button>
                        ${status !== 'completed' ? `
                            <button class="btn btn-primary" onclick="closeDetailsModal(); openAssignModal('${requestId}')">Assign</button>
                            <button class="btn btn-primary" onclick="closeDetailsModal(); addNote('${requestId}')">Add Note</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error('Error viewing details:', error);
        CasaConnect.NotificationManager.error('Failed to load request details');
    }
}

function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.remove();
}

function openPhotoViewer(url) {
    const viewerHtml = `
        <div class="modal active" id="photoViewer" style="z-index: 10000;">
            <div class="modal-content" style="max-width: 90%; max-height: 90%;">
                <div class="modal-header">
                    <h2>Photo</h2>
                    <button class="modal-close" onclick="document.getElementById('photoViewer').remove()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <img src="${url}" style="max-width: 100%; max-height: 70vh; object-fit: contain;">
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', viewerHtml);
}

// Auto-refresh
function autoRefreshRequests() {
  setInterval(async () => {
    try {
      const response = await CasaConnect.APIClient.get('/api/manager/service-requests/updates');
      if (response.success && response.data.hasUpdates) {
        CasaConnect.NotificationManager.info('New updates available. Refreshing...');
        setTimeout(() => location.reload(), 2000);
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, 30000); // Check every 30 seconds
}

// Initialize auto-refresh
autoRefreshRequests();