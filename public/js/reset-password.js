// Reset Password Page JavaScript

// Toggle password visibility for specific field
function togglePasswordField(fieldId, toggleId) {
    const passwordInput = document.getElementById(fieldId);
    const toggleIcon = document.getElementById(toggleId);

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.className = 'icon-eye-off';
    } else {
        passwordInput.type = 'password';
        toggleIcon.className = 'icon-eye';
    }
}

// Initialize reset password form
PM.ready(() => {
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = resetPasswordForm.querySelector('.btn-login');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            // Get form data
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const token = document.getElementById('resetToken').value;

            // Validate passwords match
            if (password !== confirmPassword) {
                PM.NotificationManager.error('Passwords do not match');
                resetPasswordForm.classList.add('shake');
                setTimeout(() => resetPasswordForm.classList.remove('shake'), 500);
                return;
            }

            // Validate password strength
            if (password.length < 8) {
                PM.NotificationManager.error('Password must be at least 8 characters long');
                resetPasswordForm.classList.add('shake');
                setTimeout(() => resetPasswordForm.classList.remove('shake'), 500);
                return;
            }

            // Show loading state
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`/auth/reset-password/${token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        password: password,
                        confirmPassword: confirmPassword,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    PM.NotificationManager.success(data.message);

                    // Show success message and redirect after delay
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Password Reset Successful';
                    submitBtn.classList.add('btn-success');

                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    throw new Error(data.message || 'Failed to reset password');
                }
            } catch (error) {
                // Show error
                PM.NotificationManager.error(
                    error.message || 'An error occurred. Please try again.'
                );

                // Reset button state
                btnText.style.display = 'block';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;

                // Shake animation
                resetPasswordForm.classList.add('shake');
                setTimeout(() => resetPasswordForm.classList.remove('shake'), 500);
            }
        });
    }

    // Password strength indicator (optional enhancement)
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            const confirmInput = document.getElementById('confirmPassword');

            // Check if passwords match while typing in confirm field
            if (confirmInput.value.length > 0) {
                if (passwordInput.value !== confirmInput.value) {
                    confirmInput.setCustomValidity('Passwords do not match');
                } else {
                    confirmInput.setCustomValidity('');
                }
            }
        });
    }

    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', (e) => {
            const passwordInput = document.getElementById('password');

            if (e.target.value !== passwordInput.value) {
                e.target.setCustomValidity('Passwords do not match');
            } else {
                e.target.setCustomValidity('');
            }
        });
    }

    // Add shake animation styles if not already present
    if (!document.querySelector('#shake-styles')) {
        const style = document.createElement('style');
        style.id = 'shake-styles';
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
    }
});
