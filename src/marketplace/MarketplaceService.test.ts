import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

const state = vi.hoisted(() => ({
     inserts: [] as Array<{ table: string; values: any }>,
     transactionCount: 0,
     booking: null as any,
     bookingItems: [] as any[],
}));

vi.mock('../database/connection', () => {
     const rows: Record<string, any[]> = {
          marketplace_facilities: [{
               id: 8, slug: 'sample-lab', status: 'approved', integration_state: 'independent',
               currency: 'GHS', payment_instructions: 'Pay at desk',
          }],
          marketplace_catalog_items: [{
               id: 7, facility_id: 8, item_type: 'test', name: 'CBC', description: 'Blood count',
               price: '0.29', sample_requirements: '["Blood"]',
               collection_methods: '["in_facility"]', available: true, active: true,
          }],
     };
     const db: any = (table: string) => {
          const records = () => table === 'marketplace_bookings' && state.booking
               ? [state.booking]
               : table === 'marketplace_booking_items' && state.bookingItems.length
                    ? state.bookingItems : rows[table] || [];
          const query: any = {
               where: () => query,
               whereIn: () => query,
               select: () => query,
               orderBy: () => query,
               limit: () => query,
               forUpdate: () => query,
               first: async () => records()[0],
               then: (resolve: any, reject: any) => Promise.resolve(records()).then(resolve, reject),
          };
          return query;
     };
     db.transaction = async (operation: (trx: any) => Promise<unknown>) => {
          state.transactionCount += 1;
          const trx = (table: string) => ({
               ...db(table),
               insert: async (values: any) => {
                    state.inserts.push({ table, values });
                    const normalized = Array.isArray(values) ? values : [values];
                    if (table === 'marketplace_bookings') state.booking = normalized[0];
                    if (table === 'marketplace_booking_items') state.bookingItems = normalized;
                    return [state.inserts.length];
               },
          });
          return operation(trx);
     };
     return { systemConfigConnection: db };
});

import { MarketplaceService } from './MarketplaceService';

describe('MarketplaceService booking boundary', () => {
     beforeEach(() => {
          state.inserts.length = 0;
          state.transactionCount = 0;
          state.booking = null;
          state.bookingItems = [];
     });

     it('prices from approved catalog, snapshots rows transactionally, and stores only a tracking-token hash', async () => {
          const service = new MarketplaceService();
          const idempotencyKey = randomBytes(32).toString('base64url');
          const result = await service.createBooking({
               facilitySlug: 'sample-lab',
               itemIds: [7],
               idempotencyKey,
               patient: { name: 'Private Patient', phone: '+1000000' },
               collectionMethod: 'in_facility',
               price: 0,
          });

          expect(result.totalAmount).toBe(0.29);
          expect(result.status).toBe('requested');
          expect(result.paymentInstructions).toBe('Pay at desk');
          expect(result.trackingToken).toBe(idempotencyKey);
          expect(state.transactionCount).toBe(1);
          const booking = state.inserts.find(item => item.table === 'marketplace_bookings')!.values;
          expect(booking.patient_name).toBe('Private Patient');
          expect(booking.total_amount).toBe('0.29');
          expect(booking.tracking_token_hash).toBe(createHash('sha256').update(result.trackingToken).digest('hex'));
          expect(booking.tracking_token_hash).not.toBe(result.trackingToken);
          expect(state.inserts.find(item => item.table === 'marketplace_booking_items')!.values[0]).toMatchObject({
               name_snapshot: 'CBC', unit_price_snapshot: 0.29, catalog_item_id: 7,
          });

          const retried = await service.createBooking({
               facilitySlug: 'sample-lab', itemIds: [7], idempotencyKey,
               patient: { name: 'Private Patient', phone: '+1000000' },
               collectionMethod: 'in_facility',
          });
          expect(retried.bookingId).toBe(result.bookingId);
          expect(retried.totalAmount).toBe(0.29);
          expect(state.transactionCount).toBe(1);
          expect(state.inserts.filter(item => item.table === 'marketplace_bookings')).toHaveLength(1);
     });

     it('rejects unsupported collection method before writing a booking', async () => {
          const service = new MarketplaceService();
          await expect(service.createBooking({
               facilitySlug: 'sample-lab',
               itemIds: [7],
               idempotencyKey: randomBytes(32).toString('base64url'),
               patient: { name: 'Private Patient', phone: '+1000000' },
               collectionMethod: 'home',
               collectionAddress: 'Sample address',
          })).rejects.toMatchObject({ statusCode: 409 });
          expect(state.transactionCount).toBe(0);
          expect(state.inserts).toHaveLength(0);
     });

     it('rejects duplicate requested item IDs before reading a booking total', async () => {
          const service = new MarketplaceService();
          await expect(service.createBooking({
               facilitySlug: 'sample-lab',
               itemIds: [7, 7],
               idempotencyKey: randomBytes(32).toString('base64url'),
               patient: { name: 'Private Patient', phone: '+1000000' },
               collectionMethod: 'in_facility',
          })).rejects.toMatchObject({ statusCode: 400 });
          expect(state.transactionCount).toBe(0);
     });

     it('requires the bearer tracking token and never returns patient identity from private status lookup', async () => {
          const service = new MarketplaceService();
          const idempotencyKey = randomBytes(32).toString('base64url');
          await service.createBooking({
               facilitySlug: 'sample-lab', itemIds: [7], idempotencyKey,
               patient: { name: 'Private Patient', phone: '+1000000', email: 'private@example.invalid' },
               collectionMethod: 'in_facility',
          });

          await expect(service.trackBooking({})).rejects.toMatchObject({ statusCode: 401 });
          const response = await service.trackBooking({ trackingToken: idempotencyKey });
          expect(response).not.toHaveProperty('patientName');
          expect(response).not.toHaveProperty('patientPhone');
          expect(JSON.stringify(response)).not.toContain('Private Patient');
          expect(JSON.stringify(response)).not.toContain('private@example.invalid');
          expect(response).toMatchObject({ status: 'requested', paymentStatus: 'unpaid', totalAmount: 0.29 });
     });
});
