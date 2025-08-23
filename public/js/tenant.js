// Tenant Dashboard JavaScript

// Tab Navigation
document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  initializePaymentForm();
  initializeServiceRequestForm();
  initializeFilters();
  checkPaymentStatus();
});

// Tab System
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
  
  // Handle tab links
  document.querySelectorAll('[data-tab-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab-target');
      switchTab(targetTab);
    });
  });
}

function switchTab(targetTab) {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    if (button.getAttribute('data-tab') === targetTab) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  tabPanes.forEach(pane => {
    if (pane.id === targetTab) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

// Payment Modal
function openPaymentModal() {
  const modal = document.getElementById('paymentModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Service Request Modal
function openServiceRequestModal() {
  const modal = document.getElementById('serviceRequestModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeServiceRequestModal() {
  const modal = document.getElementById('serviceRequestModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modals on outside click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

// Payment Form
function initializePaymentForm() {
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
  
  // Format card expiry
  const expiryInput = document.getElementById('expiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      e.target.value = value;
    });
  }
  
  // Format card number
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
    });
  }
  
  // Payment form submission
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = paymentForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Processing...';
      submitBtn.disabled = true;
      
      try {
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Submit form data
        const formData = new FormData(paymentForm);
        const response = await fetch('/tenant/payment', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          showNotification('Payment processed successfully!', 'success');
          closePaymentModal();
          location.reload();
        } else {
          throw new Error('Payment failed');
        }
      } catch (error) {
        showNotification('Payment failed. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

// Service Request Form
function initializeServiceRequestForm() {
  const serviceForm = document.getElementById('serviceRequestForm');
  
  // Format service card expiry
  const serviceExpiry = document.getElementById('serviceExpiry');
  if (serviceExpiry) {
    serviceExpiry.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      e.target.value = value;
    });
  }
  
  // Format service card number
  const serviceCardNumber = document.getElementById('serviceCardNumber');
  if (serviceCardNumber) {
    serviceCardNumber.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      e.target.value = value;
    });
  }
  
  if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = serviceForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Processing Payment...';
      submitBtn.disabled = true;
      
      try {
        // Validate form
        const category = document.getElementById('requestCategory').value;
        const title = document.getElementById('requestTitle').value;
        const description = document.getElementById('requestDescription').value;
        
        if (!category || !title || !description) {
          throw new Error('Please fill in all required fields');
        }
        
        // Simulate payment and submission
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const formData = new FormData(serviceForm);
        const response = await fetch('/tenant/service-request', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          showNotification('Service request submitted successfully!', 'success');
          closeServiceRequestModal();
          location.reload();
        } else {
          throw new Error('Submission failed');
        }
      } catch (error) {
        showNotification(error.message || 'Failed to submit request. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

// Toggle service request notes
function toggleNotes(requestId) {
  const notesDiv = document.getElementById(`notes-${requestId}`);
  if (notesDiv) {
    notesDiv.style.display = notesDiv.style.display === 'none' ? 'block' : 'none';
  }
}

// Payment Filter
function initializeFilters() {
  const paymentFilter = document.getElementById('payment-filter');
  if (paymentFilter) {
    paymentFilter.addEventListener('change', (e) => {
      const filterValue = e.target.value;
      const rows = document.querySelectorAll('.payment-table tbody tr');
      
      rows.forEach(row => {
        if (filterValue === 'all' || row.getAttribute('data-type') === filterValue) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }
}

// Check Payment Status
function checkPaymentStatus() {
  const paymentDue = document.querySelector('.payment-status-card.warning, .payment-status-card.danger');
  
  if (paymentDue) {
    // Show notification if payment is due
    const daysOverdue = parseInt(paymentDue.getAttribute('data-days-overdue') || '0');
    
    if (daysOverdue > 5) {
      showNotification('URGENT: Your rent payment is overdue. Please contact management immediately.', 'error', true);
    } else if (daysOverdue > 0) {
      showNotification('Reminder: Your rent payment is due. Pay by the 5th to avoid late fees.', 'warning', true);
    }
  }
}

// Notification System
function showNotification(message, type = 'info', persistent = false) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span>${message}</span>
      ${!persistent ? '<button class="notification-close">&times;</button>' : ''}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  if (!persistent) {
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
  }
}

// Auto-refresh payment status
function autoRefreshPaymentStatus() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  // Refresh page at midnight on the 1st and 6th of each month
  if (dayOfMonth === 1 || dayOfMonth === 6) {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight - now;
    
    setTimeout(() => {
      location.reload();
    }, timeUntilMidnight);
  }
}

// Initialize auto-refresh
autoRefreshPaymentStatus();

// Format currency inputs
document.querySelectorAll('input[type="number"]').forEach(input => {
  if (input.getAttribute('data-currency')) {
    input.addEventListener('blur', (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) {
        e.target.value = value.toFixed(2);
      }
    });
  }
});

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
      openPaymentModal();
    }
  }
  
  // Ctrl/Cmd + S for service request
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    openServiceRequestModal();
  }
});

// Add notification styles dynamically
const notificationStyles = `
  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    transform: translateX(500px);
    transition: transform 0.3s ease;
  }
  
  .notification.show {
    transform: translateX(0);
  }
  
  .notification-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: currentColor;
    font-size: 20px;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    width: 24px;
    height: 24px;
  }
  
  .notification-close:hover {
    opacity: 1;
  }
  
  .notification-info {
    background: #dbeafe;
    color: #1e40af;
  }
  
  .notification-success {
    background: #d1fae5;
    color: #065f46;
  }
  
  .notification-warning {
    background: #fed7aa;
    color: #92400e;
  }
  
  .notification-error {
    background: #fee2e2;
    color: #991b1b;
  }
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);