import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: query }));

import { PatientAnalytics } from './patients-analytics-class';
import {
     q_patient_analytics_combined_attributes,
     q_patient_analytics_contact_completeness,
     q_patient_analytics_dashboards,
     q_patient_analytics_missing_data_analysis,
} from './patient-analytics-queries';

describe('patient analytics query response contracts', () => {
     beforeEach(() => query.mockReset());

     it('queries the combined attributes required by the frontend report', async () => {
          const rows = [{ gender: 'female', marital_status: 'married', occupation: 'teacher', patient_count: 7 }];
          query.mockResolvedValue(rows);

          await expect(new PatientAnalytics().getCombinedAttributes(246)).resolves.toBe(rows);
          expect(query).toHaveBeenCalledWith(246, q_patient_analytics_combined_attributes, []);
          expect(q_patient_analytics_combined_attributes).toMatch(/SELECT gender, marital_status, occupation, COUNT\(\*\) AS patient_count/i);
          expect(q_patient_analytics_combined_attributes).toMatch(/GROUP BY gender, marital_status, occupation/i);
     });

     it('keeps dashboard and missing-data aggregate aliases aligned with their consumers', () => {
          for (const field of ['total_patients', 'active_patients', 'male_patients', 'female_patients']) {
               expect(q_patient_analytics_dashboards).toContain(`AS ${field}`);
          }
          for (const field of ['missing_emails', 'missing_mobile_numbers', 'missing_middlenames']) {
               expect(q_patient_analytics_missing_data_analysis).toContain(`AS ${field}`);
          }
     });

     it('returns a numeric zero for contact-completeness sums on an empty patient table', () => {
          expect(q_patient_analytics_contact_completeness).toMatch(/COUNT\(\*\)\s+as total/i);
          expect(q_patient_analytics_contact_completeness).toMatch(/COALESCE\(SUM\(/i);
          expect(q_patient_analytics_contact_completeness).toContain('as complete_contact');
     });

     it('coalesces dashboard sums for a tenant with no patient rows', () => {
          expect(q_patient_analytics_dashboards.match(/COALESCE\(SUM\(/g)).toHaveLength(3);
     });
});
