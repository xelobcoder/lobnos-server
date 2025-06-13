"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDayTotalRegisteredClientHandler = exports.getMonthlyPatientRegistrationTrendHandler = exports.getDashboardsHandler = exports.getAgeRelatedHealthRisksHandler = exports.getPatientChurnPredictionHandler = exports.getHighValuePatientsHandler = exports.getCombinedAttributesHandler = exports.getRegistrationDateVsActivationHandler = exports.getDateOfBirthAnalysisHandler = exports.getDuplicateRecordsHandler = exports.getMissingDataAnalysisHandler = exports.getOccupationVsAgeGenderHandler = exports.getOccupationDistributionHandler = exports.getAgeGroupSegmentationHandler = exports.getAgeTypeAnalysisHandler = exports.getUniqueIdentifiersHandler = exports.getNamePatternsHandler = exports.getDesignationHandler = exports.getOrganizationAffiliationHandler = exports.getWhatsappUsageHandler = exports.getPreferredContactMethodHandler = exports.getActivationStatusHandler = exports.getPatientRegistrationOverTimeHandler = exports.getMaritalStatusHandler = exports.getGenderDistributionHandler = exports.getAgeDistributionHandler = void 0;
const patients_analytics_class_1 = require("../../../models/analytics/patient-analytics/patients-analytics-class");
const analytics = new patients_analytics_class_1.PatientAnalytics();
const getAgeDistributionHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getAgeDistribution(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching age distribution data' });
    }
};
exports.getAgeDistributionHandler = getAgeDistributionHandler;
const getGenderDistributionHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getGenderDistribution(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching gender distribution data' });
    }
};
exports.getGenderDistributionHandler = getGenderDistributionHandler;
const getMaritalStatusHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getMaritalStatus(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching marital status data' });
    }
};
exports.getMaritalStatusHandler = getMaritalStatusHandler;
const getPatientRegistrationOverTimeHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getPatientRegistrationOverTime(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching patient registration over time data' });
    }
};
exports.getPatientRegistrationOverTimeHandler = getPatientRegistrationOverTimeHandler;
const getActivationStatusHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getActivationStatus(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching activation status data' });
    }
};
exports.getActivationStatusHandler = getActivationStatusHandler;
const getPreferredContactMethodHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getPreferredContactMethod(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching preferred contact method data' });
    }
};
exports.getPreferredContactMethodHandler = getPreferredContactMethodHandler;
const getWhatsappUsageHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getWhatsappUsage(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching WhatsApp usage data' });
    }
};
exports.getWhatsappUsageHandler = getWhatsappUsageHandler;
const getOrganizationAffiliationHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getOrganizationAffiliation(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching organization affiliation data' });
    }
};
exports.getOrganizationAffiliationHandler = getOrganizationAffiliationHandler;
const getDesignationHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getDesignation(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching designation data' });
    }
};
exports.getDesignationHandler = getDesignationHandler;
const getNamePatternsHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getNamePatterns(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching name patterns data' });
    }
};
exports.getNamePatternsHandler = getNamePatternsHandler;
const getUniqueIdentifiersHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getUniqueIdentifiers(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching unique identifiers data' });
    }
};
exports.getUniqueIdentifiersHandler = getUniqueIdentifiersHandler;
const getAgeTypeAnalysisHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getAgeTypeAnalysis(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching age type analysis data' });
    }
};
exports.getAgeTypeAnalysisHandler = getAgeTypeAnalysisHandler;
const getAgeGroupSegmentationHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getAgeGroupSegmentation(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching age group segmentation data' });
    }
};
exports.getAgeGroupSegmentationHandler = getAgeGroupSegmentationHandler;
const getOccupationDistributionHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getOccupationDistribution(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching occupation distribution data' });
    }
};
exports.getOccupationDistributionHandler = getOccupationDistributionHandler;
const getOccupationVsAgeGenderHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getOccupationVsAgeGender(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching occupation vs age/gender data' });
    }
};
exports.getOccupationVsAgeGenderHandler = getOccupationVsAgeGenderHandler;
const getMissingDataAnalysisHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getMissingDataAnalysis(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching missing data analysis' });
    }
};
exports.getMissingDataAnalysisHandler = getMissingDataAnalysisHandler;
const getDuplicateRecordsHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getDuplicateRecords(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching duplicate records data' });
    }
};
exports.getDuplicateRecordsHandler = getDuplicateRecordsHandler;
const getDateOfBirthAnalysisHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getDateOfBirthAnalysis(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching date of birth analysis data' });
    }
};
exports.getDateOfBirthAnalysisHandler = getDateOfBirthAnalysisHandler;
const getRegistrationDateVsActivationHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getRegistrationDateVsActivation(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching registration date vs activation data' });
    }
};
exports.getRegistrationDateVsActivationHandler = getRegistrationDateVsActivationHandler;
const getCombinedAttributesHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getCombinedAttributes(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching combined attributes data' });
    }
};
exports.getCombinedAttributesHandler = getCombinedAttributesHandler;
const getHighValuePatientsHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getHighValuePatients(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching high value patients data' });
    }
};
exports.getHighValuePatientsHandler = getHighValuePatientsHandler;
const getPatientChurnPredictionHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getPatientChurnPrediction(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching patient churn prediction data' });
    }
};
exports.getPatientChurnPredictionHandler = getPatientChurnPredictionHandler;
const getAgeRelatedHealthRisksHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getAgeRelatedHealthRisks(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching age related health risks data' });
    }
};
exports.getAgeRelatedHealthRisksHandler = getAgeRelatedHealthRisksHandler;
const getDashboardsHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getDashboards(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching dashboards data' });
    }
};
exports.getDashboardsHandler = getDashboardsHandler;
const getMonthlyPatientRegistrationTrendHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getMonthlyPatientRegistrationTrend(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
    }
};
exports.getMonthlyPatientRegistrationTrendHandler = getMonthlyPatientRegistrationTrendHandler;
const getDayTotalRegisteredClientHandler = async (req, res) => {
    try {
        const { TenantId } = req.query;
        const result = await analytics.getDayTotalRegisteredClient(parseInt(TenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
    }
};
exports.getDayTotalRegisteredClientHandler = getDayTotalRegisteredClientHandler;
