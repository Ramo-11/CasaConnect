const PaymentMethod = require("../../../models/PaymentMethod");
const User = require("../../../models/User");
const stripe = require("../../config/stripe");
const { logger } = require("../../logger");

// helper: ensure Stripe customer
async function ensureCustomer(tenant) {
    if (!tenant.stripeCustomerId) {
        const c = await stripe.customers.create({
            email: tenant.email,
            name: `${tenant.firstName} ${tenant.lastName}`,
            metadata: { tenantId: String(tenant._id) },
        });
        tenant.stripeCustomerId = c.id;
        await tenant.save();
    }
    return tenant.stripeCustomerId;
}

// GET /api/tenant/payment-methods
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

// POST /api/tenant/payment-methods/setup-intent { type: "card" | "ach" }
exports.createSetupIntent = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { type } = req.body;
        const tenant = await User.findById(tenantId);
        const customerId = await ensureCustomer(tenant);

        const payment_method_types =
            type === "ach" ? ["us_bank_account"] : ["card"];

        const si = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types:
                type === "ach" ? ["us_bank_account"] : ["card"],
            usage: "off_session",
            ...(type === "ach" && {
                payment_method_options: {
                    us_bank_account: { verification_method: "microdeposits" },
                },
            }),
        });
        res.json({ success: true, clientSecret: si.client_secret });
    } catch (e) {
        logger.error(`Create SetupIntent error: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message || "Failed to create setup intent",
        });
    }
};

// POST /api/tenant/payment-methods  { type, paymentMethodId }
// Persists an already-attached pm_ to our DB (deduping), supports cards and us_bank_account
exports.saveFromPaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { type, paymentMethodId } = req.body;
        const tenant = await User.findById(tenantId);
        const customerId = await ensureCustomer(tenant);

        // Retrieve PM and attach if not attached to this customer
        let pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (!pm) throw new Error("Payment method not found at Stripe");

        if (!pm.customer) {
            pm = await stripe.paymentMethods.attach(pm.id, {
                customer: customerId,
            });
        } else if (pm.customer !== customerId) {
            // Optional: detach from other customer then attach; usually shouldn't happen in tenant flow
            await stripe.paymentMethods.detach(pm.id);
            pm = await stripe.paymentMethods.attach(pm.id, {
                customer: customerId,
            });
        }

        // DB dedupe
        const existingDoc = await PaymentMethod.findOne({
            user: tenantId,
            stripePaymentMethodId: pm.id,
        });
        if (existingDoc) {
            return res.json({
                success: true,
                data: existingDoc,
                message: "Already saved",
            });
        }

        // Map Stripe PM -> local fields
        const data = {
            user: tenantId,
            isDefault: false,
            stripePaymentMethodId: pm.id,
        };

        if (pm.type === "card") {
            data.type = "card";
            data.last4 = pm.card?.last4;
            data.brand = pm.card?.brand;
            data.expMonth = pm.card?.exp_month;
            data.expYear = pm.card?.exp_year;
            data.verified = true;
        } else if (pm.type === "us_bank_account") {
            data.type = "ach"; // keep your UI label
            data.last4 = pm.us_bank_account?.last4;
            data.bankName = pm.us_bank_account?.bank_name || "Bank Account";
            data.accountType = pm.us_bank_account?.account_type || "checking";
            const v = pm.us_bank_account?.verification_status; // "unverified" | "pending" | "verified"
            data.verified = v === "verified";
        } else {
            throw new Error(`Unsupported payment method type: ${pm.type}`);
        }

        // default if first method (prefer card)
        const count = await PaymentMethod.countDocuments({ user: tenantId });
        if (count === 0 && data.type === "card") data.isDefault = true;

        const saved = await PaymentMethod.create(data);
        res.json({
            success: true,
            data: saved,
            requiresVerification: data.type === "ach" && !data.verified,
        });
    } catch (e) {
        logger.error(`saveFromPaymentMethod error: ${e.message}`);
        res.status(500).json({
            success: false,
            message: e.message || "Failed to save payment method",
        });
    }
};

// DELETE /api/tenant/payment-method/:methodId
exports.deletePaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { methodId } = req.params;

        const pmDoc = await PaymentMethod.findOne({
            _id: methodId,
            user: tenantId,
        });
        if (!pmDoc)
            return res
                .status(404)
                .json({ success: false, message: "Payment method not found" });

        const tenant = await User.findById(tenantId);
        const isStripePM = pmDoc.stripePaymentMethodId?.startsWith("pm_");

        try {
            if (isStripePM) {
                await stripe.paymentMethods.detach(pmDoc.stripePaymentMethodId);
            } else if (
                tenant?.stripeCustomerId &&
                pmDoc.stripePaymentMethodId
            ) {
                await stripe.customers.deleteSource(
                    tenant.stripeCustomerId,
                    pmDoc.stripePaymentMethodId
                );
            }
        } catch (stripeErr) {
            logger.warn(
                `Stripe detach/deleteSource warning: ${stripeErr.message}`
            );
        }

        // reassign default if needed
        if (pmDoc.isDefault) {
            const other = await PaymentMethod.findOne({
                user: tenantId,
                _id: { $ne: pmDoc._id },
            }).sort({ createdAt: 1 });
            if (other) {
                other.isDefault = true;
                await other.save();
            }
        }

        await pmDoc.deleteOne();
        res.json({ success: true, message: "Payment method removed" });
    } catch (e) {
        res.status(500).json({
            success: false,
            message: e.message || "Failed to delete payment method",
        });
    }
};

// PUT /api/tenant/payment-method/:methodId/default
exports.setDefaultPaymentMethod = async (req, res) => {
    try {
        const tenantId = req.session?.userId;
        const { methodId } = req.params;

        const pmDoc = await PaymentMethod.findOne({
            _id: methodId,
            user: tenantId,
        });
        if (!pmDoc)
            return res
                .status(404)
                .json({ success: false, message: "Payment method not found" });

        // If ACH via PaymentMethods, ensure verified
        if (pmDoc.type === "ach") {
            try {
                if (pmDoc.stripePaymentMethodId?.startsWith("pm_")) {
                    const pm = await stripe.paymentMethods.retrieve(
                        pmDoc.stripePaymentMethodId
                    );
                    const v = pm.us_bank_account?.verification_status;
                    if (v !== "verified") {
                        return res
                            .status(400)
                            .json({
                                success: false,
                                message:
                                    "Bank account must be verified before setting as default.",
                            });
                    }
                } else {
                    // legacy source
                    const tenant = await User.findById(tenantId);
                    const source = await stripe.customers.retrieveSource(
                        tenant.stripeCustomerId,
                        pmDoc.stripePaymentMethodId
                    );
                    if (source.status !== "verified") {
                        return res
                            .status(400)
                            .json({
                                success: false,
                                message:
                                    "Bank account must be verified before setting as default.",
                            });
                    }
                }
            } catch (e) {
                logger.error(`ACH verification check error: ${e.message}`);
            }
        }

        await PaymentMethod.updateMany(
            { user: tenantId },
            { isDefault: false }
        );
        pmDoc.isDefault = true;
        await pmDoc.save();

        res.json({ success: true, message: "Default payment method updated" });
    } catch (error) {
        logger.error(`Set default payment method error: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Failed to update default payment method",
        });
    }
};

module.exports = exports;
