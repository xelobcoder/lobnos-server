import { promisifyQuery } from '../../../hooks/helper';
import {
     q_patient_analytics_age_distribution,
     q_patient_analytics_gender_distribution,
     q_patient_analytics_marital_status,
     q_patient_analytics_patient_registration_over_time,
     q_patient_analytics_activation_status,
     q_patient_analytics_unique_identifiers,
     q_patient_analytics_occupation_distribution,
     q_patient_analytics_missing_data_analysis,
     q_patient_analytics_duplicate_records,
     q_patient_analytics_dashboards,
     q_patient_analytics_monthly_patient_registration_trend,
     q_patient_analytics_day_registered_client,
} from './patient-analytics-queries';

export class PatientAnalytics {
     async getAgeDistribution(tenantId: number, interval: number = 10): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_age_distribution, [interval]);
     }

     async getGenderDistribution(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_gender_distribution, []);
     }

     async getMaritalStatus(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_marital_status, []);
     }

     async getPatientRegistrationOverTime(tenantId: number, start: Date = new Date(), end: Date = new Date()): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_patient_registration_over_time, [start, end]);
     }

     async getActivationStatus(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_activation_status, []);
     }

  

     async getUniqueIdentifiers(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_unique_identifiers, []);
     }

     async getOccupationDistribution(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_occupation_distribution, []);
     }

     

     async getMissingDataAnalysis(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_missing_data_analysis, []);
     }

     async getDuplicateRecords(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_duplicate_records, []);
     }


     async getDashboards(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_dashboards, []);
     }

     async getMonthlyPatientRegistrationTrend(tenantId: number): Promise<any> {
          return await promisifyQuery(tenantId, q_patient_analytics_monthly_patient_registration_trend, []);
     }

     async getDayTotalRegisteredClient(tenantId: number): Promise<any> {
          const result = await promisifyQuery(tenantId, q_patient_analytics_day_registered_client, []);
          return result[0]['count']
     }
}
