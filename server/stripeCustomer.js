const stripe = require("./config/stripe");

async function ensureCustomer(tenant) {
  if (!tenant.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: `${tenant.firstName} ${tenant.lastName}`,
      metadata: { tenantId: String(tenant._id) },
    });
    tenant.stripeCustomerId = customer.id;
    await tenant.save();
  }
  return tenant.stripeCustomerId;
}

module.exports = { ensureCustomer };
