import express from 'express';

const router = express.Router();

import { handleFinancialAnalytics, handleFinancialAnalyticsGetKeys, handleSalesSummaryDailyBreakDown } from './FinancialSummaryHandler'


router.get("/api/v1/financials/billing/summary", handleFinancialAnalytics)
router.get("/api/v1/financials/billing/summary/getKeys", handleFinancialAnalyticsGetKeys)
router.get("/api/v1/financials/billing/summary/daily/breakdown", handleSalesSummaryDailyBreakDown)


export default router;