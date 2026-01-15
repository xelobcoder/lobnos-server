"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const expenseHandlers_1 = require("./expenseHandlers");
const ExpenseAnalyticsController_1 = require("./ExpenseAnalyticsController");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
const RECEIPTS_PATH = "/../../../../public/uploads/expenses/receipts";
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, node_path_1.default.join(__dirname, RECEIPTS_PATH));
    },
    filename: function (req, file, cb) {
        cb(null, req.query.id + "-" + Date.now() + node_path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({ storage: storage });
router.post("/api/v1/expense/merchant", (0, helper_1.handleOverLoad)(expenseHandlers_1.createExpenseMerchant));
router.put("/api/v1/expense/merchant", (0, helper_1.handleOverLoad)(expenseHandlers_1.updateExpenseMerchant));
router.get("/api/v1/expense/merchants", (0, helper_1.handleOverLoad)(expenseHandlers_1.getAllExpenseMerchants));
router.post("/api/v1/expenses", (0, helper_1.handleOverLoad)(expenseHandlers_1.createExpenses));
router.get("/api/v1/expenses/group/:groupId", (0, helper_1.handleOverLoad)(expenseHandlers_1.getExpensesByGroup));
router.put('/api/v1/expenses', (0, helper_1.handleOverLoad)(expenseHandlers_1.updateExpenseRecord));
router.get("/api/v1/expenses/records", expenseHandlers_1.getExpensesRecord);
router.get('/api/v1/expenses/audit/:expenseId', (0, helper_1.handleOverLoad)(expenseHandlers_1.getExpenseLog));
router.get("/api/v1/expenses/record/single", expenseHandlers_1.getSingleExpense);
router.put('/api/v1/expense/record/single', (0, helper_1.handleOverLoad)(expenseHandlers_1.updateExpenseRecord));
router.post("/api/v1/expenses/receipt/upload", upload.array("images", 10), expenseHandlers_1.uploadReceipts);
router.get("/api/v1/expenses/receipt/upload/images", expenseHandlers_1.getReceiptImage);
router.get("/api/v1/expenses/receipt/uploaded/images/list", expenseHandlers_1.getExpenseImageList);
router.delete("/api/v1/expenses/receipt/uploaded/images", expenseHandlers_1.deleteReceiptsList);
router.post("/api/v1/expense/pending/decision", expenseHandlers_1.updateExpenseDecision);
router.post("/api/v1/expense/new/category", (0, helper_1.handleOverLoad)(expenseHandlers_1.createExpenseCategory));
router.put("/api/v1/expense/new/category", expenseHandlers_1.updateExpenseCategory);
router.get("/api/v1/expense/get/category", expenseHandlers_1.getAllExpenseCategory);
router.post('/api/v1/outsourced/cases/mark-expense', (0, helper_1.handleOverLoad)(expenseHandlers_1.markOutsourceCasesAsExpense));
router.put('/api/v1/outsourced/cases/confirm-done', (0, helper_1.handleOverLoad)(expenseHandlers_1.markCaseAsDone));
router.post('/api/v1/supplier-payments/mark-expense', (0, helper_1.handleOverLoad)(expenseHandlers_1.markSupplierPaymentAsExpense));
router.post('/api/v1/expenses/invoice/create-with-expenses', (0, helper_1.handleOverLoad)(expenseHandlers_1.createExpensesAndInvoice));
router.post('/api/v1/expenses/invoice', (0, helper_1.handleOverLoad)(expenseHandlers_1.createInvoice));
router.get('/api/v1/expenses/invoices', (0, helper_1.handleOverLoad)(expenseHandlers_1.getInvoices));
router.post('/api/v1/expenses/payment', (0, helper_1.handleOverLoad)(expenseHandlers_1.addPayment));
router.get('/api/v1/expenses/payments', (0, helper_1.handleOverLoad)(expenseHandlers_1.getPayments));
router.post('/api/v1/expenses/payment/reverse', (0, helper_1.handleOverLoad)(expenseHandlers_1.reverseExpensePayment));
router.get('/api/v1/expenses/payments/reversed', (0, helper_1.handleOverLoad)(expenseHandlers_1.getReversedPayments));
// Analytics routes
router.get('/api/v1/expenses/analytics/daily', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getDailyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/comparison', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseComparisonByPeriod));
router.get('/api/v1/expenses/analytics/trends/category', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseTrendsByCategory));
router.get('/api/v1/expenses/analytics/trends/employee', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseTrendsByEmployee));
router.get('/api/v1/expenses/analytics/trends/merchant', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseTrendsByMerchant));
router.get('/api/v1/expenses/analytics/hourly', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getHourlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/monthly', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getMonthlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/weekly', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getWeeklyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/quarterly', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getQuarterlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/yearly', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getYearlyExpenseAnalytics));
router.get('/api/v1/expenses/analytics/branch', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseAnalyticsByBranch));
router.get('/api/v1/expenses/analytics/top-categories', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getTopExpenseCategories));
router.get('/api/v1/expenses/analytics/payment-status', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpensePaymentStatusAnalytics));
router.get('/api/v1/expenses/analytics/buckets', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseBuckets));
router.get('/api/v1/expenses/analytics/growth-rate', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseGrowthRateAnalytics));
router.get('/api/v1/expenses/analytics/approval-timeline', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getExpenseApprovalTimelineAnalytics));
router.get("/api/v1/expenses/analytics/breakdown-admin-level", (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getRecurringExpenseAnalytics));
router.get('/api/v1/expenses/analytics/payments-by-merchant/:merchantId', (0, helper_1.handleOverLoad)(ExpenseAnalyticsController_1.ExpenseAnalyticsController.getPaymentsByMerchant));
exports.default = router;
