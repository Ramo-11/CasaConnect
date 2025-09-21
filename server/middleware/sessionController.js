const session = require('express-session');
const MongoStore = require('connect-mongo');
const { logger } = require('../logger');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    logger.error('MongoDB URI is not defined - will not connect');
    process.exit(1);
}

const mongoUri = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

process.env.MONGODB_URI = mongoUri;

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
        mongoUrl: mongoUri,
        touchAfter: 24 * 3600, // lazy session update
        crypto: {
            secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
        },
    }),
    cookie: {
        secure: isProd, // Use secure cookies in production
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax',
    },
    name: 'sahabpm.sid', // Custom session name
});

module.exports = { sessionMiddleware };
