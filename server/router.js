// routes/index.js (or wherever this Router lives)
const express = require("express");
require("dotenv").config();
const route = express.Router();

// Controllers
const tenantController = require("./controllers/tenantController");
const authController = require("./controllers/authController");
const managerController = require("./controllers/managerController");

// Pull the middlewares
const { isAuthenticated, isManager, isTenant, attachUserToLocals } = authController;

// Make current user available to templates (safe if not logged in)
route.use(attachUserToLocals);

// *********** Public (auth) pages **********
route.get("/", authController.getLogin);
route.get("/login", authController.getLogin);
route.get("/logout", authController.logout);
route.post("/auth/login", authController.login);

// *********** MANAGER: protect both web and API ***********
// Any /manager/* page requires login + manager/supervisor
route.use("/manager", isAuthenticated, isManager);
// Any /api/manager/* also requires login + manager/supervisor
route.use("/api/manager", isAuthenticated, isManager);

// Manager Routes - GET (web)
route.get("/manager", managerController.getDashboard);
route.get("/manager/dashboard", managerController.getDashboard);
route.get("/manager/tenants", managerController.getTenants);
route.get("/manager/units", managerController.getUnits);
route.get("/manager/service-requests", managerController.getServiceRequests);

// Manager API Routes - GET
route.get("/api/manager/dashboard-stats", managerController.getDashboardStats);
route.get("/api/manager/units/stats", managerController.getUnitsStats);
route.get("/api/manager/service-requests/updates", managerController.checkRequestUpdates);

// Tenants API (manager actions)
route.post("/manager/send-credentials", managerController.sendCredentials);
route.post("/manager/tenant/:tenantId/update", managerController.updateTenant);
route.get("/manager/tenant/:tenantId", managerController.viewTenant);
route.get("/manager/tenant/:tenantId/edit", managerController.editTenant);
route.post("/api/manager/tenant/assign-unit", managerController.assignUnitToTenant);
route.post("/api/manager/unit/assign-tenant", managerController.assignTenantToUnit);
route.delete("/api/manager/tenant/:tenantId", managerController.deleteTenant);

// Units API
route.post("/api/manager/units", managerController.createUnit);
route.get("/api/manager/units/:unitId", managerController.getUnit);
route.put("/api/manager/units/:unitId", managerController.updateUnit);
route.delete("/api/manager/units/:unitId", managerController.deleteUnit);

// Service Requests API
route.post("/api/manager/service-requests/assign", managerController.assignTechnician);
route.post("/api/manager/service-requests/note", managerController.addRequestNote);
route.put("/api/manager/service-requests/:requestId/status", managerController.updateRequestStatus);
route.put("/api/manager/service-requests/:requestId/cancel", managerController.cancelRequest);

// *********** TENANT: protect tenant areas ***********
route.use("/tenant", isAuthenticated, isTenant);
route.use("/api/tenant", isAuthenticated, isTenant);

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
