import { RequestHandler, Router } from "express";
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
    handleEmailReceiptSending,
    refundAllTransactionHandler,
    handleMultiNewBilling,
    handleMultiUpdateBilling,
    WriteOffTransaction
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
import { getSalesSessionList, handleCreateNewSalesSesion, handleEndSalesSession, hasSalesSessionAvailableHandler } from "./SessionManger/handler";
import { isAuthorizedRoleAdmin } from "../../middleware/validateTenancy";
import { handleOverLoad } from "../../hooks/helper";
import { PrimeBillingCampaignController } from "./PrimeBillingCampaignController";
import { PrimeBillingPromoCodeController } from "./PrimePromoCode";
import { checkoutBillingHandler, correctRefererErrorPostRegistrationHandler, initializeBillingHandler, submitBillingHandler } from "../applicationsettings/handler";





const router = Router();

// Billing Routes
router.post("/api/v1/billing", handleNewBilling);
router.post("/api/v1/billing/multi", handleMultiNewBilling);
router.get("/api/v1/billing/multi/init", initializeBillingHandler);
router.post("/api/v1/billing/multi/checkout", handleOverLoad(checkoutBillingHandler));
router.post("/api/v1/billing/multi/submit", handleOverLoad(submitBillingHandler));
router.put('/api/v1/billing/multi', handleMultiUpdateBilling);
router.get("/api/v1/billing/send/receipt/email/:patientid/:billingid", handleEmailReceiptSending)
router.put("/api/v1/billing", isAuthorizedRoleAdmin, updateBilledTransaction);
router.get("/api/v1/billing/caninitialbill", canInitiateBill);
router.get("/api/v1/billing/information/single", getSavedCLientBillingInformation);
router.post(`/api/v1/billing/previous/request/refund`, determineStageOfRefundRequestHandler);
router.post(`/api/v1/billing/previous/request/refund/update`, requestForRefundHandler);
router.post("/api/v1/billing/previous/refund/update/previous", updateWitnessWitnessNote as RequestHandler);
router.post("/api/v1/billing/previous/refund/update/approve", isAuthorizedRoleAdmin, approveRequestForRefund);
router.post("/api/v1/billing/previous/refund/update/cashout", requestForRefundCashIssueOut);
router.get("/api/v1/billing/previous/refund/update/verification/cashout", verificationBeforeCashoutHandler as unknown as RequestHandler);
router.get("/api/v1/billing/filtering/service/refund", getServiceRefundItem);
router.get("/api/v1/billing/previous/transaction/data", getTransactionBillDataHandler);
router.get("/api/v1/billing/previous/refund/all/:billingid/:employeeid/:selectedPaymentMode",
    handleAuthenticationEmployee as unknown as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, {}, {}, { tenantId: string; }>,
    handleOverLoad(isAuthorizedRoleAdmin),
    refundAllTransactionHandler as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, any, any>)
router.post('/api/v1/billing/write-off/transaction', isAuthorizedRoleAdmin, WriteOffTransaction as RequestHandler<{ tenantId: string }, any, { billingid: number; reason: string; employeeid: number; }>);
router.post('/api/v1/billing/correction/source', handleOverLoad(correctRefererErrorPostRegistrationHandler));


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
router.put("/api/v1/billing/sales/session/endsession", handleEndSalesSession);
router.get('/api/v1/billing/sales/session/verify/session', hasSalesSessionAvailableHandler)



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

export default router;

