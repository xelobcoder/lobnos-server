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
router.get('/api/v1/patient-analytics/unique-identifiers', patient_analytics_handlers_1.getUniqueIdentifiersHandler);
router.get('/api/v1/patient-analytics/occupation-distribution', patient_analytics_handlers_1.getOccupationDistributionHandler);
router.get('/api/v1/patient-analytics/missing-data-analysis', patient_analytics_handlers_1.getMissingDataAnalysisHandler);
router.get('/api/v1/patient-analytics/duplicate-records', patient_analytics_handlers_1.getDuplicateRecordsHandler);
router.get('/api/v1/patient-analytics/dashboards', patient_analytics_handlers_1.getDashboardsHandler);
router.get('/api/v1/patient-analytics/monthly-patient-registration-trend', patient_analytics_handlers_1.getMonthlyPatientRegistrationTrendHandler);
router.get('/api/v1/patient-analytics/day-registered-client', patient_analytics_handlers_1.getDayTotalRegisteredClientHandler);
router.get('/api/v1/patient-analytics/registration-by-day-of-week', patient_analytics_handlers_1.getRegistrationByDayOfWeekHandler);
router.get('/api/v1/patient-analytics/contact-completeness', patient_analytics_handlers_1.getContactCompletenessHandler);
router.get('/api/v1/patient-analytics/staff-registration-performance', patient_analytics_handlers_1.getStaffRegistrationPerformanceHandler);
router.get('/api/v1/patient-analytics/staff-registration-trends', patient_analytics_handlers_1.getStaffRegistrationTrendsHandler);
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
        { endpoint: '/api/v1/patient-analytics/day-registered-client', description: 'Retrieve daily registered client count.' },
        { endpoint: '/api/v1/patient-analytics/registration-by-day-of-week', description: 'Retrieve patient registration distribution by day of week.' },
        { endpoint: '/api/v1/patient-analytics/contact-completeness', description: 'Retrieve contact information completeness analysis.' },
        { endpoint: '/api/v1/patient-analytics/staff-registration-performance', description: 'Retrieve staff registration performance (staff tracking not available in current data).' },
        { endpoint: '/api/v1/patient-analytics/staff-registration-trends', description: 'Retrieve daily registration trends for the last 30 days.' },
    ];
    res.status(200).json(routes);
});
exports.default = router;
