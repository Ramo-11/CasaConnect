// routes/index.js
const express = require("express");
require("dotenv").config();

// Core router
const router = express.Router();

// Controllers
const authController = require("./controllers/authController");
const managerController = require("./controllers/managerController");

// Tenant Controllers
const tenantDashboard = require("./controllers/tenant/dashboardController");
const tenantAccount = require("./controllers/tenant/accountController");
const tenantPayment = require("./controllers/tenant/paymentController");
const tenantPaymentMethod = require("./controllers/tenant/paymentMethodController");
const tenantNotifications = require("./controllers/tenant/notificationController");
const tenantServiceRequest = require("./controllers/tenant/serviceRequestController");

// Management Controllers
const tenantManagement = require("./controllers/management/tenantManagement");
const leaseManagement = require("./controllers/management/leaseManagement");
const unitManagement = require("./controllers/management/unitManagement");
const serviceRequestManagement = require("./controllers/management/serviceRequestManagement");
const documentManagement = require("./controllers/management/documentManagement");

// Uploads
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
const { handleMulterError } = require('./services/storageService');

// Auth middlewares
const { isAuthenticated, isManager, isTenant, attachUserToLocals } = authController;

// Make current user available to templates (safe if not logged in)
router.use(attachUserToLocals);

/**
 * PUBLIC (Auth)
 */
router.get(["/", "/login"], authController.getLogin);
router.get("/logout", authController.logout);
router.post("/auth/login", authController.login);

/**
 * MANAGER (Web + API)
 */
const managerWeb = express.Router();
const managerAPI = express.Router();

// protect
managerWeb.use(isAuthenticated, isManager);
managerAPI.use(isAuthenticated, isManager);

// Manager: Dashboard
managerWeb.get(["/", "/dashboard"], managerController.getDashboard);
managerAPI.get("/dashboard-stats", managerController.getDashboardStats);

// Manager: Tenant Management
managerWeb.get("/tenants", tenantManagement.getTenants);
managerWeb.get("/tenant/:tenantId", tenantManagement.viewTenant);
managerWeb.get("/tenant/:tenantId/edit", tenantManagement.editTenant);

managerAPI.post("/tenants", tenantManagement.createTenant);
managerAPI.post("/tenant/:tenantId/update", tenantManagement.updateTenant);
managerAPI.post("/tenant/send-credentials", tenantManagement.sendCredentials);
managerAPI.delete("/tenant/:tenantId", tenantManagement.deleteTenant);
managerAPI.post("/tenant/reset-password", tenantManagement.resetPassword);
managerAPI.put("/tenant/:tenantId/suspend", tenantManagement.suspendAccount);
managerAPI.put("/tenant/:tenantId/activate", tenantManagement.activateAccount);
managerAPI.get("/tenant/:tenantId/export", tenantManagement.exportTenantData);

// Manager: Document Management
managerAPI.post("/documents", upload.single("file"), documentManagement.uploadDocument);
managerAPI.get("/documents", documentManagement.getDocuments);
managerAPI.delete("/documents/:documentId", documentManagement.deleteDocument);

// Manager: Lease Management
managerWeb.get("/lease/:leaseId", leaseManagement.getLeaseDetails);
managerWeb.get("/lease/:leaseId/renew", leaseManagement.getLeaseRenewal);

managerAPI.post("/lease/create", upload.single("document"), leaseManagement.createLease);
managerAPI.get("/lease/:leaseId", leaseManagement.getLease);
managerAPI.get("/leases", leaseManagement.getLeases);
managerAPI.put("/lease/:leaseId", leaseManagement.updateLease);
managerAPI.post("/lease/:leaseId/terminate", leaseManagement.terminateLease);
managerAPI.delete("/lease/:leaseId", leaseManagement.deleteLease);
managerAPI.post("/lease/:leaseId/renew", upload.single("document"), leaseManagement.renewLease);
managerAPI.post("/lease/:leaseId/email", leaseManagement.emailLeaseToTenant);
managerAPI.post("/tenant/assign-unit", leaseManagement.assignUnitToTenant);
managerAPI.post("/unit/assign-tenant", leaseManagement.assignTenantToUnit);

