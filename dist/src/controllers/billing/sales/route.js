"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const FinancialSummaryHandler_1 = require("./FinancialSummaryHandler");
router.get("/api/v1/financials/billing/summary", FinancialSummaryHandler_1.handleFinancialAnalytics);
router.get("/api/v1/financials/billing/summary/getKeys", FinancialSummaryHandler_1.handleFinancialAnalyticsGetKeys);
router.get("/api/v1/financials/billing/summary/daily/breakdown", FinancialSummaryHandler_1.handleSalesSummaryDailyBreakDown);
exports.default = router;
