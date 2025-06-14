import express from 'express';
import {
    getPatientAnalytics,
    getYearlyAnalytics,
    getMonthlyAnalytics,
    getTrendsAnalytics,
    getLifetimeTransactionSummary
} from './PatientAnalyticsController';
import { handleOverLoad } from '../../../hooks/helper';

const router = express.Router();

// Patient Analytics Routes
router.get('/api/v1/patient/individual/analytics', getPatientAnalytics);
router.get('/api/v1/patient/individual/analytics/yearly', async (req: express.Request, res: express.Response) => {
    await getYearlyAnalytics(req, res);
});
router.get('/api/v1/patient/individual/analytics/monthly', handleOverLoad(getMonthlyAnalytics));
router.get('/api/v1/patient/individual/analytics/trends', getTrendsAnalytics);

// Lifetime Transaction Summary Route
router.get('/api/v1/patient/individual/analytics/lifetime', handleOverLoad(getLifetimeTransactionSummary));

export default router;