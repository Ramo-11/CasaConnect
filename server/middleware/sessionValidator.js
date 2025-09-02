const User = require("../../models/User");
const { logger } = require("../logger");

// Middleware to validate and refresh session data
exports.validateSession = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return next();
    }

    try {
        // Check if user still exists and is active
        const user = await User.findById(req.session.userId).select('role isActive email firstName lastName');
        
        if (!user || !user.isActive) {
            logger.warn(`Invalid session for user ${req.session.userId}`);
            req.session.destroy();
            return res.redirect('/login');
        }

        // Update session data if needed
        if (user.role !== req.session.userRole) {
            req.session.userRole = user.role;
        }
        
        if (user.fullName !== req.session.userName) {
            req.session.userName = user.fullName;
        }

        // Attach user to request for use in routes
        req.currentUser = user;
        res.locals.user = user; // Make available to views
        
        next();
    } catch (error) {
        logger.error(`Session validation error: ${error}`);
        req.session.destroy();
        return res.redirect('/login');
    }
};

// Middleware to ensure role hasn't changed
exports.enforceRole = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return next();
    }

    // For protected routes, ensure the session role matches what's expected
    const path = req.path;
    const sessionRole = req.session.userRole;

    if (path.startsWith('/manager') && !['manager', 'supervisor'].includes(sessionRole)) {
        logger.warn(`Role mismatch: User ${req.session.userId} with role ${sessionRole} trying to access manager area, path: ${path}`);
        return res.redirect('/tenant/dashboard');
    }

    if (path.startsWith('/tenant') && sessionRole !== 'tenant') {
        logger.warn(`Role mismatch: User ${req.session.userId} with role ${sessionRole} trying to access tenant area, path: ${path}`);
        return res.redirect('/manager/dashboard');
    }

    next();
};