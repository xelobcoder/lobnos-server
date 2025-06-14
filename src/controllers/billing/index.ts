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
    refundAllTransactionHandler
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



const router = Router();

// Billing Routes
router.post("/api/v1/billing", handleNewBilling);
router.get("/api/v1/billing/send/receipt/email/:patientid/:billingid", handleEmailReceiptSending)
router.put("/api/v1/billing", isAuthorizedRoleAdmin,updateBilledTransaction);
router.get("/api/v1/billing/caninitialbill", canInitiateBill);
router.get("/api/v1/billing/information/single", getSavedCLientBillingInformation);
router.post(`/api/v1/billing/previous/request/refund`, determineStageOfRefundRequestHandler);
router.post(`/api/v1/billing/previous/request/refund/update`, requestForRefundHandler);
router.post("/api/v1/billing/previous/refund/update/previous", updateWitnessWitnessNote as RequestHandler);
router.post("/api/v1/billing/previous/refund/update/approve",isAuthorizedRoleAdmin, approveRequestForRefund);
router.post("/api/v1/billing/previous/refund/update/cashout", requestForRefundCashIssueOut);
router.get("/api/v1/billing/previous/refund/update/verification/cashout", verificationBeforeCashoutHandler as unknown as RequestHandler);
router.get("/api/v1/billing/filtering/service/refund", getServiceRefundItem);
router.get("/api/v1/billing/previous/transaction/data", getTransactionBillDataHandler);
router.get("/api/v1/billing/previous/refund/all/:billingid/:employeeid/:selectedPaymentMode",
    handleAuthenticationEmployee as unknown as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, {}, {}, { tenantId: string; }>,
    refundAllTransactionHandler as RequestHandler<{ billingid: number; employeeid: number; selectedPaymentMode: number; }, any, any>)

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
router.put("/api/v1/billing/sales/session/endsession",handleEndSalesSession);
router.get('/api/v1/billing/sales/session/verify/session',hasSalesSessionAvailableHandler)
export default router;

