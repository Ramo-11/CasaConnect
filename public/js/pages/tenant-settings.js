// Tenant Settings Management

const TenantSettings = {
    init() {
        this.initializePasswordForm();
        this.initializePasswordStrength();
    },
    
    initializePasswordForm() {
        const form = document.getElementById('changePasswordForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.changePassword(e.target);
        });
        
        // Real-time validation
        const confirmPassword = document.getElementById('confirmPassword');
        const newPassword = document.getElementById('newPassword');
        
        confirmPassword.addEventListener('input', () => {
            if (confirmPassword.value && newPassword.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        });
    },
    
    initializePasswordStrength() {
        const passwordInput = document.getElementById('newPassword');
        const strengthDiv = document.getElementById('passwordStrength');
        
        if (!passwordInput || !strengthDiv) return;
        
        passwordInput.addEventListener('input', (e) => {
            const strength = this.calculatePasswordStrength(e.target.value);
            this.updateStrengthIndicator(strength);
        });
    },
    
    calculatePasswordStrength(password) {
        if (!password) return null;
        
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        
        // Complexity checks
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        
        if (strength <= 2) return 'weak';
        if (strength <= 4) return 'medium';
        return 'strong';
    },
    
    updateStrengthIndicator(strength) {
        const strengthDiv = document.getElementById('passwordStrength');
        const strengthFill = strengthDiv.querySelector('.strength-fill');
        const strengthText = strengthDiv.querySelector('.strength-text');
        
        if (!strength) {
            strengthDiv.style.display = 'none';
            return;
        }
        
        strengthDiv.style.display = 'block';
        strengthFill.className = `strength-fill ${strength}`;
        
        const messages = {
            weak: 'Weak password',
            medium: 'Medium strength',
            strong: 'Strong password'
        };
        
        strengthText.textContent = messages[strength];
    },
    
    async changePassword(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Show loading state
        submitBtn.innerHTML = '<span class="spinner"></span> Changing Password...';
        submitBtn.disabled = true;
        
        try {
            const formData = new FormData(form);
            const json = Object.fromEntries(formData);
            const response = await CasaConnect.APIClient.post('/tenant/change-password', json);

            if (response.success) {
                console.log(`Password changed successfully for tenant: ${json.tenantId}`);
                console.log(`response: ${JSON.stringify(response)}`);
                CasaConnect.NotificationManager.success('Password changed successfully!');
                form.reset();
                
                // Remove the warning banner if it exists
                const warningBanner = document.querySelector('.alert-warning');
                if (warningBanner) {
                    warningBanner.style.display = 'none';
                }
                
                // Redirect to dashboard after 2 seconds
                // setTimeout(() => {
                    // window.location.href = '/tenant/dashboard';
                // }, 2000);
            } else {
                throw new Error(response.error || response.message || 'Failed to change password');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
};

// Initialize on page load
CasaConnect.ready(() => {
    TenantSettings.init();
});