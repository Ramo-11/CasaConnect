// Forgot Password Page JavaScript

// Initialize forgot password form
PM.ready(() => {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = forgotPasswordForm.querySelector('.btn-login');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            // Show loading state
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            submitBtn.disabled = true;

            // Get form data
            const formData = PM.FormUtils.serializeForm(forgotPasswordForm);

            try {
                const response = await fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });

                const data = await response.json();

                if (data.success) {
                    PM.NotificationManager.success(data.message);
                    forgotPasswordForm.reset();
                } else {
                    throw new Error(data.message || 'Failed to send reset link');
                }
            } catch (error) {
                // Show error
                PM.NotificationManager.error(
                    error.message || 'An error occurred. Please try again.'
                );

                // Shake animation
                forgotPasswordForm.classList.add('shake');
                setTimeout(() => forgotPasswordForm.classList.remove('shake'), 500);
            } finally {
                // Reset button state
                btnText.style.display = 'block';
                btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // Add shake animation styles (reuse from login)
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
