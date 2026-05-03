import express from 'express';

const router = express.Router();

import { handleFinancialAnalytics, handleFinancialAnalyticsGetKeys, handleSalesSummaryDailyBreakDown } from './FinancialSummaryHandler'
import { handleOverLoad } from '../../../hooks/helper';
import { isAuthorizedRoleAdmin } from '../../../middleware/validateTenancy';


router.get("/api/v1/financials/billing/summary",isAuthorizedRoleAdmin, handleOverLoad( handleFinancialAnalytics))
router.get("/api/v1/financials/billing/summary/getKeys",isAuthorizedRoleAdmin, handleOverLoad(handleFinancialAnalyticsGetKeys))
router.get("/api/v1/financials/billing/summary/daily/breakdown", isAuthorizedRoleAdmin, handleOverLoad(handleSalesSummaryDailyBreakDown))


export default router;