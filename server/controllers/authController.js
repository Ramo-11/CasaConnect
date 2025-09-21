const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { logger } = require('../logger');

// controllers/authController.js (add at bottom or where appropriate)
exports.attachUserToLocals = (req, res, next) => {
    // Handy for templates: currentUser will be undefined if logged out
    if (req.session && req.session.userId) {
        res.locals.currentUser = {
            id: req.session.userId,
            role: req.session.userRole,
            name: req.session.userName,
        };
    } else {
        res.locals.currentUser = null;
    }
    next();
};

// Get Login Page
exports.getLogin = (req, res) => {
    // If already logged in, redirect to appropriate dashboard
    if (req.session && req.session.userId) {
        return redirectToDashboard(req.session.userRole, res);
    }

    res.render('login', {
        title: 'Login - PM',
        description: 'Welcome to PM',
        additionalCSS: ['login.css'],
        additionalJS: ['login.js'],
        layout: 'layout',
        error: req.flash ? req.flash('error') : null,
        success: req.flash ? req.flash('success') : null,
    });
};

// Process Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password',
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            logger.error(`Login failed - User not found: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email',
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact management.',
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            logger.error(`Login failed - Invalid password for user: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Create session
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.fullName;

        // Generate JWT token (optional, for API access)
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
            },
            process.env.JWT_SECRET || 'your-secret-key',
            {
                expiresIn: '30d',
            }
        );

        // Store token in session
        req.session.token = token;

        // Return success with role for frontend routing
        res.json({
            success: true,
            message: 'Login successful',
            role: user.role,
            user: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login. Please try again.',
        });
    }
};

// Logout
exports.logout = (req, res) => {
    // Destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }

        // Clear cookie
        res.clearCookie('connect.sid');

        // Redirect to login
        res.redirect('/login');
    });
};

// Middleware: Check if authenticated
exports.isAuthenticated = (req, res, next) => {
    // Check for session and userId
    if (!req.session || !req.session.userId) {
        // For API routes, return JSON error
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        // For web routes, redirect to login
        if (req.flash) {
            req.flash('error', 'Please login to continue');
        }
        return res.redirect('/login');
    }

    // Verify the session is still valid by checking if user exists
    User.findById(req.session.userId)
        .then((user) => {
            if (!user || !user.isActive) {
                req.session.destroy();
                if (req.path.startsWith('/api/')) {
                    return res.status(401).json({
                        success: false,
                        message: 'Session expired or invalid',
                    });
                }
                return res.redirect('/login');
            }
            req.user = user; // Attach user to request
            next();
        })
        .catch((err) => {
            logger.error(`Auth check error: ${err}`);
            req.session.destroy();
            if (req.path.startsWith('/api/')) {
                return res.status(500).json({
                    success: false,
                    message: 'Authentication error',
                });
            }
            return res.redirect('/login');
        });
};

// Middleware: Check role
exports.hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!roles.includes(req.session.userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.',
            });
        }

        next();
    };
};

// Middleware: Check if manager or supervisor
exports.isManager = (req, res, next) => {
    // First check authentication
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        return res.redirect('/login');
    }

    // Check role
    if (!['manager', 'supervisor'].includes(req.session.userRole)) {
        logger.warn(
            `Unauthorized access attempt to manager area by user ${req.session.userId} with role ${req.session.userRole}`
        );

        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Manager privileges required.',
            });
        }

        // Redirect to appropriate dashboard based on their actual role
        if (req.session.userRole === 'tenant') {
            return res.redirect('/tenant/dashboard');
        }

        return res.render('error', {
            title: 'Access Denied',
            message: 'You do not have permission to access this area.',
            layout: 'layout',
        });
    }

    next();
};

