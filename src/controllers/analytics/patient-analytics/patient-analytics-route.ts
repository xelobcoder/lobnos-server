import { Router } from 'express';
import {
     getAgeDistributionHandler,
     getGenderDistributionHandler,
     getMaritalStatusHandler,
     getPatientRegistrationOverTimeHandler,
     getActivationStatusHandler,
     getPreferredContactMethodHandler,
     getWhatsappUsageHandler,
     getOrganizationAffiliationHandler,
     getDesignationHandler,
     getNamePatternsHandler,
     getUniqueIdentifiersHandler,
     getAgeTypeAnalysisHandler,
     getAgeGroupSegmentationHandler,
     getOccupationDistributionHandler,
     getOccupationVsAgeGenderHandler,
     getMissingDataAnalysisHandler,
     getDuplicateRecordsHandler,
     getDateOfBirthAnalysisHandler,
     getRegistrationDateVsActivationHandler,
     getCombinedAttributesHandler,
     getHighValuePatientsHandler,
     getPatientChurnPredictionHandler,
     getAgeRelatedHealthRisksHandler,
     getDashboardsHandler,
     getMonthlyPatientRegistrationTrendHandler,
} from './patient-analytics-handlers';

const router = Router();

router.get('/api/v1/patient-analytics/age-distribution', getAgeDistributionHandler);
router.get('/api/v1/patient-analytics/gender-distribution', getGenderDistributionHandler);
router.get('/api/v1/patient-analytics/marital-status', getMaritalStatusHandler);
router.get('/api/v1/patient-analytics/patient-registration-over-time', getPatientRegistrationOverTimeHandler);
router.get('/api/v1/patient-analytics/activation-status', getActivationStatusHandler);
router.get('/api/v1/patient-analytics/preferred-contact-method', getPreferredContactMethodHandler);
router.get('/api/v1/patient-analytics/whatsapp-usage', getWhatsappUsageHandler);
router.get('/api/v1/patient-analytics/organization-affiliation', getOrganizationAffiliationHandler);
router.get('/api/v1/patient-analytics/designation', getDesignationHandler);
router.get('/api/v1/patient-analytics/name-patterns', getNamePatternsHandler);
router.get('/api/v1/patient-analytics/unique-identifiers', getUniqueIdentifiersHandler);
router.get('/api/v1/patient-analytics/age-type-analysis', getAgeTypeAnalysisHandler);
router.get('/api/v1/patient-analytics/age-group-segmentation', getAgeGroupSegmentationHandler);
router.get('/api/v1/patient-analytics/occupation-distribution', getOccupationDistributionHandler);
router.get('/api/v1/patient-analytics/occupation-vs-age-gender', getOccupationVsAgeGenderHandler);
router.get('/api/v1/patient-analytics/missing-data-analysis', getMissingDataAnalysisHandler);
router.get('/api/v1/patient-analytics/duplicate-records', getDuplicateRecordsHandler);
router.get('/api/v1/patient-analytics/date-of-birth-analysis', getDateOfBirthAnalysisHandler);
router.get('/api/v1/patient-analytics/registration-date-vs-activation', getRegistrationDateVsActivationHandler);
router.get('/api/v1/patient-analytics/combined-attributes', getCombinedAttributesHandler);
router.get('/api/v1/patient-analytics/high-value-patients', getHighValuePatientsHandler);
router.get('/api/v1/patient-analytics/patient-churn-prediction', getPatientChurnPredictionHandler);
router.get('/api/v1/patient-analytics/age-related-health-risks', getAgeRelatedHealthRisksHandler);
router.get('/api/v1/patient-analytics/dashboards', getDashboardsHandler);
router.get('/api/v1/patient-analytics/monthly-patient-registration-trend', getMonthlyPatientRegistrationTrendHandler);

router.get('/api/v1/patient-analytics/routes', (req, res) => {
     const routes = [
          { endpoint: '/api/v1/patient-analytics/age-distribution', description: 'Retrieve age distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/gender-distribution', description: 'Retrieve gender distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/marital-status', description: 'Retrieve marital status distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/patient-registration-over-time', description: 'Retrieve patient registration trends over time.' },
          { endpoint: '/api/v1/patient-analytics/activation-status', description: 'Retrieve patient activation status.' },
          { endpoint: '/api/v1/patient-analytics/preferred-contact-method', description: 'Retrieve preferred contact methods of patients.' },
          { endpoint: '/api/v1/patient-analytics/whatsapp-usage', description: 'Retrieve WhatsApp usage among patients.' },
          { endpoint: '/api/v1/patient-analytics/organization-affiliation', description: 'Retrieve organization affiliation of patients.' },
          { endpoint: '/api/v1/patient-analytics/designation', description: 'Retrieve designation distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/name-patterns', description: 'Retrieve patterns in patient names.' },
          { endpoint: '/api/v1/patient-analytics/unique-identifiers', description: 'Retrieve duplicate unique identifiers of patients.' },
          { endpoint: '/api/v1/patient-analytics/age-type-analysis', description: 'Retrieve age type analysis data.' },
          { endpoint: '/api/v1/patient-analytics/age-group-segmentation', description: 'Retrieve age group segmentation of patients.' },
          { endpoint: '/api/v1/patient-analytics/occupation-distribution', description: 'Retrieve occupation distribution of patients.' },
          { endpoint: '/api/v1/patient-analytics/occupation-vs-age-gender', description: 'Retrieve average age per occupation and gender.' },
          { endpoint: '/api/v1/patient-analytics/missing-data-analysis', description: 'Retrieve analysis on missing data fields.' },
          { endpoint: '/api/v1/patient-analytics/duplicate-records', description: 'Retrieve duplicate records of patients.' },
          { endpoint: '/api/v1/patient-analytics/date-of-birth-analysis', description: 'Retrieve date of birth analysis data.' },
          { endpoint: '/api/v1/patient-analytics/registration-date-vs-activation', description: 'Retrieve registration date versus activation status.' },
          { endpoint: '/api/v1/patient-analytics/combined-attributes', description: 'Retrieve combined attributes (gender, marital status, occupation) data.' },
          { endpoint: '/api/v1/patient-analytics/high-value-patients', description: 'Retrieve high value patients.' },
          { endpoint: '/api/v1/patient-analytics/patient-churn-prediction', description: 'Retrieve patient churn prediction data.' },
          { endpoint: '/api/v1/patient-analytics/age-related-health-risks', description: 'Retrieve age-related health risk analysis data.' },
          { endpoint: '/api/v1/patient-analytics/dashboards', description: 'Retrieve dashboard metrics for patients.' },
          { endpoint: '/api/v1/patient-analytics/monthly-patient-registration-trend', description: 'Retrieve monthly patient registration trend data.' },
     ];
     res.status(200).json(routes);
});

export default router;
