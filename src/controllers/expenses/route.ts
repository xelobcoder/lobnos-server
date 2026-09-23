import express from "express";
import multer from "multer";
import path from "node:path";
import {
  createExpenses,
  getExpensesRecord,
  getSingleExpense,
  uploadReceipts,
  getReceiptImage,
  getExpenseImageList,
  deleteReceiptsList,
  updateExpenseDecision,
  createExpenseCategory,
  updateExpenseCategory,
  getAllExpenseCategory,
  updateExpenseRecord,
  getExpenseLog,
  createExpenseMerchant,
  updateExpenseMerchant,
  getAllExpenseMerchants,
  markOutsourceCasesAsExpense,
  markCaseAsDone,
  createExpensesAndInvoice,
  createInvoice,
  getInvoices,
  addPayment,
  getPayments,
  getExpensesByGroup,
  markSupplierPaymentAsExpense,
  reverseExpensePayment,
  getReversedPayments,
} from "./expenseHandlers";
import { ExpenseAnalyticsController } from "./ExpenseAnalyticsController";
import { handleOverLoad } from "../../hooks/helper";
import { checkTokenExists } from "../../middleware/validateTenancy";
import { requireAuthority } from "../../middleware/authority";
import { PaymentAccountController } from "./PaymentAccountController";
import { ExpenseWorkflowController } from "./ExpenseWorkflowController";

