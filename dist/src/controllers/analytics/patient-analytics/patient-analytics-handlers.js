"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffRegistrationTrendsHandler = exports.getStaffRegistrationPerformanceHandler = exports.getContactCompletenessHandler = exports.getRegistrationByDayOfWeekHandler = exports.getDayTotalRegisteredClientHandler = exports.getMonthlyPatientRegistrationTrendHandler = exports.getDashboardsHandler = exports.getDuplicateRecordsHandler = exports.getMissingDataAnalysisHandler = exports.getOccupationDistributionHandler = exports.getUniqueIdentifiersHandler = exports.getActivationStatusHandler = exports.getPatientRegistrationOverTimeHandler = exports.getMaritalStatusHandler = exports.getGenderDistributionHandler = exports.getAgeDistributionHandler = void 0;
const patients_analytics_class_1 = require("../../../models/analytics/patient-analytics/patients-analytics-class");
const analytics = new patients_analytics_class_1.PatientAnalytics();
const getAgeDistributionHandler = async (req, res) => {
    try {
        const { tenantId, interval, min_age, max_age } = req.query;
        const result = await analytics.getAgeDistribution(parseInt(tenantId.toString()), parseInt((interval === null || interval === void 0 ? void 0 : interval.toString()) || '10'), parseInt((min_age === null || min_age === void 0 ? void 0 : min_age.toString()) || '0'), parseInt((max_age === null || max_age === void 0 ? void 0 : max_age.toString()) || '120'));
        res.status(200).json(Array.isArray(result) ? result : []);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching age distribution data' });
    }
};
exports.getAgeDistributionHandler = getAgeDistributionHandler;
const getGenderDistributionHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getGenderDistribution(parseInt(tenantId.toString()));
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
        const { tenantId } = req.query;
        const result = await analytics.getMaritalStatus(parseInt(tenantId.toString()));
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
        const { tenantId, startdate, enddate } = req.query;
        if (!startdate || !enddate) {
            res.status(400).json({ error: 'Invalid date range' });
            return;
        }
        const result = await analytics.getPatientRegistrationOverTime(parseInt(tenantId.toString()), new Date(startdate.toString()), new Date(enddate.toString()));
        res.status(200).json(Array.isArray(result) ? result : []);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching patient registration over time data' });
    }
};
exports.getPatientRegistrationOverTimeHandler = getPatientRegistrationOverTimeHandler;
const getActivationStatusHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getActivationStatus(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching activation status data' });
    }
};
exports.getActivationStatusHandler = getActivationStatusHandler;
const getUniqueIdentifiersHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getUniqueIdentifiers(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching unique identifiers data' });
    }
};
exports.getUniqueIdentifiersHandler = getUniqueIdentifiersHandler;
const getOccupationDistributionHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getOccupationDistribution(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching occupation distribution data' });
    }
};
exports.getOccupationDistributionHandler = getOccupationDistributionHandler;
const getMissingDataAnalysisHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getMissingDataAnalysis(parseInt(tenantId.toString()));
        res.status(200).json(Array.isArray(result) ? result[0] : []);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching missing data analysis' });
    }
};
exports.getMissingDataAnalysisHandler = getMissingDataAnalysisHandler;
const getDuplicateRecordsHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getDuplicateRecords(parseInt(tenantId.toString()));
        res.status(200).json(Array.isArray(result) ? result[0] : []);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching duplicate records data' });
    }
};
exports.getDuplicateRecordsHandler = getDuplicateRecordsHandler;
const getDashboardsHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getDashboards(parseInt(tenantId.toString()));
        res.status(200).json(Array.isArray(result) ? result : []);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching dashboards data' });
    }
};
exports.getDashboardsHandler = getDashboardsHandler;
const getMonthlyPatientRegistrationTrendHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getMonthlyPatientRegistrationTrend(parseInt(tenantId.toString()));
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
        const { tenantId } = req.query;
        const result = await analytics.getDayTotalRegisteredClient(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
    }
};
exports.getDayTotalRegisteredClientHandler = getDayTotalRegisteredClientHandler;
const getRegistrationByDayOfWeekHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getRegistrationByDayOfWeek(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching registration by day of week data' });
    }
};
exports.getRegistrationByDayOfWeekHandler = getRegistrationByDayOfWeekHandler;
const getContactCompletenessHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getContactCompleteness(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching contact completeness data' });
    }
};
exports.getContactCompletenessHandler = getContactCompletenessHandler;
const getStaffRegistrationPerformanceHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getStaffRegistrationPerformance(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching staff registration performance data' });
    }
};
exports.getStaffRegistrationPerformanceHandler = getStaffRegistrationPerformanceHandler;
const getStaffRegistrationTrendsHandler = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const result = await analytics.getStaffRegistrationTrends(parseInt(tenantId.toString()));
        res.status(200).json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching staff registration trends data' });
    }
};
exports.getStaffRegistrationTrendsHandler = getStaffRegistrationTrendsHandler;
