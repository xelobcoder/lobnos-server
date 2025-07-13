"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAnalytics = void 0;
const helper_1 = require("../../../hooks/helper");
const patient_analytics_queries_1 = require("./patient-analytics-queries");
class PatientAnalytics {
    async getAgeDistribution(tenantId, interval = 10) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_age_distribution, [interval]);
    }
    async getGenderDistribution(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_gender_distribution, []);
    }
    async getMaritalStatus(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_marital_status, []);
    }
    async getPatientRegistrationOverTime(tenantId, start = new Date(), end = new Date()) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_patient_registration_over_time, [start, end]);
    }
    async getActivationStatus(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_activation_status, []);
    }
    async getUniqueIdentifiers(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_unique_identifiers, []);
    }
    async getOccupationDistribution(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_occupation_distribution, []);
    }
    async getMissingDataAnalysis(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_missing_data_analysis, []);
    }
    async getDuplicateRecords(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_duplicate_records, []);
    }
    async getDashboards(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_dashboards, []);
    }
    async getMonthlyPatientRegistrationTrend(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_monthly_patient_registration_trend, []);
    }
    async getDayTotalRegisteredClient(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_day_registered_client, []);
        return result[0]['count'];
    }
}
exports.PatientAnalytics = PatientAnalytics;
