// public/js/tenant/modules/payment-methods.js
// Handles saving and managing payment methods (separate from making payments)

const PaymentMethodManager = {
    stripe: null,
    cardElement: null,

    init() {
        console.log("Initializing PaymentMethodManager");

        // Initialize Stripe if available
        if (window.Stripe && window.STRIPE_CONFIG?.publicKey) {
            this.stripe = Stripe(window.STRIPE_CONFIG.publicKey);
            const elements = this.stripe.elements();

            // Create card element for adding new payment methods
            this.cardElement = elements.create("card", {
                style: {
                    base: {
                        fontSize: "16px",
                        color: "#32325d",
                        "::placeholder": {
                            color: "#aab7c4",
                        },
                    },
                },
            });
            console.log("Stripe initialized");
        } else {
            console.warn("Stripe not available");
        }

        this.setupPaymentTypeToggle();
        this.loadPaymentMethods();
    },

    setupPaymentTypeToggle() {
        const paymentTypeRadios = document.querySelectorAll(
            'input[name="newPaymentType"]'
        );
        paymentTypeRadios.forEach((radio) => {
            radio.addEventListener("change", (e) => {
                const cardFields = document.getElementById("newCardFields");
                const achFields = document.getElementById("newAchFields");

                // Card field elements
                const cardholderName =
                    document.getElementById("cardholderName");

                // ACH field elements
                const accountHolder = document.querySelector(
                    'input[name="accountHolder"]'
                );
                const routingNumber = document.querySelector(
                    'input[name="routingNumber"]'
                );
                const accountNumber = document.querySelector(
                    'input[name="accountNumber"]'
                );

                if (e.target.value === "card") {
                    cardFields.style.display = "block";
                    achFields.style.display = "none";

                    // Set required for card fields
                    if (cardholderName) cardholderName.required = true;

                    // Remove required from ACH fields
                    if (accountHolder) accountHolder.required = false;
                    if (routingNumber) routingNumber.required = false;
                    if (accountNumber) accountNumber.required = false;

                    // Mount card element if not already mounted
                    if (this.cardElement && !this.cardElement._parent) {
                        this.cardElement.mount("#card-element-new");
                    }
                } else {
                    cardFields.style.display = "none";
                    achFields.style.display = "block";

                    // Remove required from card fields
                    if (cardholderName) cardholderName.required = false;

                    // Set required for ACH fields
                    if (accountHolder) accountHolder.required = true;
                    if (routingNumber) routingNumber.required = true;
                    if (accountNumber) accountNumber.required = true;
                }
            });
        });
    },

    setupAddPaymentForm() {
        const form = document.getElementById("addPaymentMethodForm");
        console.log("Setting up payment form, form found:", !!form);

        if (!form) {
            console.error("Payment method form not found");
            return;
        }

        // Remove any existing listeners
        form.removeEventListener("submit", this.handleFormSubmit);

        // Create bound handler
        this.handleFormSubmit = async (e) => {
            e.preventDefault();
            console.log("Form submitted");
            await this.savePaymentMethod(e.target);
        };

        // Add event listener
        form.addEventListener("submit", this.handleFormSubmit);
        console.log("Form submit listener attached");
    },

    async savePaymentMethod(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Show loading
        submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
        submitBtn.disabled = true;

        try {
            const paymentType = form.querySelector(
                'input[name="newPaymentType"]:checked'
            ).value;
            let paymentData = { type: paymentType };

            if (paymentType === "card") {
                // Validate card fields
                const cardholderName =
                    document.getElementById("cardholderName").value;
                if (!cardholderName) {
                    throw new Error("Cardholder name is required");
                }

                // Create token with Stripe
                const { token, error } = await this.stripe.createToken(
                    this.cardElement,
                    {
                        name: cardholderName,
                    }
                );

                if (error) {
                    throw new Error(error.message);
                }

                paymentData.token = token.id;
                paymentData.cardholderName = cardholderName;
            } else {
                // ACH fields
                const formData = new FormData(form);
                const accountHolder = formData.get("accountHolder");
                const routingNumber = formData.get("routingNumber");
                const accountNumber = formData.get("accountNumber");

                if (!accountHolder || !routingNumber || !accountNumber) {
                    throw new Error("All bank account fields are required");
                }

                paymentData.accountHolder = accountHolder;
                paymentData.routingNumber = routingNumber;
                paymentData.accountNumber = accountNumber;
                paymentData.accountType =
                    formData.get("accountType") || "checking";
            }

            // Send to server
            const response = await CasaConnect.APIClient.post(
                "/api/tenant/payment-methods",
                paymentData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success(
                    "Payment method saved successfully"
                );
                this.closeModal();
                this.loadPaymentMethods();
            } else {
                console.error("Save payment method failed:", response);
                throw new Error(
                    response.error || "Failed to save payment method"
                );
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(
                `Error saving payment method: ${error.message}`
            );
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },

    async loadPaymentMethods() {
        try {
            const response = await CasaConnect.APIClient.get(
                "/api/tenant/payment-methods"
            );
            console.log("Payment methods response:", response);

            if (response.success) {
                // Handle different response structures
                let methods = response.data;

                // If data is wrapped in another data property
                if (methods && methods.data) {
                    methods = methods.data;
                }

                // Ensure methods is an array
                if (!Array.isArray(methods)) {
                    console.warn("Payment methods is not an array:", methods);
                    methods = [];
                }

                this.displayPaymentMethods(methods);
            } else {
                console.error("Failed to load payment methods");
                this.displayPaymentMethods([]);
            }
        } catch (error) {
            console.error("Failed to load payment methods:", error);
            this.displayPaymentMethods([]);
        }
    },

    displayPaymentMethods(methods) {
        const container = document.getElementById("paymentMethodsList");
        if (!container) return;

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
                            ? `${method.brand || "Card"} •••• ${method.last4}`
                            : `Bank Account •••• ${method.last4}`
                    }
                </span>
                ${
                    method.isDefault
                        ? '<span class="badge badge-primary">Default</span>'
                        : ""
                }
                ${
                    method.type === "ach" && !method.verified
                        ? '<span class="badge badge-warning">Pending Verification</span>'
                        : ""
                }
            </div>
            <div class="method-actions">
                ${
                    !method.isDefault &&
                    (method.type === "card" || method.verified)
                        ? `<button onclick="PaymentMethodManager.setDefaultPaymentMethod('${method._id}')" class="btn-link">Set Default</button>`
                        : ""
                }
                <button onclick="PaymentMethodManager.removePaymentMethod('${
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
            const response = await CasaConnect.APIClient.put(
                `/api/tenant/payment-method/${methodId}/default`
            );

            if (response.success) {
                CasaConnect.NotificationManager.success(
                    "Default payment method updated"
                );
                this.loadPaymentMethods();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(
                `Failed to update default payment method: ${error.message}`
            );
        }
    },

    async removePaymentMethod(methodId) {
        if (!confirm("Remove this payment method?")) return;

        try {
            const response = await CasaConnect.APIClient.delete(
                `/api/tenant/payment-method/${methodId}`
            );

            if (response.success) {
                CasaConnect.NotificationManager.success(
                    "Payment method removed"
                );
                this.loadPaymentMethods();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(
                `Failed to remove payment method: ${error.message}`
            );
        }
    },

    openModal() {
        console.log("Opening payment method modal");
        CasaConnect.ModalManager.openModal("addPaymentMethodModal");

        // Re-setup form when modal opens
        setTimeout(() => {
            this.setupAddPaymentForm();

            // Mount Stripe element when modal opens
            if (this.cardElement && !this.cardElement._parent) {
                const cardContainer =
                    document.getElementById("card-element-new");
                if (cardContainer) {
                    this.cardElement.mount("#card-element-new");
                    console.log("Stripe card element mounted");
                }
            }
        }, 100);
    },

    closeModal() {
        CasaConnect.ModalManager.closeModal("addPaymentMethodModal");
        const form = document.getElementById("addPaymentMethodForm");
        if (form) form.reset();

        // Clear Stripe element
        if (this.cardElement) {
            this.cardElement.clear();
        }
    },
};

// Export globally
window.PaymentMethodManager = PaymentMethodManager;
