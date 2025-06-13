"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("./controllers");
const servicesHandler_1 = require("./servicesHandler");
const handlerAscensionBillingCheck_1 = require("../../middleware/redis/handlerAscensionBillingCheck");
const BillingHandler_1 = require("./BillingHandler");
const handler_1 = require("./SessionManger/handler");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const router = (0, express_1.Router)();
// Billing Routes
router.post("/api/v1/billing", controllers_1.handleNewBilling);
router.get("/api/v1/billing/send/receipt/email/:patientid/:billingid", controllers_1.handleEmailReceiptSending);
router.put("/api/v1/billing", validateTenancy_1.isAuthorizedRoleAdmin, controllers_1.updateBilledTransaction);
router.get("/api/v1/billing/caninitialbill", controllers_1.canInitiateBill);
router.get("/api/v1/billing/information/single", controllers_1.getSavedCLientBillingInformation);
router.post(`/api/v1/billing/previous/request/refund`, controllers_1.determineStageOfRefundRequestHandler);
router.post(`/api/v1/billing/previous/request/refund/update`, controllers_1.requestForRefundHandler);
router.post("/api/v1/billing/previous/refund/update/previous", controllers_1.updateWitnessWitnessNote);
router.post("/api/v1/billing/previous/refund/update/approve", validateTenancy_1.isAuthorizedRoleAdmin, controllers_1.approveRequestForRefund);
router.post("/api/v1/billing/previous/refund/update/cashout", controllers_1.requestForRefundCashIssueOut);
router.get("/api/v1/billing/previous/refund/update/verification/cashout", controllers_1.verificationBeforeCashoutHandler);
router.get("/api/v1/billing/filtering/service/refund", controllers_1.getServiceRefundItem);
router.get("/api/v1/billing/previous/transaction/data", controllers_1.getTransactionBillDataHandler);
router.get("/api/v1/billing/previous/refund/all/:billingid/:employeeid/:selectedPaymentMode", handlerAscensionBillingCheck_1.handleAuthenticationEmployee, controllers_1.refundAllTransactionHandler);
// Services Routes
router.post("/api/v1/billing/services", servicesHandler_1.createServicesHandler);
router.put("/api/v1/billing/services", servicesHandler_1.updateServicesHandler);
router.get("/api/v1/billing/services/specific", servicesHandler_1.getAservicesHandler);
router.get("/api/v1/billing/services", servicesHandler_1.getAllservicesHandler);
router.delete("/api/v1/billing/services", servicesHandler_1.deleteServicesHandler);
// Refund Routes
router.get("/api/v1/billing/refund/details/status", controllers_1.getAlRefundsPaginationHandler);
// patient transactions 
router.get('/api/v1/billing/patient/transactions', BillingHandler_1.getPatientTransactions);
router.get('/api/v1/billing/patient/transactions/:billingid', BillingHandler_1.getPatientTransactionDetails);
// sales session
router.post("/api/v1/billing/sales/session/create", handler_1.handleCreateNewSalesSesion);
router.get("/api/v1/billing/sales/session/list", handler_1.getSalesSessionList);
router.put("/api/v1/billing/sales/session/endsession", handler_1.handleEndSalesSession);
router.get('/api/v1/billing/sales/session/verify/session', handler_1.hasSalesSessionAvailableHandler);
exports.default = router;
