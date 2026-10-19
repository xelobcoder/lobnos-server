import express from "express"
import {
  getResultReady,
  getAdvancedTablesSearch,
  getResultById,
  updatePrintCount,
  getSummaryReadyPage,
  getClientTransactionInfo,
  getPaymentModes,
  getClientTransactionHistory,
  updatePayment,
  previewReport,
  getPreviewComments,
  getResultEntryScientist,
  checkApproval,
  makeDecisionOnResult,
  getBillingInvoice,
  // emailBillingReceipt,
  // generatePDFResult,
  getTransactionApprovedTest,
  getBillingReceipt,
} from "./handlers"
import { generateTransactionReceiptHandler, getPatientOutstandingPayments, listOutstandingBillsHandler, processMultiServicePayment, updateReceiptPrintedHandler, getReceiptsHandler } from "./MultiPaymentHamdler";
import { handleOverLoad } from "../../hooks/helper";

const router = express.Router();

router.get("/api/v1/result/ready", getResultReady);
router.get("/api/v1/ready/crm/summary/advanced", getAdvancedTablesSearch);
router.get("/api/v1/result/ready/:id", getResultById);
router.post("/api/v1/result/ready/updateprint/count", updatePrintCount);
router.get("/api/v1/result/ready/crm/summary", getSummaryReadyPage);
router.get("/api/v1/billing/payment/info/client", getClientTransactionInfo);
router.get("/api/v1/billing/client/bulk/outstanding", getPatientOutstandingPayments);
router.get("/api/v1/billing/client/outstanding-list", listOutstandingBillsHandler);
router.get('/api/v1/billing/client/generate/receipt', handleOverLoad(generateTransactionReceiptHandler));
router.post('/api/v1/receipt/update/printed', handleOverLoad(updateReceiptPrintedHandler));
router.get('/api/v1/receipts', handleOverLoad(getReceiptsHandler));
router.post("/api/v1/billing/multi-service/payment", processMultiServicePayment);
router.get("/api/v1/paymentmodes", getPaymentModes);
router.get("/api/v1/billing/client/transactionhx", getClientTransactionHistory);
router.post("/api/v1/billing/payment/update", updatePayment);
router.get("/api/v1/result/preview", previewReport);
router.get("/api/v1/result/preview/comments", getPreviewComments);
router.get("/api/v1/result/preview/entry/scientist", getResultEntryScientist);
router.post("/api/v1/test/result/preview/approved/check", checkApproval);
router.post("/api/v1/result/approve", makeDecisionOnResult);
router.get("/api/v1/billing/invoice", getBillingInvoice);
router.get("/api/v1/result/printout/approved/test", getTransactionApprovedTest);
router.get("/billing/receipt", getBillingReceipt);



export default router;