// Middleware: Check if tenant
exports.isTenant = (req, res, next) => {
    // First check authentication
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        return res.redirect('/login');
    }

    // Check role
    if (req.session.userRole !== 'tenant') {
        logger.warn(
            `Unauthorized access attempt to tenant area by user ${req.session.userId} with role ${req.session.userRole}`
        );

        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Tenant privileges required.',
            });
        }

        // Redirect to appropriate dashboard based on their actual role
        if (['manager', 'supervisor'].includes(req.session.userRole)) {
            return res.redirect('/manager/dashboard');
        }

        return res.render('error', {
            title: 'Access Denied',
            message: 'This area is for tenants only.',
            layout: 'layout',
        });
    }

    next();
};

// create one for isBoardingManager
exports.isBoardingManager = (req, res, next) => {
    // First check authentication
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        return res.redirect('/login');
    }

    // Check role
    if (req.session.userRole !== 'boarding_manager') {
        logger.warn(
            `Unauthorized access attempt to boarding manager area by user ${req.session.userId} with role ${req.session.userRole}`
        );
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Boarding Manager privileges required.',
            });
        }
        // Redirect to appropriate dashboard based on their actual role
        if (['manager', 'supervisor'].includes(req.session.userRole)) {
            return res.redirect('/manager/dashboard');
        }
        if (req.session.userRole === 'tenant') {
            return res.redirect('/tenant/dashboard');
        }
        return res.render('error', {
            title: 'Access Denied',
            message: 'This area is for boarding managers only.',
            layout: 'layout',
        });
    }
    next();
};

// Helper: Redirect to appropriate dashboard based on role
function redirectToDashboard(role, res) {
    switch (role) {
        case 'manager':
        case 'supervisor':
            return res.redirect('/manager/dashboard');
        case 'tenant':
            return res.redirect('/tenant/dashboard');
        case 'boarding_manager':
            return res.redirect('/boarding/dashboard');
        case 'electrician':
        case 'plumber':
        case 'general_repair':
            return res.redirect('/technician/dashboard');
        default:
            return res.redirect('/dashboard');
    }
}

// Get Forgot Password Page
exports.getForgotPassword = (req, res) => {
    res.render('forgot-password', {
        title: 'Forgot Password - PM',
        description: 'Reset your password',
        additionalCSS: ['login.css'],
        additionalJS: ['forgot-password.js'],
        layout: 'layout',
        error: req.flash ? req.flash('error') : null,
        success: req.flash ? req.flash('success') : null,
    });
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email address',
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // Don't reveal if user exists for security
            return res.json({
                success: true,
                message: 'If an account with that email exists, a reset link has been sent.',
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save reset token and expiry to user (expires in 1 hour)
        user.passwordResetToken = resetTokenHash;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetURL = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;

        // Send email
        await emailService.sendPasswordResetEmail(user, resetURL);

        res.json({
            success: true,
            message: 'If an account with that email exists, a reset link has been sent.',
        });
    } catch (error) {
        logger.error('Forgot password error:', error);

        // Clear reset token if email fails
        if (error.user) {
            error.user.passwordResetToken = undefined;
            error.user.passwordResetExpires = undefined;
            await error.user.save({ validateBeforeSave: false });
        }

        res.status(500).json({
            success: false,
            message: 'An error occurred sending the reset email. Please try again.',
        });
    }
};

// Get Reset Password Page
exports.getResetPassword = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.render('error', {
            title: 'Invalid Link',
            message: 'This password reset link is invalid.',
            layout: 'layout',
        });
    }

    // Hash the token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
        return res.render('error', {
            title: 'Invalid or Expired Link',
            message:
                'This password reset link is invalid or has expired. Please request a new one.',
            layout: 'layout',
        });
    }

    // Render reset password page
    res.render('reset-password', {
        title: 'Reset Password - CasaConnect',
        description: 'Create a new password',
        additionalCSS: ['login.css'],
        additionalJS: ['reset-password.js'],
        layout: 'layout',
        token: token,
        email: user.email,
    });
};

// Process Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Validate input
        if (!password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both password fields',
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
        }

        // Hash the token to compare with database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token',
            });
        }

        // Update password
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        logger.info(`Password reset successful for user: ${user.email}`);

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.',
        });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred resetting your password. Please try again.',
        });
    }
};
