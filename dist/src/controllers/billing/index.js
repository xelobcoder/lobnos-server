"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("./controllers");
const servicesHandler_1 = require("./servicesHandler");
const handlerAscensionBillingCheck_1 = require("../../middleware/redis/handlerAscensionBillingCheck");
const BillingHandler_1 = require("./BillingHandler");
const handler_1 = require("./SessionManger/handler");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const helper_1 = require("../../hooks/helper");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const PrimeBillingCampaignController_1 = require("./PrimeBillingCampaignController");
const PrimePromoCode_1 = require("./PrimePromoCode");
const handler_2 = require("../applicationsettings/handler");
const TransactionManagementController_1 = require("../../models/billing/management/TransactionManagementController");
const router = (0, express_1.Router)();
// Billing Routes
router.post("/api/v1/billing", controllers_1.handleNewBilling);
// router.post("/api/v1/billing/multi", handleMultiNewBilling);   obsolote now replaced with /api/v1/billing/multi/submit for better flow control and error handling in multi billing process
router.put('/api/v1/billing/pending/remove/service', (0, helper_1.handleOverLoad)(handler_2.removePendingNonPaidServicesHandler));
router.get('/api/v1/outstanding/report/combined', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.outstandingReport));
router.get("/api/v1/billing/multi/init", (0, helper_1.handleOverLoad)(handler_2.initializeBillingHandler));
router.post("/api/v1/billing/multi/checkout", (0, helper_1.handleOverLoad)(handler_2.checkoutBillingHandler));
router.post("/api/v1/billing/multi/submit", (0, helper_1.handleOverLoad)(handler_2.submitBillingHandler));
router.put('/api/v1/billing/multi', controllers_1.handleMultiUpdateBilling);
router.put("/api/v1/billing", validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.updateBilledTransaction));
router.get("/api/v1/billing/caninitialbill", controllers_1.canInitiateBill);
router.get("/api/v1/billing/information/single", controllers_1.getSavedCLientBillingInformation);
router.post(`/api/v1/billing/previous/request/refund`, controllers_1.determineStageOfRefundRequestHandler);
router.post(`/api/v1/billing/previous/request/refund/update`, (0, helper_1.handleOverLoad)(controllers_1.requestForRefundHandler));
router.post("/api/v1/billing/previous/refund/update/previous", (0, helper_1.handleOverLoad)(controllers_1.updateWitnessWitnessNote));
router.post("/api/v1/billing/previous/refund/update/approve", validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.approveRequestForRefund));
router.post("/api/v1/billing/previous/refund/update/cashout", controllers_1.requestForRefundCashIssueOut);
router.get("/api/v1/billing/previous/refund/update/verification/cashout", controllers_1.verificationBeforeCashoutHandler);
router.get("/api/v1/billing/filtering/service/refund", controllers_1.getServiceRefundItem);
router.get("/api/v1/billing/previous/transaction/data", controllers_1.getTransactionBillDataHandler);
router.get("/api/v1/billing/previous/refund/all/:billingid/:employeeid/:selectedPaymentMode", handlerAscensionBillingCheck_1.handleAuthenticationEmployee, (0, helper_1.handleOverLoad)(validateTenancy_1.isAuthorizedRoleAdmin), controllers_1.refundAllTransactionHandler);
router.post('/api/v1/billing/write-off/transaction', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.WriteOffTransaction));
router.post('/api/v1/billing/correction/source', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(handler_2.correctRefererErrorPostRegistrationHandler));
router.get('/api/v1/billing/discount-limits', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.listDiscountLimitRules));
router.post('/api/v1/billing/discount-limits', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.upsertDiscountLimitRule));
router.get('/api/v1/billing/discount-limits/daily-usage', validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(controllers_1.getDiscountDailyUsage));
// Transaction Management Routes
router.get('/api/v1/billing/management/details/:billingid', validateTenancy_1.isAuthorizedRoleAdmin, TransactionManagementController_1.TransactionManagementController.getFullTransactionDetails);
router.get('/api/v1/billing/management/audit/:billingid', validateTenancy_1.isAuthorizedRoleAdmin, TransactionManagementController_1.TransactionManagementController.getTransactionAuditHistory);
router.put('/api/v1/billing/management/payment-history', validateTenancy_1.isAuthorizedRoleAdmin, TransactionManagementController_1.TransactionManagementController.updatePaymentHistory);
router.put('/api/v1/billing/management/transaction', validateTenancy_1.isAuthorizedRoleAdmin, TransactionManagementController_1.TransactionManagementController.editTransaction);
router.post('/api/v1/billing/management/void/:billingid', validateTenancy_1.isAuthorizedRoleAdmin, TransactionManagementController_1.TransactionManagementController.voidTransaction);
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
router.post("/api/v1/billing/sales/session/create", (0, helper_1.handleOverLoad)(handler_1.handleCreateNewSalesSesion));
router.get("/api/v1/billing/sales/session/list", handler_1.getSalesSessionList);
router.get("/api/v1/billing/sales/session/by-date", (0, helper_1.handleOverLoad)(handler_1.getSessionsByDateHandler));
router.put("/api/v1/billing/sales/session/:sessionId", (0, helper_1.handleOverLoad)(handler_1.handleUpdateSalesSession));
router.put("/api/v1/billing/sales/session/endsession", handler_1.handleEndSalesSession);
router.get('/api/v1/billing/sales/session/verify/session', handler_1.hasSalesSessionAvailableHandler);
router.get(`/api/v1/billing/load/session/:sessionid/summary`, (0, helper_1.handleOverLoad)(handler_1.getSessionFinancialSummaryHandler));
router.get("/api/v1/billing/sales/session/config", (0, helper_1.handleOverLoad)(handler_1.getSalesSessionConfigHandler));
router.post("/api/v1/billing/sales/session/config", (0, helper_1.handleOverLoad)(handler_1.setSalesSessionConfigHandler));
router.delete("/api/v1/billing/sales/session/:sessionId", (0, helper_1.handleOverLoad)(handler_1.deleteUnusedSalesSessionHandler));
// campaigns 
router.post("/api/v1/campaigns", (0, helper_1.handleOverLoad)(PrimeBillingCampaignController_1.PrimeBillingCampaignController.create));
router.get("/api/v1/campaigns/:id", (0, helper_1.handleOverLoad)(PrimeBillingCampaignController_1.PrimeBillingCampaignController.findById));
router.put("/api/v1/campaigns/:id", (0, helper_1.handleOverLoad)(PrimeBillingCampaignController_1.PrimeBillingCampaignController.update));
router.delete("/api/v1/campaigns/:id", (0, helper_1.handleOverLoad)(PrimeBillingCampaignController_1.PrimeBillingCampaignController.delete));
router.get("/api/v1/campaigns", (0, helper_1.handleOverLoad)(PrimeBillingCampaignController_1.PrimeBillingCampaignController.list));
// Promo code routes
router.post("/api/v1/promo-codes", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.create));
router.get("/api/v1/promo-codes/:id", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.findById));
router.get("/api/v1/promo-codes/by-code", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.findByCode));
router.put("/api/v1/promo-codes/:id", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.update));
router.delete("/api/v1/promo-codes/:id", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.delete));
router.get("/api/v1/promo-codes", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.list));
router.post("/api/v1/promo-codes/increment-usage", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.incrementUsage));
router.post("/api/v1/promo-codes/validate", (0, helper_1.handleOverLoad)(PrimePromoCode_1.PrimeBillingPromoCodeController.validatePromoCode));
// Locations: Regions with their Districts
router.get('/api/v1/locations/regions-districts', (async (req, res) => {
    try {
        const tenantQuery = req.query.tenantId;
        const tenantIdStr = Array.isArray(tenantQuery) ? tenantQuery[0] : tenantQuery;
        const headerTenant = req.headers['tenantid'] || req.headers['tenant-id'];
        const headerTenantStr = Array.isArray(headerTenant) ? headerTenant[0] : headerTenant;
        const tenantId = parseInt((tenantIdStr || headerTenantStr || '').toString());
        if (!tenantId || isNaN(tenantId)) {
            res.status(400).send({ status: 'error', statusCode: 400, message: 'tenantId query parameter is required' });
            return;
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const regions = await connection('regions').select('id', 'name', 'regioncode').orderBy('name');
        const districts = await connection('districts').select('id', 'name', 'code', 'regionid').orderBy('name');
        const grouped = regions.map((r) => ({
            id: r.id,
            name: r.name,
            regioncode: r.regioncode,
            districts: districts.filter((d) => d.regionid === r.id)
        }));
        res.send({ status: 'success', statusCode: 200, data: grouped });
        return;
    }
    catch (err) {
        console.error('Error loading regions and districts', err);
        res.status(500).send({ status: 'error', statusCode: 500, message: 'Failed to load regions and districts' });
        return;
    }
}));
exports.default = router;
