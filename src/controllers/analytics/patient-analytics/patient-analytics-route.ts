import { Router } from 'express';
import {
     getAgeDistributionHandler,
     getGenderDistributionHandler,
     getMaritalStatusHandler,
     getPatientRegistrationOverTimeHandler,
     getActivationStatusHandler,
     getUniqueIdentifiersHandler,
     getOccupationDistributionHandler,
     getMissingDataAnalysisHandler,
     getDuplicateRecordsHandler,
     getDashboardsHandler,
     getMonthlyPatientRegistrationTrendHandler,
} from './patient-analytics-handlers';

const router = Router();

router.get('/api/v1/patient-analytics/age-distribution', getAgeDistributionHandler);
router.get('/api/v1/patient-analytics/gender-distribution', getGenderDistributionHandler);
router.get('/api/v1/patient-analytics/marital-status', getMaritalStatusHandler);
router.get('/api/v1/patient-analytics/patient-registration-over-time', getPatientRegistrationOverTimeHandler);
router.get('/api/v1/patient-analytics/activation-status', getActivationStatusHandler);
router.get('/api/v1/patient-analytics/unique-identifiers', getUniqueIdentifiersHandler);
router.get('/api/v1/patient-analytics/occupation-distribution', getOccupationDistributionHandler);
router.get('/api/v1/patient-analytics/missing-data-analysis', getMissingDataAnalysisHandler);
router.get('/api/v1/patient-analytics/duplicate-records', getDuplicateRecordsHandler);
router.get('/api/v1/patient-analytics/dashboards', getDashboardsHandler);
router.get('/api/v1/patient-analytics/monthly-patient-registration-trend', getMonthlyPatientRegistrationTrendHandler);

router.get('/api/v1/patient-analytics/routes', (req, res) => {
     const routes = [
          { endpoint: '/api/v1/patient-analytics/age-distribution', description: 'Retrieve age distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/gender-distribution', description: 'Retrieve gender distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/marital-status', description: 'Retrieve marital status distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/patient-registration-over-time', description: 'Retrieve patient registration trends over time.' },
          { endpoint: '/api/v1/patient-analytics/activation-status', description: 'Retrieve patient activation status.' },
          { endpoint: '/api/v1/patient-analytics/designation', description: 'Retrieve designation distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/unique-identifiers', description: 'Retrieve duplicate unique identifiers of patients.' },
          { endpoint: '/api/v1/patient-analytics/occupation-distribution', description: 'Retrieve occupation distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/missing-data-analysis', description: 'Retrieve analysis on missing data fields.' },
          { endpoint: '/api/v1/patient-analytics/duplicate-records', description: 'Retrieve duplicate records of patients.' },
          { endpoint: '/api/v1/patient-analytics/registration-date-vs-activation', description: 'Retrieve registration date versus activation status.' },
          { endpoint: '/api/v1/patient-analytics/dashboards', description: 'Retrieve dashboard metrics for patients.' },
          { endpoint: '/api/v1/patient-analytics/monthly-patient-registration-trend', description: 'Retrieve monthly patient registration trend data.' },
     ];
     res.status(200).json(routes);
});

export default router;
