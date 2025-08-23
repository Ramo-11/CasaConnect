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
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
});

// const userMiddleware = async (req, res, next) => {
//     try {
//         // const userData = await getUser(req) || {}
//         const userData = {};
//         res.locals.user = userData.user || null;
//         res.locals.userLoggedIn = !!userData.isLoggedIn;
//         res.locals.isUserAdmin = !!userData.isAdmin;

//         if (!req.session) req.session = {};
//         req.session.userLoggedIn = !!userData.isLoggedIn;
//         req.session.isUserAdmin = !!userData.isAdmin;
//     } catch (error) {
//         console.error("Error retrieving user data:", error);
//         res.locals.user = null;
//         res.locals.userLoggedIn = false;
//         res.locals.isUserAdmin = null;
//     }
//     res.locals.currentRoute = req.path;
//     next();
// };

module.exports = { sessionMiddleware };
