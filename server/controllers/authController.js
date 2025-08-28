const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logger } = require("../logger");

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

    res.render("login", {
        title: "Login - CasaConnect",
        description: "Welcome to CasaConnect",
        additionalCSS: ["login.css"],
        additionalJS: ["login.js"],
        layout: "layout",
        error: req.flash ? req.flash("error") : null,
        success: req.flash ? req.flash("success") : null,
    });
};

// Process Login
exports.login = async (req, res) => {
    try {
        const { email, password, remember } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password",
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            logger.error(`Login failed - User not found: ${email}`);
            return res.status(401).json({
                success: false,
                message: "Invalid email",
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    "Your account has been deactivated. Please contact management.",
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            logger.error(`Login failed - Invalid password for user: ${email}`);
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Create session
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.fullName;

        // Set session expiry based on remember me
        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        }

        // Generate JWT token (optional, for API access)
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role,
            },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: remember ? "30d" : "24h",
            }
        );

        // Store token in session
        req.session.token = token;

        // Return success with role for frontend routing
        res.json({
            success: true,
            message: "Login successful",
            role: user.role,
            user: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during login. Please try again.",
        });
    }
};

// Logout
exports.logout = (req, res) => {
    // Destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
        }

        // Clear cookie
        res.clearCookie("connect.sid");

        // Redirect to login
        res.redirect("/login");
    });
};

// Middleware: Check if authenticated
exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }

    // For API routes, return JSON error
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }

    // For web routes, redirect to login
    if (req.flash) {
        req.flash("error", "Please login to continue");
    }
    res.redirect("/login");
};

// Middleware: Check role
exports.hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (!roles.includes(req.session.userRole)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Insufficient permissions.",
            });
        }

        next();
    };
};

// Middleware: Check if manager or supervisor
exports.isManager = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        return res.redirect("/login");
    }

    if (!["manager", "supervisor"].includes(req.session.userRole)) {
        return res.status(403).render("error", {
            title: "Access Denied",
            message: "You do not have permission to access this area.",
        });
    }

    next();
};

// Middleware: Check if tenant
exports.isTenant = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith("/api/")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        return res.redirect("/login");
    }

    if (req.session.userRole !== "tenant") {
        return res.status(403).render("error", {
            title: "Access Denied",
            message: "This area is for tenants only.",
        });
    }

    next();
};

// Helper: Redirect to appropriate dashboard based on role
function redirectToDashboard(role, res) {
    switch (role) {
        case "manager":
        case "supervisor":
            return res.redirect("/manager/dashboard");
        case "tenant":
            return res.redirect("/tenant/dashboard");
        case "electrician":
        case "plumber":
        case "general_repair":
            return res.redirect("/technician/dashboard");
        default:
            return res.redirect("/dashboard");
    }
}

// Forgot Password (placeholder)
exports.forgotPassword = async (req, res) => {
    // Implement password reset logic
    res.json({
        success: false,
        message: "Password reset functionality coming soon",
    });
};

// Reset Password (placeholder)
exports.resetPassword = async (req, res) => {
    // Implement password reset logic
    res.json({
        success: false,
        message: "Password reset functionality coming soon",
    });
};
