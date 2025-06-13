"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patient_analytics_handlers_1 = require("./patient-analytics-handlers");
const router = (0, express_1.Router)();
router.get('/api/v1/patient-analytics/age-distribution', patient_analytics_handlers_1.getAgeDistributionHandler);
router.get('/api/v1/patient-analytics/gender-distribution', patient_analytics_handlers_1.getGenderDistributionHandler);
router.get('/api/v1/patient-analytics/marital-status', patient_analytics_handlers_1.getMaritalStatusHandler);
router.get('/api/v1/patient-analytics/patient-registration-over-time', patient_analytics_handlers_1.getPatientRegistrationOverTimeHandler);
router.get('/api/v1/patient-analytics/activation-status', patient_analytics_handlers_1.getActivationStatusHandler);
router.get('/api/v1/patient-analytics/preferred-contact-method', patient_analytics_handlers_1.getPreferredContactMethodHandler);
router.get('/api/v1/patient-analytics/whatsapp-usage', patient_analytics_handlers_1.getWhatsappUsageHandler);
router.get('/api/v1/patient-analytics/organization-affiliation', patient_analytics_handlers_1.getOrganizationAffiliationHandler);
router.get('/api/v1/patient-analytics/designation', patient_analytics_handlers_1.getDesignationHandler);
router.get('/api/v1/patient-analytics/name-patterns', patient_analytics_handlers_1.getNamePatternsHandler);
router.get('/api/v1/patient-analytics/unique-identifiers', patient_analytics_handlers_1.getUniqueIdentifiersHandler);
router.get('/api/v1/patient-analytics/age-type-analysis', patient_analytics_handlers_1.getAgeTypeAnalysisHandler);
router.get('/api/v1/patient-analytics/age-group-segmentation', patient_analytics_handlers_1.getAgeGroupSegmentationHandler);
router.get('/api/v1/patient-analytics/occupation-distribution', patient_analytics_handlers_1.getOccupationDistributionHandler);
router.get('/api/v1/patient-analytics/occupation-vs-age-gender', patient_analytics_handlers_1.getOccupationVsAgeGenderHandler);
router.get('/api/v1/patient-analytics/missing-data-analysis', patient_analytics_handlers_1.getMissingDataAnalysisHandler);
router.get('/api/v1/patient-analytics/duplicate-records', patient_analytics_handlers_1.getDuplicateRecordsHandler);
router.get('/api/v1/patient-analytics/date-of-birth-analysis', patient_analytics_handlers_1.getDateOfBirthAnalysisHandler);
router.get('/api/v1/patient-analytics/registration-date-vs-activation', patient_analytics_handlers_1.getRegistrationDateVsActivationHandler);
router.get('/api/v1/patient-analytics/combined-attributes', patient_analytics_handlers_1.getCombinedAttributesHandler);
router.get('/api/v1/patient-analytics/high-value-patients', patient_analytics_handlers_1.getHighValuePatientsHandler);
router.get('/api/v1/patient-analytics/patient-churn-prediction', patient_analytics_handlers_1.getPatientChurnPredictionHandler);
router.get('/api/v1/patient-analytics/age-related-health-risks', patient_analytics_handlers_1.getAgeRelatedHealthRisksHandler);
router.get('/api/v1/patient-analytics/dashboards', patient_analytics_handlers_1.getDashboardsHandler);
router.get('/api/v1/patient-analytics/monthly-patient-registration-trend', patient_analytics_handlers_1.getMonthlyPatientRegistrationTrendHandler);
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
exports.default = router;
