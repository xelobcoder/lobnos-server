import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
     combined: vi.fn(),
     contact: vi.fn(),
     dashboards: vi.fn(),
     missing: vi.fn(),
}));

vi.mock('../../../models/analytics/patient-analytics/patients-analytics-class', () => ({
     PatientAnalytics: class {
          getCombinedAttributes(...args: unknown[]) { return service.combined(...args); }
          getContactCompleteness(...args: unknown[]) { return service.contact(...args); }
          getDashboards(...args: unknown[]) { return service.dashboards(...args); }
          getMissingDataAnalysis(...args: unknown[]) { return service.missing(...args); }
     },
}));

import {
     getCombinedAttributesHandler,
     getContactCompletenessHandler,
     getDashboardsHandler,
     getMissingDataAnalysisHandler,
} from './patient-analytics-handlers';

function response() {
     const res: any = { statusCode: 200, body: undefined };
     res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
     res.json = vi.fn((body: unknown) => { res.body = body; return res; });
     return res;
}

describe('patient analytics controller response contracts', () => {
     beforeEach(() => vi.clearAllMocks());

     it('returns combined attributes as the rows the shared report consumes', async () => {
          const rows = [{ gender: 'female', marital_status: 'married', occupation: 'teacher', patient_count: 7 }];
          service.combined.mockResolvedValue(rows);
          const res = response();

          await getCombinedAttributesHandler({ query: { tenantId: '23' } } as any, res);

          expect(service.combined).toHaveBeenCalledWith(23);
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe(rows);
     });

     it('returns dashboard and contact aggregate arrays without wrapping their fields', async () => {
          const dashboardRows = [{ total_patients: 2, active_patients: 1, male_patients: 1, female_patients: 1 }];
          const contactRows = [{ total: 2, complete_contact: 1 }];
          service.dashboards.mockResolvedValue(dashboardRows);
          service.contact.mockResolvedValue(contactRows);
          const dashboardResponse = response();
          const contactResponse = response();

          await getDashboardsHandler({ query: { tenantId: '23' } } as any, dashboardResponse);
          await getContactCompletenessHandler({ query: { tenantId: '23' } } as any, contactResponse);

          expect(dashboardResponse.body).toBe(dashboardRows);
          expect(contactResponse.body).toBe(contactRows);
     });

     it('returns the missing-data aggregate row as the documented object shape', async () => {
          const rows = [{ missing_emails: 3, missing_mobile_numbers: 1, missing_middlenames: 0 }];
          service.missing.mockResolvedValue(rows);
          const res = response();

          await getMissingDataAnalysisHandler({ query: { tenantId: '23' } } as any, res);

          expect(res.statusCode).toBe(200);
          expect(res.body).toBe(rows[0]);
     });

     it('reports invalid aggregate query results as failures rather than empty analytics', async () => {
          service.dashboards.mockResolvedValue([]);
          service.missing.mockResolvedValue([]);
          const dashboardResponse = response();
          const missingResponse = response();

          await getDashboardsHandler({ query: { tenantId: '23' } } as any, dashboardResponse);
          await getMissingDataAnalysisHandler({ query: { tenantId: '23' } } as any, missingResponse);

          expect(dashboardResponse.statusCode).toBe(500);
          expect(dashboardResponse.body).toEqual({ error: 'Invalid patient dashboards response' });
          expect(missingResponse.statusCode).toBe(500);
          expect(missingResponse.body).toEqual({ error: 'Invalid missing data analysis response' });
     });
});
