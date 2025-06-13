"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAnalytics = void 0;
const helper_1 = require("../../../hooks/helper");
const patient_analytics_queries_1 = require("./patient-analytics-queries");
class PatientAnalytics {
    async getAgeDistribution(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_age_distribution, []);
    }
    async getGenderDistribution(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_gender_distribution, []);
    }
    async getMaritalStatus(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_marital_status, []);
    }
    async getPatientRegistrationOverTime(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_patient_registration_over_time, []);
    }
    async getActivationStatus(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_activation_status, []);
    }
    async getPreferredContactMethod(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_preferred_contact_method, []);
    }
    async getWhatsappUsage(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_whatsapp_usage, []);
    }
    async getOrganizationAffiliation(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_organization_affiliation, []);
    }
    async getDesignation(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_designation, []);
    }
    async getNamePatterns(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_name_patterns, []);
    }
    async getUniqueIdentifiers(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_unique_identifiers, []);
    }
    async getAgeTypeAnalysis(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_age_type_analysis, []);
    }
    async getAgeGroupSegmentation(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_age_group_segmentation, []);
    }
    async getOccupationDistribution(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_occupation_distribution, []);
    }
    async getOccupationVsAgeGender(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_occupation_vs_age_gender, []);
    }
    async getMissingDataAnalysis(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_missing_data_analysis, []);
    }
    async getDuplicateRecords(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_duplicate_records, []);
    }
    async getDateOfBirthAnalysis(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_date_of_birth_analysis, []);
    }
    async getRegistrationDateVsActivation(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_registration_date_vs_activation, []);
    }
    async getCombinedAttributes(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_combined_attributes, []);
    }
    async getHighValuePatients(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_high_value_patients, []);
    }
    async getPatientChurnPrediction(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_patient_churn_prediction, []);
    }
    async getAgeRelatedHealthRisks(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_age_related_health_risks, []);
    }
    async getDashboards(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_dashboards, []);
    }
    async getMonthlyPatientRegistrationTrend(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_monthly_patient_registration_trend, []);
    }
    async getDayTotalRegisteredClient(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, patient_analytics_queries_1.q_patient_analytics_day_registered_client, []);
        return result[0]['count'];
    }
}
exports.PatientAnalytics = PatientAnalytics;
