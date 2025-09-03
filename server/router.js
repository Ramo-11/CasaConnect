// routes/index.js (or wherever this Router lives)
const express = require("express");
require("dotenv").config();
const route = express.Router();

// Controllers
const authController = require("./controllers/authController");
const managerController = require("./controllers/managerController");

// Tenant Controllers
const tenantDashboard = require("./controllers/tenant/dashboardController");
const tenantAccount = require("./controllers/tenant/accountController");
const tenantPayment = require("./controllers/tenant/paymentController");
const tenantNotifications = require("./controllers/tenant/notificationController");
const tenantServiceRequest = require("./controllers/tenant/serviceRequestController");

// Management Controllers
const tenantManagement = require("./controllers/management/tenantManagement");
const leaseManagement = require("./controllers/management/leaseManagement");
const unitManagement = require("./controllers/management/unitManagement");
const serviceRequestManagement = require("./controllers/management/serviceRequestManagement");
const documentManagement = require("./controllers/management/documentManagement");

const multer = require('multer');
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Pull the middlewares
const { isAuthenticated, isManager, isTenant, attachUserToLocals } = authController;

// Development bypass - modify session AFTER it exists
const isDevelopment = process.env.NODE_ENV !== "production";
// const managerMiddleware = isDevelopment ? (req, res, next) => next() : isManager;
// const tenantMiddleware = isDevelopment ? (req, res, next) => next() : isTenant;
const managerMiddleware = isManager;
const tenantMiddleware = isTenant;
const authMiddleware = isAuthenticated;

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
route.post("/manager/tenant/:tenantId/update", tenantManagement.updateTenant);
route.post("/api/manager/tenant/send-credentials", tenantManagement.sendCredentials);
route.get("/manager/tenant/:tenantId", tenantManagement.viewTenant);
route.get("/manager/tenant/:tenantId/edit", tenantManagement.editTenant);
route.delete("/api/manager/tenant/:tenantId", tenantManagement.deleteTenant);
route.post("/api/manager/tenant/reset-password", tenantManagement.resetPassword);
route.put("/api/manager/tenant/:tenantId/suspend", tenantManagement.suspendAccount);
route.put("/api/manager/tenant/:tenantId/activate", tenantManagement.activateAccount);
route.get("/api/manager/tenant/:tenantId/export", tenantManagement.exportTenantData);

// Document Management Routes
route.post("/api/manager/documents", upload.single('file'), documentManagement.uploadDocument);
route.get("/api/manager/documents", documentManagement.getDocuments);
route.delete("/api/manager/documents/:documentId", documentManagement.deleteDocument);

// Lease Management Routes
route.post("/api/manager/lease/create", upload.single('document'), leaseManagement.createLease);
route.put("/api/manager/lease/:leaseId", leaseManagement.updateLease);
route.post("/api/manager/lease/:leaseId/terminate", leaseManagement.terminateLease);
route.delete("/api/manager/lease/:leaseId", leaseManagement.deleteLease);
route.post("/api/manager/lease/:leaseId/renew", upload.single('document'), leaseManagement.renewLease);
route.get("/api/manager/lease/:leaseId", leaseManagement.getLease);
route.get("/api/manager/leases", leaseManagement.getLeases);
route.post("/api/manager/tenant/assign-unit", leaseManagement.assignUnitToTenant);
route.post("/api/manager/unit/assign-tenant", leaseManagement.assignTenantToUnit);
route.get("/manager/lease/:leaseId", leaseManagement.getLeaseDetails);
route.post("/api/manager/lease/:leaseId/email", leaseManagement.emailLeaseToTenant);
route.get("/manager/lease/:leaseId/renew", leaseManagement.getLeaseRenewal);

// Units Management Routes
route.get("/manager/units", unitManagement.getUnits);
route.get("/manager/units/:unitId", unitManagement.viewUnit);
route.get("/manager/units/:unitId/edit", unitManagement.editUnit);
route.get("/api/manager/units/available", unitManagement.getAvailableUnits);
route.post("/api/manager/units", unitManagement.createUnit);
route.get("/api/manager/units/:unitId", unitManagement.getUnit);
route.delete("/api/manager/units/:unitId", unitManagement.deleteUnit);
route.get("/api/manager/units/stats", unitManagement.getUnitsStats);
route.put("/api/manager/units/:unitId", unitManagement.updateUnit);

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
route.get("/tenant", tenantDashboard.getDashboard);
route.get("/tenant/dashboard", tenantDashboard.getDashboard);
route.get("/tenant/settings", tenantAccount.getSettings);
route.get("/tenant/lease/:leaseId", tenantDashboard.getLeaseDetails);

// Tenant actions
route.post("/tenant/payment", tenantPayment.processPayment);
route.post("/tenant/service-request", tenantServiceRequest.submitServiceRequest);
route.post("/tenant/change-password", tenantAccount.changePassword);

// Tenant APIs
route.get("/api/tenant/payment-status", tenantPayment.getPaymentStatus);
route.get("/api/tenant/payment-history", tenantPayment.getPaymentHistory);
route.get("/api/tenant/notifications", tenantNotifications.getNotifications);
route.post("/api/tenant/notification/:notificationId/read", tenantNotifications.markNotificationRead);
route.post("/api/tenant/notifications/mark-all-read", tenantNotifications.markAllRead);
route.get("/api/tenant/documents", tenantDashboard.getTenantDocuments);

// Shared document routes (with access control in the controller)
route.get("/api/documents/:documentId/view", authMiddleware, documentManagement.viewDocument);
route.get("/api/documents/:documentId/download", authMiddleware, documentManagement.downloadDocument);

module.exports = route;