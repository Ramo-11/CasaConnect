// Tenant Settings Management

const TenantSettings = {
    init() {
        this.initializePasswordForm();
        this.initializePasswordStrength();
        this.initializePaymentMethods();
    },

    initializePaymentMethods() {
        this.loadPaymentMethods();

        // Setup payment type toggle for modal
        const paymentTypeRadios = document.querySelectorAll(
            'input[name="newPaymentType"]'
        );
        paymentTypeRadios.forEach((radio) => {
            radio.addEventListener("change", (e) => {
                const cardFields = document.getElementById("newCardFields");
                const achFields = document.getElementById("newAchFields");

                if (e.target.value === "card") {
                    cardFields.style.display = "block";
                    achFields.style.display = "none";
                } else {
                    cardFields.style.display = "none";
                    achFields.style.display = "block";
                }
            });
        });
    },

    loadPaymentMethods() {
        fetch("/api/tenant/payment-methods")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    this.displayPaymentMethods(data.data);
                }
            })
            .catch((error) => {
                console.error("Failed to load payment methods:", error);
                document.getElementById("paymentMethodsList").innerHTML =
                    '<p class="text-muted">Failed to load payment methods</p>';
            });
    },

    displayPaymentMethods(methods) {
        const container = document.getElementById("paymentMethodsList");

        if (!methods || methods.length === 0) {
            container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-credit-card" style="font-size: 32px; color: #d1d5db;"></i>
                <p style="margin-top: 12px; color: #6b7280;">No payment methods saved</p>
                <p class="text-muted" style="font-size: 14px;">Add a payment method to make payments easier</p>
            </div>
        `;
            return;
        }

        container.innerHTML = methods
            .map(
                (method) => `
        <div class="payment-method-item">
            <div class="method-info">
                <i class="fas fa-${
                    method.type === "card" ? "credit-card" : "university"
                }"></i>
                <span>
                    ${
                        method.type === "card"
                            ? `${method.brand} •••• ${method.last4}`
                            : `Bank Account •••• ${method.last4}`
                    }
                </span>
                ${
                    method.isDefault
                        ? '<span class="badge badge-primary">Default</span>'
                        : ""
                }
            </div>
            <div class="method-actions">
                ${
                    !method.isDefault
                        ? `<button onclick="TenantSettings.setDefaultPaymentMethod('${method._id}')" class="btn-link">Set Default</button>`
                        : ""
                }
                <button onclick="TenantSettings.removePaymentMethod('${
                    method._id
                }')" class="btn-link text-danger">Remove</button>
            </div>
        </div>
    `
            )
            .join("");
    },

    async setDefaultPaymentMethod(methodId) {
        try {
            const response = await fetch(
                `/api/tenant/payment-method/${methodId}/default`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                }
            );

            const data = await response.json();
            if (data.success) {
                CasaConnect.NotificationManager.success(
                    "Default payment method updated"
                );
                this.loadPaymentMethods();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        }
    },

    async removePaymentMethod(methodId) {
        if (!confirm("Remove this payment method?")) return;

        try {
            const response = await fetch(
                `/api/tenant/payment-method/${methodId}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();
            if (data.success) {
                CasaConnect.NotificationManager.success(
                    "Payment method removed"
                );
                this.loadPaymentMethods();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        }
    },

    // Add to TenantSettings object
    loadPaymentMethods() {
        fetch("/api/tenant/payment-methods")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    this.displayPaymentMethods(data.data);
                }
            });
    },

    displayPaymentMethods(methods) {
        const container = document.getElementById("paymentMethodsList");

        if (!methods || methods.length === 0) {
            container.innerHTML =
                '<p class="text-muted">No payment methods saved</p>';
            return;
        }

        container.innerHTML = methods
            .map(
                (method) => `
            <div class="payment-method-item">
                <div class="method-info">
                    <i class="fas fa-${
                        method.type === "card" ? "credit-card" : "university"
                    }"></i>
                    <span>
                        ${
                            method.type === "card"
                                ? `${method.brand} ending in ${method.last4}`
                                : `${method.bankName || "Bank"} ending in ${
                                      method.last4
                                  }`
                        }
                    </span>
                    ${
                        method.isDefault
                            ? '<span class="badge badge-primary">Default</span>'
                            : ""
                    }
                </div>
                <div class="method-actions">
                    ${
                        !method.isDefault
                            ? `<button onclick="setDefaultPaymentMethod('${method._id}')" class="btn-link">Set Default</button>`
                            : ""
                    }
                    <button onclick="removePaymentMethod('${
                        method._id
                    }')" class="btn-link text-danger">Remove</button>
                </div>
            </div>
        `
            )
            .join("");
    },

    initializePasswordForm() {
        const form = document.getElementById("changePasswordForm");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await this.changePassword(e.target);
        });

        // Real-time validation
        const confirmPassword = document.getElementById("confirmPassword");
        const newPassword = document.getElementById("newPassword");

        confirmPassword.addEventListener("input", () => {
            if (
                confirmPassword.value &&
                newPassword.value !== confirmPassword.value
            ) {
                confirmPassword.setCustomValidity("Passwords do not match");
            } else {
                confirmPassword.setCustomValidity("");
            }
        });
    },

    initializePasswordStrength() {
        const passwordInput = document.getElementById("newPassword");
        const strengthDiv = document.getElementById("passwordStrength");

        if (!passwordInput || !strengthDiv) return;

        passwordInput.addEventListener("input", (e) => {
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

        if (strength <= 2) return "weak";
        if (strength <= 4) return "medium";
        return "strong";
    },

    updateStrengthIndicator(strength) {
        const strengthDiv = document.getElementById("passwordStrength");
        const strengthFill = strengthDiv.querySelector(".strength-fill");
        const strengthText = strengthDiv.querySelector(".strength-text");

        if (!strength) {
            strengthDiv.style.display = "none";
            return;
        }

        strengthDiv.style.display = "block";
        strengthFill.className = `strength-fill ${strength}`;

        const messages = {
            weak: "Weak password",
            medium: "Medium strength",
            strong: "Strong password",
        };

        strengthText.textContent = messages[strength];
    },

    async changePassword(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML =
            '<span class="spinner"></span> Changing Password...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            const json = Object.fromEntries(formData);
            const response = await CasaConnect.APIClient.post(
                "/tenant/change-password",
                json
            );

            if (response.success) {
                CasaConnect.NotificationManager.success(
                    "Password changed successfully!"
                );
                form.reset();

                // Remove the warning banner if it exists
                const warningBanner = document.querySelector(".alert-warning");
                if (warningBanner) {
                    warningBanner.style.display = "none";
                }

                // Redirect to dashboard after 2 seconds
                // setTimeout(() => {
                // window.location.href = '/tenant/dashboard';
                // }, 2000);
            } else {
                throw new Error(
                    response.error ||
                        response.message ||
                        "Failed to change password"
                );
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },
};

// Initialize on page load
CasaConnect.ready(() => {
    TenantSettings.init();
});

window.openAddPaymentMethodModal = () => {
    CasaConnect.ModalManager.openModal('addPaymentMethodModal');
};

window.closeAddPaymentMethodModal = () => {
    CasaConnect.ModalManager.closeModal('addPaymentMethodModal');
    document.getElementById('addPaymentMethodForm').reset();
};