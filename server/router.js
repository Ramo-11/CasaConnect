const express = require("express");
require('dotenv').config();

const route = express.Router();

// Import Controllers
const tenantController = require('./controllers/tenantController');
const authController = require('./controllers/authController');
const managerController = require('./controllers/managerController');

// *********** GET requests **********
route.get("/", authController.getLogin);
route.get("/login", authController.getLogin);
route.get("/logout", authController.logout);

// Manager Routes - GET
route.get("/manager", managerController.getDashboard);
route.get("/manager/dashboard", managerController.getDashboard);
route.get("/manager/tenant/:tenantId", managerController.viewTenant);
route.get("/manager/tenant/:tenantId/edit", managerController.editTenant);
route.get("/manager/units", managerController.getUnits);
route.get("/manager/service-requests", managerController.getServiceRequests);

// Manager API Routes - GET (specific routes before parameterized routes)
route.get("/api/manager/dashboard-stats", managerController.getDashboardStats);
route.get("/api/manager/units/stats", managerController.getUnitsStats);
route.get("/api/manager/service-requests/updates", managerController.checkRequestUpdates);

// Units API - CRUD operations
route.post("/api/manager/units", managerController.createUnit);
route.get("/api/manager/units/:unitId", managerController.getUnit);
route.put("/api/manager/units/:unitId", managerController.updateUnit);
route.delete("/api/manager/units/:unitId", managerController.deleteUnit);

// Service Requests API
route.post("/api/manager/service-requests/assign", managerController.assignTechnician);
route.post("/api/manager/service-requests/note", managerController.addRequestNote);
route.put("/api/manager/service-requests/:requestId/status", managerController.updateRequestStatus);
route.put("/api/manager/service-requests/:requestId/cancel", managerController.cancelRequest);

// Manager Routes - POST
route.post("/manager/tenants", managerController.createTenant);
route.post("/manager/send-credentials", managerController.sendCredentials);
route.post("/manager/tenant/:tenantId/update", managerController.updateTenant);

// Tenant Routes
route.get("/tenant", tenantController.getDashboard);
route.get("/tenant/dashboard", tenantController.getDashboard);
route.get("/tenant/payment-status", tenantController.getPaymentStatus);
route.get("/tenant/notifications", tenantController.getNotifications);

// *********** POST requests **********
route.post("/auth/login", authController.login);

// Manager Routes
route.post("/manager/tenants", managerController.createTenant);
route.get("/manager/tenant/:tenantId", managerController.viewTenant);
route.post("/manager/send-credentials", managerController.sendCredentials);
route.post("/manager/tenant/:tenantId/update", managerController.updateTenant);
route.get("/api/manager/dashboard-stats", managerController.getDashboardStats);

// Tenant Routes
route.post("/tenant/payment", tenantController.processPayment);
route.post("/tenant/service-request", tenantController.submitServiceRequest);
route.post("/tenant/notification/:notificationId/read", tenantController.markNotificationRead);

// *********** API Routes (for AJAX) **********
route.get("/api/tenant/:tenantId/payment-status", tenantController.getPaymentStatus);
route.get("/api/tenant/:tenantId/notifications", tenantController.getNotifications);

module.exports = route;