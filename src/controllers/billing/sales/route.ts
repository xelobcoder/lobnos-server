import express from 'express';

const router = express.Router();

import { handleFinancialAnalytics, handleFinancialAnalyticsGetKeys, handleSalesSummaryDailyBreakDown } from './FinancialSummaryHandler'
import { handleOverLoad } from '../../../hooks/helper';


router.get("/api/v1/financials/billing/summary", handleOverLoad( handleFinancialAnalytics))
router.get("/api/v1/financials/billing/summary/getKeys", handleOverLoad(handleFinancialAnalyticsGetKeys))
router.get("/api/v1/financials/billing/summary/daily/breakdown", handleSalesSummaryDailyBreakDown)


export default router;