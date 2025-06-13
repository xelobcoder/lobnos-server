import { promisifyQuery } from '../../../hooks/helper';
import {
     q_patient_analytics_age_distribution,
     q_patient_analytics_gender_distribution,
     q_patient_analytics_marital_status,
     q_patient_analytics_patient_registration_over_time,
     q_patient_analytics_activation_status,
     q_patient_analytics_preferred_contact_method,
     q_patient_analytics_whatsapp_usage,
     q_patient_analytics_organization_affiliation,
     q_patient_analytics_designation,
     q_patient_analytics_name_patterns,
     q_patient_analytics_unique_identifiers,
     q_patient_analytics_age_type_analysis,
     q_patient_analytics_age_group_segmentation,
     q_patient_analytics_occupation_distribution,
     q_patient_analytics_occupation_vs_age_gender,
     q_patient_analytics_missing_data_analysis,
     q_patient_analytics_duplicate_records,
     q_patient_analytics_date_of_birth_analysis,
     q_patient_analytics_registration_date_vs_activation,
     q_patient_analytics_combined_attributes,
     q_patient_analytics_high_value_patients,
     q_patient_analytics_patient_churn_prediction,
     q_patient_analytics_age_related_health_risks,
     q_patient_analytics_dashboards,
     q_patient_analytics_monthly_patient_registration_trend,
     q_patient_analytics_day_registered_client,
} from './patient-analytics-queries';

export class PatientAnalytics {
     async getAgeDistribution(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_age_distribution, []);
     }

     async getGenderDistribution(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_gender_distribution, []);
     }

     async getMaritalStatus(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_marital_status, []);
     }

     async getPatientRegistrationOverTime(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_patient_registration_over_time, []);
     }

     async getActivationStatus(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_activation_status, []);
     }

     async getPreferredContactMethod(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_preferred_contact_method, []);
     }

     async getWhatsappUsage(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_whatsapp_usage, []);
     }

     async getOrganizationAffiliation(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_organization_affiliation, []);
     }

     async getDesignation(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_designation, []);
     }

     async getNamePatterns(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_name_patterns, []);
     }

     async getUniqueIdentifiers(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_unique_identifiers, []);
     }

     async getAgeTypeAnalysis(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_age_type_analysis, []);
     }

     async getAgeGroupSegmentation(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_age_group_segmentation, []);
     }

     async getOccupationDistribution(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_occupation_distribution, []);
     }

     async getOccupationVsAgeGender(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_occupation_vs_age_gender, []);
     }

     async getMissingDataAnalysis(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_missing_data_analysis, []);
     }

     async getDuplicateRecords(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_duplicate_records, []);
     }

     async getDateOfBirthAnalysis(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_date_of_birth_analysis, []);
     }

     async getRegistrationDateVsActivation(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_registration_date_vs_activation, []);
     }

     async getCombinedAttributes(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_combined_attributes, []);
     }

     async getHighValuePatients(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_high_value_patients, []);
     }

     async getPatientChurnPrediction(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_patient_churn_prediction, []);
     }

     async getAgeRelatedHealthRisks(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_age_related_health_risks, []);
     }

     async getDashboards(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_dashboards, []);
     }

     async getMonthlyPatientRegistrationTrend(tenantId:number): Promise<any> {
          return promisifyQuery(tenantId,q_patient_analytics_monthly_patient_registration_trend, []);
     }

     async getDayTotalRegisteredClient(tenantId:number): Promise<any> {
          const result = await promisifyQuery(tenantId,q_patient_analytics_day_registered_client, []);
          return result[0]['count']
     }
}
