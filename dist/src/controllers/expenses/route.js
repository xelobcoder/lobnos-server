"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const expenseHandlers_1 = require("./expenseHandlers");
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
router.post('/api/v1/expenses/invoice/create-with-expenses', (0, helper_1.handleOverLoad)(expenseHandlers_1.createExpensesAndInvoice));
router.post('/api/v1/expenses/invoice', (0, helper_1.handleOverLoad)(expenseHandlers_1.createInvoice));
router.get('/api/v1/expenses/invoices', (0, helper_1.handleOverLoad)(expenseHandlers_1.getInvoices));
router.post('/api/v1/expenses/payment', (0, helper_1.handleOverLoad)(expenseHandlers_1.addPayment));
router.get('/api/v1/expenses/payments', (0, helper_1.handleOverLoad)(expenseHandlers_1.getPayments));
exports.default = router;
