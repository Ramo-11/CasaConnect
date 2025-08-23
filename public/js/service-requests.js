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
    'completed': 'Mark this request as completed?'
  };
  
  if (!confirm(confirmMessages[newStatus] || 'Update status?')) {
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

// View Request Details
function viewDetails(requestId) {
  window.location.href = `/manager/service-requests/${requestId}`;
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