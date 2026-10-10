import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ writes: [] as Array<{ table: string; value: any }> }));
vi.mock('../database/connection', () => {
     const db: any = (table: string) => ({
          insert: async (value: any) => {
               state.writes.push({ table, value });
               return [17];
          },
     });
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
     beforeEach(() => { state.writes.length = 0; });

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
