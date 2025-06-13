"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLifetimeTransactionSummary = exports.getTrendsAnalytics = exports.getMonthlyAnalytics = exports.getYearlyAnalytics = exports.getPatientAnalytics = void 0;
const PatientAnalyticsRepository_1 = __importDefault(require("../../../repositories/patientRepositories/PatientAnalyticsRepository"));
const helper_1 = require("../../../hooks/helper");
async function getPatientAnalytics(req, res) {
    try {
        const { patientid, year, month } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        if (!patientid || !year || isNaN(Number(patientid)) || isNaN(Number(year))) {
            return (0, helper_1.customError)("Invalid parameters: patientid and year are required", 400, res);
        }
        const analyticsRepo = new PatientAnalyticsRepository_1.default(tenantId);
        const yearlyData = await analyticsRepo.getYearlyTransactionSummary(Number(patientid), Number(year));
        const trends = await analyticsRepo.getTransactionTrends(Number(patientid));
        const outstanding = await analyticsRepo.getOutstandingBalance(Number(patientid));
        res.json({ status: true, data: { yearly: yearlyData, trends, outstanding } });
    }
    catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch patient analytics' });
    }
}
exports.getPatientAnalytics = getPatientAnalytics;
async function getYearlyAnalytics(req, res) {
    try {
        const { patientId, year } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        if (!patientId || !year) {
            return res.status(400).json({
                status: false,
                message: 'Patient ID and year are required'
            });
        }
        const parsedPatientId = parseInt(patientId);
        const parsedYear = parseInt(year);
        if (isNaN(parsedPatientId) || isNaN(parsedYear)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid patient ID or year format'
            });
        }
        const analyticsRepo = new PatientAnalyticsRepository_1.default(tenantId);
        const yearlyData = await analyticsRepo.getYearlyTransactionSummary(parsedPatientId, parsedYear);
        res.json({ status: true, data: yearlyData });
    }
    catch (error) {
        console.error('Yearly analytics error:', error);
        res.status(500).json({ status: false, message: 'Failed to fetch yearly analytics' });
    }
}
exports.getYearlyAnalytics = getYearlyAnalytics;
async function getMonthlyAnalytics(req, res) {
    try {
        const { patientid, year, month } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        if (!patientid || !year || !month || isNaN(Number(patientid)) || isNaN(Number(year)) || isNaN(Number(month))) {
            return res.status(400).json({
                status: false,
                message: 'Invalid parameters: patientid, year, and month are required'
            });
        }
        const analyticsRepo = new PatientAnalyticsRepository_1.default(tenantId);
        const monthlyData = await analyticsRepo.getMonthlyTransactionSummary(Number(patientid), Number(year), Number(month));
        res.json({ status: true, data: monthlyData });
    }
    catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch monthly analytics' });
    }
}
exports.getMonthlyAnalytics = getMonthlyAnalytics;
async function getTrendsAnalytics(req, res) {
    try {
        const { patientid, months } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        const analyticsRepo = new PatientAnalyticsRepository_1.default(tenantId);
        if (!patientid || isNaN(Number(patientid)) || !months || isNaN(Number(months))) {
            return (0, helper_1.customError)("Invalid parameters: patientid and months are required", 400, res);
        }
        const trends = await analyticsRepo.getTransactionTrends(Number(patientid), Number(months) || 6);
        res.json({ status: true, data: trends });
    }
    catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch trends' });
    }
}
exports.getTrendsAnalytics = getTrendsAnalytics;
async function getLifetimeTransactionSummary(req, res) {
    try {
        const { patientid } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        if (!patientid) {
            return res.status(400).json({
                status: false,
                message: 'Patient ID is required'
            });
        }
        const parsedPatientid = parseInt(patientid);
        if (isNaN(parsedPatientid)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid patient ID format'
            });
        }
        const analyticsRepo = new PatientAnalyticsRepository_1.default(tenantId);
        const lifetimeSummary = await analyticsRepo.getLifetimeTransactionSummary(parsedPatientid);
        res.json({
            status: true,
            data: lifetimeSummary
        });
    }
    catch (error) {
        console.error('Lifetime transaction summary error:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch lifetime transaction summary'
        });
    }
}
exports.getLifetimeTransactionSummary = getLifetimeTransactionSummary;
