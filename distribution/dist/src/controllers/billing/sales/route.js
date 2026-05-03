"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const FinancialSummaryHandler_1 = require("./FinancialSummaryHandler");
const helper_1 = require("../../../hooks/helper");
const validateTenancy_1 = require("../../../middleware/validateTenancy");
router.get("/api/v1/financials/billing/summary", validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(FinancialSummaryHandler_1.handleFinancialAnalytics));
router.get("/api/v1/financials/billing/summary/getKeys", validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(FinancialSummaryHandler_1.handleFinancialAnalyticsGetKeys));
router.get("/api/v1/financials/billing/summary/daily/breakdown", validateTenancy_1.isAuthorizedRoleAdmin, (0, helper_1.handleOverLoad)(FinancialSummaryHandler_1.handleSalesSummaryDailyBreakDown));
exports.default = router;
