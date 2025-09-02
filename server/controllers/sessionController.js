const session = require("express-session")
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const baseUri = isProd
    ? process.env.MONGODB_URI_PROD
    : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

// check that baseUri is not empty
if (!baseUri) {
    logger.error("MongoDB URI is not defined - will not connect");
    return;
}
process.env.MONGODB_URI = `${baseUri}${
    baseUri.includes("?") ? "&" : "?"
}dbName=${dbName}`;

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax'
    },
});

module.exports = { sessionMiddleware };
