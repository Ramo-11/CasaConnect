// routes/index.js (or wherever this Router lives)
const express = require("express");
require("dotenv").config();
const route = express.Router();

// Controllers
const authController = require("./controllers/authController");
const tenantController = require("./controllers/tenantController");
const managerController = require("./controllers/managerController");

// Management Controllers
const tenantManagement = require("./controllers/management/tenantManagement");
const leaseManagement = require("./controllers/management/leaseManagement");
const unitManagement = require("./controllers/management/unitManagement");
const serviceRequestManagement = require("./controllers/management/serviceRequestManagement");

// Pull the middlewares
const { isAuthenticated, isManager, isTenant, attachUserToLocals } = authController;

// Development bypass - modify session AFTER it exists
const isDevelopment = process.env.NODE_ENV !== "production";
const authMiddleware = isDevelopment
    ? (req, res, next) => {
          // Mock session data for development
          if (req.session) {
              req.session.userId = "507f1f77bcf86cd799439011"; // mock manager ID
              req.session.userRole = "manager";
              req.session.userName = "Dev Manager";
          }
          next();
      }
    : isAuthenticated;

const managerMiddleware = isDevelopment ? (req, res, next) => next() : isManager;
const tenantMiddleware = isDevelopment ? (req, res, next) => next() : isTenant;

// Make current user available to templates (safe if not logged in)
route.use(attachUserToLocals);

// *********** Public (auth) pages **********
route.get("/", authController.getLogin);
route.get("/login", authController.getLogin);
route.get("/logout", authController.logout);
route.post("/auth/login", authController.login);

// *********** MANAGER: protect both web and API ***********
route.use("/manager", authMiddleware, managerMiddleware);
route.use("/api/manager", authMiddleware, managerMiddleware);

// Manager Dashboard Routes (keep in main managerController)
route.get("/manager", managerController.getDashboard);
route.get("/manager/dashboard", managerController.getDashboard);
route.get("/api/manager/dashboard-stats", managerController.getDashboardStats);

// Tenant Management Routes
route.get("/manager/tenants", tenantManagement.getTenants);
route.post("/manager/tenants", tenantManagement.createTenant);
route.post("/manager/send-credentials", tenantManagement.sendCredentials);
route.post("/manager/tenant/:tenantId/update", tenantManagement.updateTenant);
route.get("/manager/tenant/:tenantId", tenantManagement.viewTenant);
route.get("/manager/tenant/:tenantId/edit", tenantManagement.editTenant);
route.delete("/api/manager/tenant/:tenantId", tenantManagement.deleteTenant);

// Lease Management Routes
route.post("/api/manager/lease", leaseManagement.createLease);
route.put("/api/manager/lease/:leaseId", leaseManagement.updateLease);
route.post("/api/manager/lease/:leaseId/terminate", leaseManagement.terminateLease);
route.post("/api/manager/lease/:leaseId/renew", leaseManagement.renewLease);
route.get("/api/manager/lease/:leaseId", leaseManagement.getLease);
route.get("/api/manager/leases", leaseManagement.getLeases);
route.post("/api/manager/tenant/assign-unit", leaseManagement.assignUnitToTenant);
route.post("/api/manager/unit/assign-tenant", leaseManagement.assignTenantToUnit);

// Units Management Routes
route.get("/manager/units", unitManagement.getUnits);
route.post("/api/manager/units", unitManagement.createUnit);
route.get("/api/manager/units/:unitId", unitManagement.getUnit);
route.put("/api/manager/units/:unitId", unitManagement.updateUnit);
route.delete("/api/manager/units/:unitId", unitManagement.deleteUnit);
route.get("/api/manager/units/stats", unitManagement.getUnitsStats);

// Service Requests Management Routes
route.get("/manager/service-requests", serviceRequestManagement.getServiceRequests);
route.post("/api/manager/service-requests/assign", serviceRequestManagement.assignTechnician);
route.post("/api/manager/service-requests/note", serviceRequestManagement.addRequestNote);
route.put("/api/manager/service-requests/:requestId/status", serviceRequestManagement.updateRequestStatus);
route.put("/api/manager/service-requests/:requestId/cancel", serviceRequestManagement.cancelRequest);
route.get("/api/manager/service-requests/updates", serviceRequestManagement.checkRequestUpdates);

// *********** TENANT: protect tenant areas ***********
route.use("/tenant", authMiddleware, tenantMiddleware);
route.use("/api/tenant", authMiddleware, tenantMiddleware);

// Tenant web pages
route.get("/tenant", tenantController.getDashboard);
route.get("/tenant/dashboard", tenantController.getDashboard);
route.get("/tenant/payment-status", tenantController.getPaymentStatus);
route.get("/tenant/notifications", tenantController.getNotifications);

// Tenant actions
route.post("/tenant/payment", tenantController.processPayment);
route.post("/tenant/service-request", tenantController.submitServiceRequest);
route.post("/tenant/notification/:notificationId/read", tenantController.markNotificationRead);

// *********** Tenant APIs (AJAX) ***********
route.get("/api/tenant/:tenantId/payment-status", tenantController.getPaymentStatus);
route.get("/api/tenant/:tenantId/notifications", tenantController.getNotifications);

module.exports = route;