import express from "express";
import multer from "multer";
import path from "node:path";
import {
  generateNewExpense,
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

} from "./expenseHandlers";
import { handleOverLoad } from "../../hooks/helper";

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


// Expense Merchants routes
router.post("/api/v1/expense/merchant", handleOverLoad(createExpenseMerchant));
router.put("/api/v1/expense/merchant", handleOverLoad(updateExpenseMerchant));
router.get("/api/v1/expense/merchants", handleOverLoad(getAllExpenseMerchants));

// ...existing expense routes...
router.post("/api/v1/expenses", generateNewExpense);
router.put('/api/v1/expenses', handleOverLoad(updateExpenseRecord));
router.get("/api/v1/expenses/records", getExpensesRecord);
router.get('/api/v1/expenses/audit/:expenseId', handleOverLoad(getExpenseLog))
router.get("/api/v1/expenses/record/single", getSingleExpense);
router.put('/api/v1/expense/record/single', handleOverLoad(updateExpenseRecord));
router.post("/api/v1/expenses/receipt/upload", upload.array("images", 10), uploadReceipts);
router.get("/api/v1/expenses/receipt/upload/images", getReceiptImage);
router.get("/api/v1/expenses/receipt/uploaded/images/list", getExpenseImageList);
router.delete("/api/v1/expenses/receipt/uploaded/images", deleteReceiptsList);
router.post("/api/v1/expense/pending/decision", updateExpenseDecision);
router.post("/api/v1/expense/new/category", handleOverLoad(createExpenseCategory));
router.put("/api/v1/expense/new/category", updateExpenseCategory);
router.get("/api/v1/expense/get/category", getAllExpenseCategory);

export default router;
