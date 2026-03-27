import { Router } from 'express';
import ClinicianAnalyticsHandlers from './clinicians-analytics';
import { handleOverLoad } from '../../../hooks/helper';

const router = Router();
const baseUrl = '/api/v1/clinician/anal';

const clinicianAnalyticsHandlers = new ClinicianAnalyticsHandlers();


router.get(
     `${baseUrl}/overall/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getOverallTotal.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/monthly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getMonthlyTotals.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/yearly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getYearlyTotals.bind(clinicianAnalyticsHandlers))
);


router.get(
     `${baseUrl}/case-summary/monthly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getCaseSummaryMonthly.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/case-summary/yearly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getCaseSummaryYearly.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/case-summary/daily/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getCaseSummaryDailyRecent.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/case-change/daily/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getDailyCaseChange.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/case-change/monthly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getMonthlyCaseChange.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/case-change/yearly/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getYearlyCaseChange.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/revenue/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getClinicianRevenueVsTotal.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/payment-summary/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getPaymentTypeSummary.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/shift-distribution/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getCasesByShift.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/outsourced/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getCasesByOutsourced.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/growth/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getYearlyGrowthStats.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/test-breakdown/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getMonthlyTestBreakdown.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/top-outsourced/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getTopOutsourcedTests.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/dashboard/:clinicianId`,
     handleOverLoad(clinicianAnalyticsHandlers.getAllAnalytics.bind(clinicianAnalyticsHandlers))
);

router.get(
     `${baseUrl}/endpoints`,
     handleOverLoad(clinicianAnalyticsHandlers.getEndpoints.bind(clinicianAnalyticsHandlers))
);


router.get(
     `${baseUrl}/commissions/range`,
     handleOverLoad(clinicianAnalyticsHandlers.getCliniciansCommissionbyDate.bind(clinicianAnalyticsHandlers))
);


router.get(
     `${baseUrl}/commissions/range/single`,
     handleOverLoad(clinicianAnalyticsHandlers.getClinicianCommissionHandler.bind(clinicianAnalyticsHandlers))
);
export default router;