const router = express.Router();
const RECEIPTS_PATH = "/../../../../public/uploads/expenses/receipts"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, RECEIPTS_PATH));
  },
  filename: function (req, file, cb) {
    cb(null, req.query.id + "-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.post("/api/v1/expense/merchant", handleOverLoad(createExpenseMerchant));
router.put("/api/v1/expense/merchant", handleOverLoad(updateExpenseMerchant));
router.get("/api/v1/expense/merchants", handleOverLoad(getAllExpenseMerchants));

router.post("/api/v1/expenses", checkTokenExists, requireAuthority('expense.create'), handleOverLoad(createExpenses));
router.get("/api/v1/expenses/group/:groupId", handleOverLoad(getExpensesByGroup));
router.put('/api/v1/expenses', checkTokenExists, requireAuthority('expense.edit'), handleOverLoad(updateExpenseRecord));
router.get("/api/v1/expenses/records", getExpensesRecord);
router.get('/api/v1/expenses/audit/:expenseId', handleOverLoad(getExpenseLog))
router.get('/api/v1/expenses/:expenseId/workflow-history', checkTokenExists, ExpenseWorkflowController.history);
router.get('/api/v1/expenses/workflow/controls', checkTokenExists, requireAuthority('expense.configure'), ExpenseWorkflowController.controls);
router.put('/api/v1/expenses/workflow/controls', checkTokenExists, requireAuthority('expense.configure'), ExpenseWorkflowController.updateControls);
router.get("/api/v1/expenses/record/single", getSingleExpense);
router.put('/api/v1/expense/record/single', checkTokenExists, requireAuthority('expense.edit'), handleOverLoad(updateExpenseRecord));
router.post("/api/v1/expenses/receipt/upload", upload.array("images", 10), uploadReceipts);
router.get("/api/v1/expenses/receipt/upload/images", getReceiptImage);
router.get("/api/v1/expenses/receipt/uploaded/images/list", getExpenseImageList);
router.delete("/api/v1/expenses/receipt/uploaded/images", deleteReceiptsList);
router.post(
  "/api/v1/expense/pending/decision",
  checkTokenExists,
  updateExpenseDecision
);
router.post("/api/v1/expense/new/category", handleOverLoad(createExpenseCategory));
router.put("/api/v1/expense/new/category", updateExpenseCategory);
router.get("/api/v1/expense/get/category", getAllExpenseCategory);

router.post('/api/v1/outsourced/cases/mark-expense', handleOverLoad(markOutsourceCasesAsExpense));
router.put('/api/v1/outsourced/cases/confirm-done', handleOverLoad(markCaseAsDone));
router.post('/api/v1/supplier-payments/mark-expense', handleOverLoad(markSupplierPaymentAsExpense));

router.post('/api/v1/expenses/invoice/create-with-expenses', handleOverLoad(createExpensesAndInvoice));
router.post('/api/v1/expenses/invoice', handleOverLoad(createInvoice));
router.get('/api/v1/expenses/invoices', handleOverLoad(getInvoices));
router.post(
  '/api/v1/expenses/payment',
  checkTokenExists,
  handleOverLoad(addPayment)
);
router.get('/api/v1/expenses/payment-accounts', checkTokenExists, PaymentAccountController.listAvailable);
router.get('/api/v1/expenses/payment-accounts/options', checkTokenExists, requireAuthority('payment_account.manage'), PaymentAccountController.managementOptions);
router.get('/api/v1/expenses/payment-accounts/manage', checkTokenExists, requireAuthority('payment_account.manage'), PaymentAccountController.listAll);
router.post('/api/v1/expenses/payment-accounts', checkTokenExists, requireAuthority('payment_account.manage'), PaymentAccountController.create);
router.put('/api/v1/expenses/payment-accounts/:id/access', checkTokenExists, requireAuthority('payment_account.manage'), PaymentAccountController.grantAccess);
router.get('/api/v1/expenses/payments', handleOverLoad(getPayments));
router.post('/api/v1/expenses/payment/reverse', handleOverLoad(reverseExpensePayment));
router.get('/api/v1/expenses/payments/reversed', handleOverLoad(getReversedPayments));

// Analytics routes
router.get('/api/v1/expenses/analytics/daily', handleOverLoad(ExpenseAnalyticsController.getDailyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/comparison', handleOverLoad(ExpenseAnalyticsController.getExpenseComparisonByPeriod));
router.get('/api/v1/expenses/analytics/trends/category', handleOverLoad(ExpenseAnalyticsController.getExpenseTrendsByCategory));
router.get('/api/v1/expenses/analytics/trends/employee', handleOverLoad(ExpenseAnalyticsController.getExpenseTrendsByEmployee));
router.get('/api/v1/expenses/analytics/trends/merchant', handleOverLoad(ExpenseAnalyticsController.getExpenseTrendsByMerchant));
router.get('/api/v1/expenses/analytics/hourly', handleOverLoad(ExpenseAnalyticsController.getHourlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/monthly', handleOverLoad(ExpenseAnalyticsController.getMonthlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/weekly', handleOverLoad(ExpenseAnalyticsController.getWeeklyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/quarterly', handleOverLoad(ExpenseAnalyticsController.getQuarterlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/yearly', handleOverLoad(ExpenseAnalyticsController.getYearlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/branch', handleOverLoad(ExpenseAnalyticsController.getExpenseAnalyticsByBranch));
router.get('/api/v1/expenses/analytics/top-categories', handleOverLoad(ExpenseAnalyticsController.getTopExpenseCategories));
router.get('/api/v1/expenses/analytics/payment-status', handleOverLoad(ExpenseAnalyticsController.getExpensePaymentStatusAnalytics));
router.get('/api/v1/expenses/analytics/rejected/monthly', handleOverLoad(ExpenseAnalyticsController.getRejectedExpenseAnalyticsByMonth));
router.get('/api/v1/expenses/analytics/rejected/monthly/details', handleOverLoad(ExpenseAnalyticsController.getRejectedExpenseDetailsByMonth));
router.get('/api/v1/expenses/analytics/rejected', handleOverLoad(ExpenseAnalyticsController.getRejectedExpenseAnalytics));
router.get('/api/v1/expenses/analytics/branch-monthly', handleOverLoad(ExpenseAnalyticsController.getBranchMonthlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/buckets', handleOverLoad(ExpenseAnalyticsController.getExpenseBuckets));
router.get('/api/v1/expenses/analytics/growth-rate', handleOverLoad(ExpenseAnalyticsController.getExpenseGrowthRateAnalytics));
router.get('/api/v1/expenses/analytics/approval-timeline', handleOverLoad(ExpenseAnalyticsController.getExpenseApprovalTimelineAnalytics));
router.get("/api/v1/expenses/analytics/breakdown-admin-level", handleOverLoad(ExpenseAnalyticsController.getRecurringExpenseAnalytics))
router.get('/api/v1/expenses/analytics/payments-by-merchant/:merchantId', handleOverLoad(ExpenseAnalyticsController.getPaymentsByMerchant));
export default router;
