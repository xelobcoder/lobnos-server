"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinicianHandlers = __importStar(require("./cliniciansHandlers"));
const ClinicianPaymentHandler_1 = require("./ClinicianPaymentHandler");
const helper_1 = require("../../hooks/helper");
const router = (0, express_1.Router)();
router.get("/api/v1/clinicians", (0, helper_1.handleOverLoad)(clinicianHandlers.getCliniciansHandler));
router.get("/api/v1/clinicians/getclinician", (0, helper_1.handleOverLoad)(clinicianHandlers.getSingleClinicianHandler));
router.put("/api/v1/clinicians", clinicianHandlers.putCliniciansHandler);
router.delete("/api/v1/clinicians", clinicianHandlers.deleteCliniciansHandler);
router.post("/api/v1/clinicians", clinicianHandlers.postCliniciansHandler);
router.post("/api/v1/client/filter/clinician", clinicianHandlers.filterClinicianHandler);
router.get("/api/v1/clinician/resultsets", clinicianHandlers.getClinicianResultHandler);
router.get("/api/v1/clinician/resultsets/billingid", clinicianHandlers.getBillingTestBasedByClinicianHandler);
router.post("/api/v1/orders/temporary", clinicianHandlers.postTemporaryOrderHandler);
router.get("/api/v1/orders/temporary", clinicianHandlers.getTemporaryOrdersHandler);
router.get("/api/v1/orders/temporary/processing", clinicianHandlers.getTemporaryOrdersProcessingHandler);
router.post("/api/v1/orders/processed", clinicianHandlers.postProcessedOrderHandler);
const billingStrategyHandler_1 = require("./billingStrategyHandler");
router.post('/api/v1/billing/strategies', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.createBillingStrategy));
router.get('/api/v1/billing/strategies/all', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.getAllBillingStrategies));
router.get('/api/v1/billing/strategies/check/:strategyid', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.checkStrategyExists));
router.get('/api/v1/billing/strategies/:strategyid', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.getBillingStrategy));
router.put('/api/v1/billing/strategies/:strategyid', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.updateBillingStrategy));
router.delete('/api/v1/billing/strategies/:strategyid', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.deleteBillingStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid/has-strategy', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.checkEntityHasStrategy));
router.get('/api/v1/billing/strategies/:entityType/:entityid', (0, helper_1.handleOverLoad)(billingStrategyHandler_1.getEntityBillingStrategy));
// payment routes of the clinicians
const clinicianPaymentHandler = new ClinicianPaymentHandler_1.ClinicianPaymentHandler();
router.put('/api/v1/clinicians/payments/:id', (req, res) => clinicianPaymentHandler.createPayment(req, res));
router.get('/api/v1/clinicians/payments/:id', (req, res) => clinicianPaymentHandler.getPaymentById(req, res));
router.get('/api/v1/clinicians/payments/clinician/:clinicianId', (req, res) => clinicianPaymentHandler.getPaymentsByClinicianId(req, res));
exports.default = router;
