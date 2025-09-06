require('dotenv').config();

const stripeKey = process.env.NODE_ENV === 'production' 
    ? process.env.STRIPE_SECRET_KEY_PROD 
    : process.env.STRIPE_SECRET_KEY_TEST;

const stripe = require('stripe')(stripeKey);

module.exports = stripe;