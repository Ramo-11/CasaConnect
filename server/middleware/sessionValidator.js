const User = require('../../models/User');
const { logger } = require('../logger');

exports.validateSession = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return next();
    }

    try {
        // Check if user still exists and is active
        const user = await User.findById(req.session.userId).select(
            'role isActive email firstName lastName'
        );

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

        // Ensure user object exists in session (for boarding manager views)
        if (!req.session.user) {
            req.session.user = {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            };
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

exports.enforceRole = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return next();
    }

    const path = req.path;
    const sessionRole = req.session.userRole;

    // Manager area - accessible by manager, supervisor, and restricted_manager
    if (
        path.startsWith('/manager') &&
        !['manager', 'supervisor', 'restricted_manager'].includes(sessionRole)
    ) {
        logger.warn(
            `Role mismatch: User ${req.session.userId} with role ${sessionRole} trying to access manager area, path: ${path}`
        );

        if (sessionRole === 'tenant') {
            return res.redirect('/tenant/dashboard');
        } else if (sessionRole === 'boarding_manager') {
            return res.redirect('/boarding/dashboard');
        }
        return res.redirect('/login');
    }

    // Rest of the function remains the same...
    if (path.startsWith('/tenant') && sessionRole !== 'tenant') {
        logger.warn(
            `Role mismatch: User ${req.session.userId} with role ${sessionRole} trying to access tenant area, path: ${path}`
        );

        if (['manager', 'supervisor', 'restricted_manager'].includes(sessionRole)) {
            return res.redirect('/manager/dashboard');
        } else if (sessionRole === 'boarding_manager') {
            return res.redirect('/boarding/dashboard');
        }
        return res.redirect('/login');
    }

    if (path.startsWith('/boarding') && sessionRole !== 'boarding_manager') {
        logger.warn(
            `Role mismatch: User ${req.session.userId} with role ${sessionRole} trying to access boarding manager area, path: ${path}`
        );

        if (['manager', 'supervisor', 'restricted_manager'].includes(sessionRole)) {
            return res.redirect('/manager/dashboard');
        } else if (sessionRole === 'tenant') {
            return res.redirect('/tenant/dashboard');
        }
        return res.redirect('/login');
    }

    next();
};
