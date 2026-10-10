import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     writes: [] as Array<{ table: string; value: any }>,
     rows: [] as Array<Record<string, any>>,
     query: [] as Array<{ method: string; args: unknown[] }>,
}));
vi.mock('../database/connection', () => {
     const db: any = (table: string) => {
          const query: any = {
               insert: async (value: any) => {
                    state.writes.push({ table, value });
                    return [17];
               },
          };
          for (const method of ['select', 'where', 'orderBy', 'offset']) {
               query[method] = (...args: unknown[]) => {
                    state.query.push({ method, args });
                    return query;
               };
          }
          query.limit = async (limit: number) => {
               state.query.push({ method: 'limit', args: [limit] });
               return state.rows;
          };
          return query;
     };
     return { systemConfigConnection: db };
});
vi.mock('../models/public/PublicFacilityRegistry', () => ({
     PublicFacilityRegistry: class {},
}));

import { MarketplaceService } from './MarketplaceService';

const enquiry = {
     formType: 'demo',
     fullName: 'Taylor Example',
     workEmail: 'Taylor@Example.org',
     phone: '+233000000000',
     organization: 'Example Laboratory',
     country: 'Ghana',
     facilityType: 'Independent laboratory',
     facilitiesCount: '1',
     interests: ['Laboratory management'],
     subject: '',
     message: 'We would like a demonstration of the laboratory workflow.',
     submittedAt: new Date().toISOString(),
     source: 'pls-corporate-website',
};

describe('platform website enquiries', () => {
     beforeEach(() => { state.writes.length = 0; state.rows.length = 0; state.query.length = 0; });

     it('lists previously stored enquiries with complete details and pagination', async () => {
          state.rows = Array.from({ length: 51 }, (_, index) => ({
               id: index + 1, form_type: 'demo', full_name: 'Taylor Example', work_email: 'taylor@example.org',
               phone: '12345678', organization: 'Example Lab', country: 'Ghana', facility_type: 'Independent',
               facilities_count: '1', interests_json: '["Laboratory management"]', subject: '', message: enquiry.message,
               status: 'new', submitted_at: '2026-10-10T06:00:00.000Z', received_at: '2026-10-10T06:00:01.000Z',
          }));
          const result = await new MarketplaceService().listPlatformEnquiries('demo', '2');
          expect(result).toMatchObject({ page: 2, hasMore: true });
          expect(result.enquiries).toHaveLength(50);
          expect(result.enquiries[0]).toMatchObject({
               id: 1, formType: 'demo', fullName: 'Taylor Example', workEmail: 'taylor@example.org',
               organization: 'Example Lab', interests: ['Laboratory management'], message: enquiry.message,
               receivedAt: '2026-10-10T06:00:01.000Z',
          });
          expect(state.query).toContainEqual({ method: 'where', args: [{ form_type: 'demo' }] });
          expect(state.query).toContainEqual({ method: 'offset', args: [50] });
          expect(state.query).toContainEqual({ method: 'limit', args: [51] });
          expect(state.query.filter(item => item.method === 'orderBy')).toEqual([
               { method: 'orderBy', args: ['received_at', 'desc'] },
               { method: 'orderBy', args: ['id', 'desc'] },
          ]);
          expect(state.writes).toHaveLength(0);
     });

     it('returns a genuine empty list and rejects invalid filters or pagination', async () => {
          await expect(new MarketplaceService().listPlatformEnquiries()).resolves.toEqual({
               enquiries: [], page: 1, hasMore: false,
          });
          expect(state.query.some(item => item.method === 'where')).toBe(false);
          for (const [formType, page] of [['invalid', '1'], ['demo', '0'], ['all', '-1'], ['contact', '1.5'], ['all', '100001']]) {
               await expect(new MarketplaceService().listPlatformEnquiries(formType, page)).rejects.toMatchObject({ statusCode: 400 });
          }
          await expect(new MarketplaceService().listPlatformEnquiries(['demo'], '1')).rejects.toMatchObject({ statusCode: 400 });
     });

     it('surfaces invalid stored interests rather than presenting success with missing data', async () => {
          state.rows = [{ interests_json: '{}' }];
          await expect(new MarketplaceService().listPlatformEnquiries()).rejects.toThrow('Invalid stored enquiry interests');
     });

     it('validates and stores an accepted enquiry durably', async () => {
          await expect(new MarketplaceService().submitPlatformEnquiry(enquiry))
               .resolves.toEqual({ enquiryId: 17, accepted: true });
          expect(state.writes).toHaveLength(1);
          expect(state.writes[0]).toMatchObject({
               table: 'platform_enquiries',
               value: {
                    form_type: 'demo',
                    work_email: 'taylor@example.org',
                    status: 'new',
                    source: 'pls-corporate-website',
               },
          });
          expect(JSON.parse(state.writes[0].value.interests_json)).toEqual(['Laboratory management']);
     });

     it('rejects malformed or untrusted enquiry payloads without writing', async () => {
          await expect(new MarketplaceService().submitPlatformEnquiry({ ...enquiry, workEmail: 'invalid' }))
               .rejects.toMatchObject({ statusCode: 400 });
          await expect(new MarketplaceService().submitPlatformEnquiry({ ...enquiry, source: 'unknown' }))
               .rejects.toMatchObject({ statusCode: 400 });
          expect(state.writes).toHaveLength(0);
     });
});
