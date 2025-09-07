// public/js/tenant/modules/payment-methods.js
// Handles saving and managing payment methods (separate from making payments)

const PaymentMethodManager = {
    stripe: null,
    cardElement: null,

    init() {
        if (window.Stripe && window.STRIPE_CONFIG?.publicKey) {
            this.stripe = Stripe(window.STRIPE_CONFIG.publicKey);
            const elements = this.stripe.elements();
            this.cardElement = elements.create("card", {
                style: { base: { fontSize: "16px" } },
            });
        }
        this.setupPaymentTypeToggle();
        this.loadPaymentMethods();
    },

    setupPaymentTypeToggle() {
        const radios = document.querySelectorAll(
            'input[name="newPaymentType"]'
        );
        radios.forEach((r) =>
            r.addEventListener("change", (e) => {
                const cardFields = document.getElementById("newCardFields");
                const achFields = document.getElementById("newAchFields");
                const cardholderName =
                    document.getElementById("cardholderName");
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
                    if (cardholderName) cardholderName.required = true;
                    if (accountHolder) accountHolder.required = false;
                    if (routingNumber) routingNumber.required = false;
                    if (accountNumber) accountNumber.required = false;
                    if (this.cardElement && !this.cardElement._parent)
                        this.cardElement.mount("#card-element-new");
                } else {
                    cardFields.style.display = "none";
                    achFields.style.display = "block";
                    if (cardholderName) cardholderName.required = false;
                    if (accountHolder) accountHolder.required = true;
                    if (routingNumber) routingNumber.required = true;
                    if (accountNumber) accountNumber.required = true;
                }
            })
        );
    },

    setupAddPaymentForm() {
        const form = document.getElementById("addPaymentMethodForm");
        if (!form) return;
        form.removeEventListener("submit", this.handleFormSubmit);
        this.handleFormSubmit = async (e) => {
            e.preventDefault();
            await this.savePaymentMethod(e.target);
        };
        form.addEventListener("submit", this.handleFormSubmit);
    },

    async savePaymentMethod(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
        submitBtn.disabled = true;

        try {
            const type = form.querySelector(
                'input[name="newPaymentType"]:checked'
            ).value; // "card" | "ach"

            // 1) Server creates a SetupIntent for the chosen type
            const siResp = await CasaConnect.APIClient.post(
                "/api/tenant/payment-methods/setup-intent",
                { type }
            );
            if (!siResp?.success)
                throw new Error(
                    siResp?.message || "Failed to create setup intent"
                );
            const clientSecret =
                siResp?.clientSecret ??
                siResp?.data?.clientSecret ??
                siResp?.client_secret ??
                siResp?.data?.client_secret;

            if (
                typeof clientSecret !== "string" ||
                !clientSecret.includes("_secret_")
            ) {
                throw new Error(
                    "Bad SetupIntent response (missing client_secret)."
                );
            }

            // 2) Confirm on client with Stripe.js
            let confirmResult;
            if (type === "card") {
                const cardholderName =
                    document.getElementById("cardholderName")?.value ||
                    undefined;
                if (!this.cardElement)
                    throw new Error("Stripe card element not ready");

                confirmResult = await this.stripe.confirmCardSetup(
                    clientSecret,
                    {
                        payment_method: {
                            card: this.cardElement,
                            billing_details: { name: cardholderName },
                        },
                    }
                );
            } else {
                const fd = new FormData(form);
                const accountHolder = fd.get("accountHolder");
                const routingNumber = fd.get("routingNumber");
                const accountNumber = fd.get("accountNumber");
                const accountType = fd.get("accountType") || "checking";
                if (!accountHolder || !routingNumber || !accountNumber)
                    throw new Error("All bank fields are required");

                confirmResult = await stripe.confirmUsBankAccountSetup(clientSecret, 
                    {
                        payment_method: {
                            billing_details: { name: accountHolder },
                            us_bank_account: {
                                account_number: accountNumber,
                                routing_number: routingNumber,
                                account_holder_type: "individual",
                                account_type: accountType,
                            },
                        },
                    }
                );
            }

            if (confirmResult.error)
                throw new Error(confirmResult.error.message);

            const setupIntent = confirmResult.setupIntent;
            const paymentMethodId = setupIntent.payment_method;

            // 3) Tell server to persist the attached pm_ and mirror to DB
            const saveResp = await CasaConnect.APIClient.post(
                "/api/tenant/payment-methods",
                {
                    type,
                    paymentMethodId,
                }
            );

            if (!saveResp?.success)
                throw new Error(
                    saveResp?.message || "Failed to save payment method"
                );

            CasaConnect.NotificationManager.success(
                type === "ach"
                    ? "Bank added. Watch for micro‑deposits."
                    : "Payment method saved."
            );
            this.closeModal();
            this.loadPaymentMethods();
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
        CasaConnect.ModalManager.openModal("addPaymentMethodModal");
        setTimeout(() => {
            this.setupAddPaymentForm();
            if (this.cardElement && !this.cardElement._parent)
                this.cardElement.mount("#card-element-new");
        }, 100);
    },
    closeModal() {
        CasaConnect.ModalManager.closeModal("addPaymentMethodModal");
        const form = document.getElementById("addPaymentMethodForm");
        if (form) form.reset();
        if (this.cardElement) this.cardElement.clear();
    },
};

// Export globally
window.PaymentMethodManager = PaymentMethodManager;
