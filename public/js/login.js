// Login Page JavaScript

// Toggle password visibility
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('passwordToggle');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.className = 'icon-eye-off';
  } else {
    passwordInput.type = 'password';
    toggleIcon.className = 'icon-eye';
  }
}

// Initialize login form
CasaConnect.ready(() => {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = loginForm.querySelector('.btn-login');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoading = submitBtn.querySelector('.btn-loading');
      
      // Show loading state
      btnText.style.display = 'none';
      btnLoading.style.display = 'flex';
      submitBtn.disabled = true;
      
      // Get form data
      const formData = CasaConnect.FormUtils.serializeForm(loginForm);
      
      try {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Redirect based on user role
          switch(data.role) {
            case 'manager':
            case 'supervisor':
              window.location.href = '/manager/dashboard';
              break;
            case 'tenant':
              window.location.href = '/tenant/dashboard';
              break;
            case 'electrician':
            case 'plumber':
            case 'general_repair':
              window.location.href = '/technician/dashboard';
              break;
            default:
              window.location.href = '/dashboard';
          }
        } else {
          throw new Error(data.message || 'Login failed');
        }
      } catch (error) {
        // Show error
        CasaConnect.NotificationManager.error(error.message || 'Invalid email or password');
        
        // Reset button
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
        
        // Shake animation
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 500);
      }
    });
  }
  
  // Remember me functionality
  const rememberCheckbox = document.getElementById('remember');
  const emailInput = document.getElementById('email');
  
  // Load saved email if remember was checked
  const savedEmail = CasaConnect.StorageHelper.get('rememberedEmail');
  if (savedEmail) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
  }
  
  // Save/remove email based on checkbox
  rememberCheckbox.addEventListener('change', (e) => {
    if (e.target.checked && emailInput.value) {
      CasaConnect.StorageHelper.set('rememberedEmail', emailInput.value);
    } else {
      CasaConnect.StorageHelper.remove('rememberedEmail');
    }
  });
  
  // Update stored email when it changes
  emailInput.addEventListener('blur', () => {
    if (rememberCheckbox.checked && emailInput.value) {
      CasaConnect.StorageHelper.set('rememberedEmail', emailInput.value);
    }
  });
  
  // Add shake animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    .shake {
      animation: shake 0.5s;
    }
  `;
  document.head.appendChild(style);
});