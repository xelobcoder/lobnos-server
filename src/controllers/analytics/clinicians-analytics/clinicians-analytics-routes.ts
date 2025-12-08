import { Router } from 'express';
import ClinicianAnalyticsHandlers from './clinicians-analytics';

const router = Router();
const baseUrl = '/api/v1/clinician/anal';

const clinicianAnalyticsHandlers = new ClinicianAnalyticsHandlers();


router.get(
     `${baseUrl}/overall/:clinicianId`,
     clinicianAnalyticsHandlers.getOverallTotal.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/monthly/:clinicianId`,
     clinicianAnalyticsHandlers.getMonthlyTotals.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/yearly/:clinicianId`,
     clinicianAnalyticsHandlers.getYearlyTotals.bind(clinicianAnalyticsHandlers)
);


router.get(
     `${baseUrl}/case-summary/monthly/:clinicianId`,
     clinicianAnalyticsHandlers.getCaseSummaryMonthly.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/case-summary/yearly/:clinicianId`,
     clinicianAnalyticsHandlers.getCaseSummaryYearly.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/case-summary/daily/:clinicianId`,
     clinicianAnalyticsHandlers.getCaseSummaryDailyRecent.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/case-change/daily/:clinicianId`,
     clinicianAnalyticsHandlers.getDailyCaseChange.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/case-change/monthly/:clinicianId`,
     clinicianAnalyticsHandlers.getMonthlyCaseChange.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/case-change/yearly/:clinicianId`,
     clinicianAnalyticsHandlers.getYearlyCaseChange.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/revenue/:clinicianId`,
     clinicianAnalyticsHandlers.getClinicianRevenueVsTotal.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/payment-summary/:clinicianId`,
     clinicianAnalyticsHandlers.getPaymentTypeSummary.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/shift-distribution/:clinicianId`,
     clinicianAnalyticsHandlers.getCasesByShift.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/outsourced/:clinicianId`,
     clinicianAnalyticsHandlers.getCasesByOutsourced.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/growth/:clinicianId`,
     clinicianAnalyticsHandlers.getYearlyGrowthStats.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/test-breakdown/:clinicianId`,
     clinicianAnalyticsHandlers.getMonthlyTestBreakdown.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/top-outsourced/:clinicianId`,
     clinicianAnalyticsHandlers.getTopOutsourcedTests.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/dashboard/:clinicianId`,
     clinicianAnalyticsHandlers.getAllAnalytics.bind(clinicianAnalyticsHandlers)
);

router.get(
     `${baseUrl}/endpoints`,
     clinicianAnalyticsHandlers.getEndpoints.bind(clinicianAnalyticsHandlers)
);


router.get(
     `${baseUrl}/commissions/range`,
     clinicianAnalyticsHandlers.getCliniciansCommissionbyDate.bind(clinicianAnalyticsHandlers)
);


router.get(
     `${baseUrl}/commissions/range/single`,
     clinicianAnalyticsHandlers.getClinicianCommissionHandler.bind(clinicianAnalyticsHandlers)
);
export default router;