// Manager: Units
managerWeb.get("/units", unitManagement.getUnits);
managerWeb.get("/units/:unitId", unitManagement.viewUnit);
managerWeb.get("/units/:unitId/edit", unitManagement.editUnit);

managerAPI.get("/units/available", unitManagement.getAvailableUnits);
managerAPI.get("/units/:unitId", unitManagement.getUnit);
managerAPI.get("/units/stats", unitManagement.getUnitsStats);
managerAPI.post("/units", unitManagement.createUnit);
managerAPI.put("/units/:unitId", unitManagement.updateUnit);
managerAPI.delete("/units/:unitId", unitManagement.deleteUnit);

// Manager: Service Requests
managerWeb.get("/service-requests", serviceRequestManagement.getServiceRequests);
managerAPI.post("/service-requests/assign", serviceRequestManagement.assignTechnician);
managerAPI.post("/service-requests/note", serviceRequestManagement.addRequestNote);
managerAPI.put("/service-requests/:requestId/status", serviceRequestManagement.updateRequestStatus);
managerAPI.put("/service-requests/:requestId/cancel", serviceRequestManagement.cancelRequest);
managerAPI.get("/service-requests/updates", serviceRequestManagement.checkRequestUpdates);

// Mount Manager routers
router.use("/manager", managerWeb);
router.use("/api/manager", managerAPI);

/**
 * TENANT (Web + API)
 */
const tenantWeb = express.Router();
const tenantAPI = express.Router();

// protect
tenantWeb.use(isAuthenticated, isTenant);
tenantAPI.use(isAuthenticated, isTenant);

// Tenant: Web pages
tenantWeb.get(["/", "/dashboard"], tenantDashboard.getDashboard);
tenantWeb.get("/settings", tenantAccount.getSettings);
tenantWeb.get("/lease/:leaseId", tenantDashboard.getLeaseDetails);

// Tenant: Web actions
tenantWeb.post("/payment", tenantPayment.processPayment);
tenantWeb.post("/change-password", tenantAccount.changePassword);

// Tenant: API - Payments
tenantAPI.post("/payment/create-intent", tenantPayment.createPaymentIntent);
tenantAPI.post("/payment/confirm", tenantPayment.confirmPayment);
tenantAPI.get("/payment-status", tenantPayment.getPaymentStatus);
tenantAPI.get("/payment-history", tenantPayment.getPaymentHistory);
tenantAPI.post("/payment/process", tenantPayment.processPaymentWithSavedMethod);

// Tenant: API - Payment Methods (single, non-duplicated set)
tenantAPI.get("/payment-methods", tenantPaymentMethod.getPaymentMethods);
tenantAPI.delete("/payment-method/:methodId", tenantPaymentMethod.deletePaymentMethod);
tenantAPI.put("/payment-method/:methodId/default", tenantPaymentMethod.setDefaultPaymentMethod);
tenantAPI.post("/payment-methods/setup-intent", tenantPaymentMethod.createSetupIntent);
tenantAPI.post("/payment-methods", tenantPaymentMethod.saveFromPaymentMethod);

// Tenant: API - Notifications
tenantAPI.get("/notifications", tenantNotifications.getNotifications);
tenantAPI.post("/notification/:notificationId/read", tenantNotifications.markNotificationRead);
tenantAPI.post("/notifications/mark-all-read", tenantNotifications.markAllRead);

// Tenant: API - Documents & Service Requests
tenantAPI.get("/documents", tenantDashboard.getTenantDocuments);
tenantAPI.get("/service-requests", tenantServiceRequest.getServiceRequests);
tenantAPI.post("/service-request", tenantServiceRequest.upload.array('photos', 3), handleMulterError, tenantServiceRequest.submitServiceRequest);
tenantAPI.post("/service-fee/create-intent", tenantServiceRequest.createServiceFeeIntent);

// Mount Tenant routers
router.use("/tenant", tenantWeb);
router.use("/api/tenant", tenantAPI);

/**
 * SHARED (Auth required)
 */
router.get("/api/documents/:documentId/view", isAuthenticated, documentManagement.viewDocument);
router.get("/api/documents/:documentId/download", isAuthenticated, documentManagement.downloadDocument);

module.exports = router;
