import { RequestHandler, Router, Request, Response } from "express";
import {
     handleNewBilling,
     canInitiateBill,
     getSavedCLientBillingInformation,
     requestForRefundHandler,
     updateBilledTransaction,
     determineStageOfRefundRequestHandler,
     getAlRefundsPaginationHandler,
     updateWitnessWitnessNote,
     approveRequestForRefund,
     requestForRefundCashIssueOut,
     getServiceRefundItem,
     verificationBeforeCashoutHandler,
     getTransactionBillDataHandler,
     refundAllTransactionHandler,
     handleMultiUpdateBilling,
     WriteOffTransaction,
     outstandingReport,
     listDiscountLimitRules,
     upsertDiscountLimitRule,
     getDiscountDailyUsage
} from "./controllers";
import {
     createServicesHandler,
     updateServicesHandler,
     deleteServicesHandler,
     getAservicesHandler,
     getAllservicesHandler
} from "./servicesHandler";
import { handleAuthenticationEmployee } from "../../middleware/redis/handlerAscensionBillingCheck";
import { getPatientTransactions, getPatientTransactionDetails } from "./BillingHandler";
import { getSalesSessionList, getSessionFinancialSummaryHandler, handleCreateNewSalesSesion, handleEndSalesSession, hasSalesSessionAvailableHandler, getSalesSessionConfigHandler, setSalesSessionConfigHandler, deleteUnusedSalesSessionHandler, getSessionsByDateHandler, handleUpdateSalesSession } from "./SessionManger/handler";
import { isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";
import { handleOverLoad } from "../../hooks/helper";
import KnexConnection from "../../database/KnexConnections";
import { PrimeBillingCampaignController } from "./PrimeBillingCampaignController";
import { PrimeBillingPromoCodeController } from "./PrimePromoCode";
import { checkoutBillingHandler, correctRefererErrorPostRegistrationHandler, initializeBillingHandler, removePendingNonPaidServicesHandler, submitBillingHandler } from "../applicationsettings/handler";
import { TransactionManagementController } from "../../models/billing/management/TransactionManagementController";

const router = Router();

// Billing Routes
router.post("/api/v1/billing", handleNewBilling);
// router.post("/api/v1/billing/multi", handleMultiNewBilling);   obsolote now replaced with /api/v1/billing/multi/submit for better flow control and error handling in multi billing process
router.put('/api/v1/billing/pending/remove/service', handleOverLoad(removePendingNonPaidServicesHandler))
router.get('/api/v1/outstanding/report/combined', isAuthorizedRoleAdmin, handleOverLoad(outstandingReport));
router.get("/api/v1/billing/multi/init", handleOverLoad(initializeBillingHandler));
router.post("/api/v1/billing/multi/checkout", handleOverLoad(checkoutBillingHandler));
router.post("/api/v1/billing/multi/submit", handleOverLoad(submitBillingHandler));
router.put('/api/v1/billing/multi', handleMultiUpdateBilling);
router.put("/api/v1/billing", isAuthorizedRoleAdmin, handleOverLoad(updateBilledTransaction));
router.get("/api/v1/billing/caninitialbill", canInitiateBill);
router.get("/api/v1/billing/information/single", getSavedCLientBillingInformation);
router.post(`/api/v1/billing/previous/request/refund`, determineStageOfRefundRequestHandler);
router.post(`/api/v1/billing/previous/request/refund/update`, handleOverLoad(requestForRefundHandler));
router.post("/api/v1/billing/previous/refund/update/previous", handleOverLoad(updateWitnessWitnessNote as unknown as RequestHandler));
router.post("/api/v1/billing/previous/refund/update/approve", isAuthorizedRoleAdmin, handleOverLoad(approveRequestForRefund));
router.post("/api/v1/billing/previous/refund/update/cashout", requestForRefundCashIssueOut);
router.get("/api/v1/billing/previous/refund/update/verification/cashout", verificationBeforeCashoutHandler as unknown as RequestHandler);
router.get("/api/v1/billing/filtering/service/refund", getServiceRefundItem);
router.get("/api/v1/billing/previous/transaction/data", getTransactionBillDataHandler);
router.get("/api/v1/billing/previous/refund/all/:billingid/:employeeid/:selectedPaymentMode",
     handleAuthenticationEmployee as unknown as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, {}, {}, { tenantId: string; }>,
     handleOverLoad(isAuthorizedRoleAdmin),
     refundAllTransactionHandler as unknown as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, any, any>)
router.post('/api/v1/billing/write-off/transaction', isAuthorizedRoleAdmin, handleOverLoad(WriteOffTransaction as unknown as RequestHandler<{ tenantId: string }, any, { billingid: number; reason: string; employeeid: number; }>));
router.post('/api/v1/billing/correction/source', isAuthorizedRoleAdmin, handleOverLoad(correctRefererErrorPostRegistrationHandler));
router.get('/api/v1/billing/discount-limits', isAuthorizedRoleAdmin, handleOverLoad(listDiscountLimitRules));
router.post('/api/v1/billing/discount-limits', isAuthorizedRoleAdmin, handleOverLoad(upsertDiscountLimitRule));
router.get('/api/v1/billing/discount-limits/daily-usage', isAuthorizedRoleAdmin, handleOverLoad(getDiscountDailyUsage));

// Transaction Management Routes
router.get('/api/v1/billing/management/details/:billingid', isAuthorizedRoleAdmin, TransactionManagementController.getFullTransactionDetails);
router.get('/api/v1/billing/management/audit/:billingid', isAuthorizedRoleAdmin, TransactionManagementController.getTransactionAuditHistory);
router.put('/api/v1/billing/management/payment-history', isAuthorizedRoleAdmin, TransactionManagementController.updatePaymentHistory);
router.put('/api/v1/billing/management/transaction', isAuthorizedRoleAdmin, TransactionManagementController.editTransaction);
router.post('/api/v1/billing/management/void/:billingid', isAuthorizedRoleAdmin, TransactionManagementController.voidTransaction);

// Services Routes
router.post("/api/v1/billing/services", createServicesHandler);
router.put("/api/v1/billing/services", updateServicesHandler);
router.get("/api/v1/billing/services/specific", getAservicesHandler);
router.get("/api/v1/billing/services", getAllservicesHandler);
router.delete("/api/v1/billing/services", deleteServicesHandler);

// Refund Routes
router.get("/api/v1/billing/refund/details/status", getAlRefundsPaginationHandler);


// patient transactions 
router.get('/api/v1/billing/patient/transactions', getPatientTransactions as unknown as RequestHandler<{}, {}, {}, { tenantId: string; page?: number; limit?: number; }>);
router.get('/api/v1/billing/patient/transactions/:billingid', getPatientTransactionDetails as unknown as RequestHandler<{ transactionId: string }, {}, {}, { tenantId: string }>);




// sales session
router.post("/api/v1/billing/sales/session/create", handleOverLoad(handleCreateNewSalesSesion));
router.get("/api/v1/billing/sales/session/list", getSalesSessionList);
router.get("/api/v1/billing/sales/session/by-date", handleOverLoad(getSessionsByDateHandler));
router.put("/api/v1/billing/sales/session/:sessionId", handleOverLoad(handleUpdateSalesSession));
router.put("/api/v1/billing/sales/session/endsession", handleEndSalesSession);
router.get('/api/v1/billing/sales/session/verify/session', hasSalesSessionAvailableHandler)
router.get(`/api/v1/billing/load/session/:sessionid/summary`, handleOverLoad(getSessionFinancialSummaryHandler))
router.get("/api/v1/billing/sales/session/config", handleOverLoad(getSalesSessionConfigHandler));
router.post("/api/v1/billing/sales/session/config", handleOverLoad(setSalesSessionConfigHandler)); router.delete("/api/v1/billing/sales/session/:sessionId", handleOverLoad(deleteUnusedSalesSessionHandler));


// campaigns 
router.post("/api/v1/campaigns", handleOverLoad(PrimeBillingCampaignController.create));
router.get("/api/v1/campaigns/:id", handleOverLoad(PrimeBillingCampaignController.findById));
router.put("/api/v1/campaigns/:id", handleOverLoad(PrimeBillingCampaignController.update));
router.delete("/api/v1/campaigns/:id", handleOverLoad(PrimeBillingCampaignController.delete));
router.get("/api/v1/campaigns", handleOverLoad(PrimeBillingCampaignController.list));

// Promo code routes
router.post("/api/v1/promo-codes", handleOverLoad(PrimeBillingPromoCodeController.create));
router.get("/api/v1/promo-codes/:id", handleOverLoad(PrimeBillingPromoCodeController.findById));
router.get("/api/v1/promo-codes/by-code", handleOverLoad(PrimeBillingPromoCodeController.findByCode));
router.put("/api/v1/promo-codes/:id", handleOverLoad(PrimeBillingPromoCodeController.update));
router.delete("/api/v1/promo-codes/:id", handleOverLoad(PrimeBillingPromoCodeController.delete));
router.get("/api/v1/promo-codes", handleOverLoad(PrimeBillingPromoCodeController.list));
router.post("/api/v1/promo-codes/increment-usage", handleOverLoad(PrimeBillingPromoCodeController.incrementUsage));
router.post("/api/v1/promo-codes/validate", handleOverLoad(PrimeBillingPromoCodeController.validatePromoCode));

// Locations: Regions with their Districts
router.get('/api/v1/locations/regions-districts', (async (req: Request, res: Response) => {
     try {
          const tenantQuery = req.query.tenantId;
          const tenantIdStr = Array.isArray(tenantQuery) ? tenantQuery[0] : (tenantQuery as string | undefined);
          const headerTenant = req.headers['tenantid'] || req.headers['tenant-id'];
          const headerTenantStr = Array.isArray(headerTenant) ? headerTenant[0] : (headerTenant as string | undefined);
          const tenantId = parseInt((tenantIdStr || headerTenantStr || '').toString());

          if (!tenantId || isNaN(tenantId)) {
               res.status(400).send({ status: 'error', statusCode: 400, message: 'tenantId query parameter is required' });
               return;
          }

          const connection = await KnexConnection(tenantId);

          const regions = await connection('regions').select('id', 'name', 'regioncode').orderBy('name');
          const districts = await connection('districts').select('id', 'name', 'code', 'regionid').orderBy('name');

          const grouped = regions.map((r: any) => ({
               id: r.id,
               name: r.name,
               regioncode: r.regioncode,
               districts: districts.filter((d: any) => d.regionid === r.id)
          }));

          res.send({ status: 'success', statusCode: 200, data: grouped });
          return;
     } catch (err) {
          console.error('Error loading regions and districts', err);
          res.status(500).send({ status: 'error', statusCode: 500, message: 'Failed to load regions and districts' });
          return;
     }
}) as RequestHandler);

export default router;

