const PaymentMethod = require("../../../models/PaymentMethod");
const User = require("../../../models/User");
const stripe = require("../../config/stripe");
const { logger } = require("../../logger");

// Get all payment methods for tenant
exports.getPaymentMethods = async (req, res) => {
    try {
        const tenantId = req.session?.userId;

        const methods = await PaymentMethod.find({ user: tenantId }).sort(
            "-isDefault -createdAt"
        );

        res.json({ success: true, data: methods });
    } catch (error) {
        logger.error(`Get payment methods error: ${error}`);
        res.json({ success: false, error: "Failed to get payment methods" });
    }
};

exports.savePaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const {
            type,
            token,
            accountHolder,
            routingNumber,
            accountNumber,
            accountType,
            cardholderName,
        } = req.body;
        const tenant = await User.findById(tenantId);

        // ensure customer
        if (!tenant.stripeCustomerId) {
            const c = await stripe.customers.create({
                email: tenant.email,
                name: `${tenant.firstName} ${tenant.lastName}`,
                metadata: { tenantId: tenantId.toString() },
            });
            tenant.stripeCustomerId = c.id;
            await tenant.save();
        }
        const customerId = tenant.stripeCustomerId;

        let source,
            paymentMethodData = { user: tenantId, type, isDefault: false };

        if (type === "card") {
            // get fingerprint from token, then reuse existing card if present
            const tok = await stripe.tokens.retrieve(token);
            const fp = tok.card.fingerprint;

            const { data: cards } = await stripe.customers.listSources(
                customerId,
                { object: "card", limit: 100 }
            );
            const existing = cards.find((c) => c.fingerprint === fp);

            source =
                existing ||
                (await stripe.customers.createSource(customerId, {
                    source: token,
                }));

            paymentMethodData = {
                ...paymentMethodData,
                stripePaymentMethodId: source.id,
                last4: source.last4,
                brand: source.brand,
                expMonth: source.exp_month,
                expYear: source.exp_year,
                verified: true,
            };
        } else if (type === "ach") {
            const bankToken = await stripe.tokens.create({
                bank_account: {
                    country: "US",
                    currency: "usd",
                    account_holder_name: accountHolder,
                    account_holder_type: "individual",
                    routing_number: routingNumber,
                    account_number: accountNumber,
                },
            });

            const tok = await stripe.tokens.retrieve(bankToken.id);
            const bfp = tok.bank_account.fingerprint;

            const { data: banks } = await stripe.customers.listSources(
                customerId,
                { object: "bank_account", limit: 100 }
            );
            const existing = banks.find((b) => b.fingerprint === bfp);

            source =
                existing ||
                (await stripe.customers.createSource(customerId, {
                    source: bankToken.id,
                }));

            if (!existing) {
                await stripe.customers.verifySource(customerId, source.id, {
                    amounts: [32, 45],
                });
            }

            paymentMethodData = {
                ...paymentMethodData,
                stripePaymentMethodId: source.id,
                last4: String(accountNumber).slice(-4),
                bankName: source.bank_name || "Bank Account",
                accountType: accountType || "checking",
                verified: !!existing && source.status === "verified",
            };
        }

        const existingMethods = await PaymentMethod.find({ user: tenantId });
        if (existingMethods.length === 0 && type === "card")
            paymentMethodData.isDefault = true;

        const pm = await PaymentMethod.create(paymentMethodData);

        res.json({
            success: true,
            data: pm,
            message:
                type === "ach"
                    ? "Bank account added. Two micro-deposits sent for verification."
                    : "Payment method saved successfully",
            requiresVerification: type === "ach" && !paymentMethodData.verified,
        });
    } catch (err) {
        // if duplicate error slips through, just return existing source
        if (err && err.code === "duplicate_card") {
            return res
                .status(200)
                .json({
                    success: true,
                    message: "Card already exists on Stripe for this customer.",
                });
        }
        res.status(500).json({
            success: false,
            message: err.message || "Failed to save payment method",
        });
    }
};

exports.deletePaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { methodId } = req.params;

        const pm = await PaymentMethod.findOne({
            _id: methodId,
            user: tenantId,
        });
        if (!pm)
            return res
                .status(404)
                .json({ success: false, message: "Payment method not found" });

        const tenant = await User.findById(tenantId);
        if (tenant?.stripeCustomerId && pm.stripePaymentMethodId) {
            await stripe.customers.deleteSource(
                tenant.stripeCustomerId,
                pm.stripePaymentMethodId
            );
        }

        // reassign default if needed
        if (pm.isDefault) {
            const other = await PaymentMethod.findOne({
                user: tenantId,
                _id: { $ne: pm._id },
            }).sort({ createdAt: 1 });
            if (other) {
                other.isDefault = true;
                await other.save();
            }
        }

        await pm.deleteOne();
        res.json({ success: true, message: "Payment method removed" });
    } catch (e) {
        res.status(500).json({
            success: false,
            message: e.message || "Failed to delete payment method",
        });
    }
};

// Set default payment method
exports.setDefaultPaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { methodId } = req.params;

        // Get the payment method
        const paymentMethod = await PaymentMethod.findOne({
            _id: methodId,
            user: tenantId,
        });

        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: "Payment method not found",
            });
        }

        // Check if it's an ACH that needs verification
        if (paymentMethod.type === "ach") {
            const tenant = await User.findById(tenantId);

            // Check verification status with Stripe
            try {
                const source = await stripe.customers.retrieveSource(
                    tenant.stripeCustomerId,
                    paymentMethod.stripePaymentMethodId
                );

                if (source.status !== "verified") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Bank account must be verified before setting as default. Micro-deposits will arrive in 1-2 business days.",
                    });
                }
            } catch (stripeError) {
                logger.error(
                    `Stripe verification check error: ${stripeError.message}`
                );
            }
        }

        // Remove current default
        await PaymentMethod.updateMany(
            { user: tenantId },
            { isDefault: false }
        );

        // Set new default
        paymentMethod.isDefault = true;
        await paymentMethod.save();

        logger.info(
            `Default payment method set to ${methodId} for tenant ${tenantId}`
        );
        res.json({ success: true, message: "Default payment method updated" });
    } catch (error) {
        logger.error(`Set default payment method error: ${error.message}`);
        res.status(500).json({
            success: false,
            message:
                error.message ===
                "Only verified bank accounts can be used as a `payment_method`."
                    ? "Bank account must be verified first. Please wait for micro-deposits (1-2 business days)."
                    : "Failed to update default payment method",
        });
    }
};

module.exports = exports;
