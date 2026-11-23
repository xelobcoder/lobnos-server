import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
     const names = [
          'getAgeDistributionHandler',
          'getGenderDistributionHandler',
          'getMaritalStatusHandler',
          'getPatientRegistrationOverTimeHandler',
          'getActivationStatusHandler',
          'getUniqueIdentifiersHandler',
          'getOccupationDistributionHandler',
          'getCombinedAttributesHandler',
          'getMissingDataAnalysisHandler',
          'getDuplicateRecordsHandler',
          'getDashboardsHandler',
          'getMonthlyPatientRegistrationTrendHandler',
          'getDayTotalRegisteredClientHandler',
          'getRegistrationByDayOfWeekHandler',
          'getContactCompletenessHandler',
          'getStaffRegistrationPerformanceHandler',
          'getStaffRegistrationTrendsHandler',
     ];
     return {
          requireAnalyticsAdmin: vi.fn(),
          handlers: Object.fromEntries(names.map(name => [name, vi.fn()])),
     };
});

vi.mock('../../../middleware/validateTenancy', () => ({
     isAuthorizedRoleAdmin: mocks.requireAnalyticsAdmin,
}));
vi.mock('./patient-analytics-handlers', () => mocks.handlers);

import patientAnalyticsRouter from './patient-analytics-route';

describe('patient analytics frontend route contract', () => {
     const paths = [
          '/api/v1/patient-analytics/dashboards',
          '/api/v1/patient-analytics/age-distribution',
          '/api/v1/patient-analytics/gender-distribution',
          '/api/v1/patient-analytics/marital-status',
          '/api/v1/patient-analytics/patient-registration-over-time',
          '/api/v1/patient-analytics/occupation-distribution',
          '/api/v1/patient-analytics/combined-attributes',
          '/api/v1/patient-analytics/missing-data-analysis',
          '/api/v1/patient-analytics/contact-completeness',
          '/api/v1/patient-analytics/registration-by-day-of-week',
     ];

     it('registers every endpoint used by the shared patient analytics UI', () => {
          const registered = (patientAnalyticsRouter as any).stack
               .filter((layer: any) => layer.route)
               .map((layer: any) => layer.route.path);
          for (const path of paths) expect(registered).toContain(path);
     });

     it('keeps the admin access gate in front of patient analytics routes', () => {
          const layers = (patientAnalyticsRouter as any).stack;
          expect(layers.some((layer: any) => layer.handle === mocks.requireAnalyticsAdmin && !layer.route)).toBe(true);
          expect(layers.find((layer: any) => layer.route?.path === paths[0]).route.stack[0].handle)
               .toBe(mocks.handlers.getDashboardsHandler);
     });
});
