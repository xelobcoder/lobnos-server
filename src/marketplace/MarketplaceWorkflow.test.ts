import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

const state = vi.hoisted(() => ({
     tables: {} as Record<string, any[]>,
     coreTables: {} as Record<string, any[]>,
     nextId: 1,
     transactionCount: 0,
     publicFacilities: [] as any[],
}));

vi.mock('../database/KnexConnections', () => {
     const coreDb: any = (table: string) => {
          const filters: Array<(row: any) => boolean> = [];
          const query: any = {
               where(condition: Record<string, unknown>) {
                    filters.push(row => Object.entries(condition).every(([key, value]) => row[key] === value));
                    return query;
               },
               select() { return query; },
               first: async (...columns: string[]) => {
                    const row = (state.coreTables[table] || []).find(candidate => filters.every(filter => filter(candidate)));
                    return row && columns.length ? Object.fromEntries(columns.map(column => [column, row[column]])) : row;
               },
               then: (resolve: any, reject: any) => Promise.resolve((state.coreTables[table] || [])
                    .filter(row => filters.every(filter => filter(row)))).then(resolve, reject),
          };
          return query;
     };
     return { default: async () => coreDb };
});

vi.mock('../database/connection', () => {
     const matches = (row: any, filters: Array<(row: any) => boolean>) => filters.every(filter => filter(row));
     const db: any = (tableName: string) => {
          const table = tableName.split(/\s+as\s+/i)[0];
          const filters: Array<(row: any) => boolean> = [];
          const alias = tableName.split(/\s+as\s+/i)[1] || table;
          let counting = false;
          let joins: Array<{ tableName: string; left: string; right: string }> = [];
          const normalize = (column: string) => column.split('.').pop()!;
          const records = () => {
               let result = (state.tables[table] || []).map(row => ({
                    ...row, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [`${alias}.${key}`, value])),
               }));
               for (const join of joins) {
                    const joinTable = join.tableName.split(/\s+as\s+/i)[0];
                    const joinAlias = join.tableName.split(/\s+as\s+/i)[1] || joinTable;
                    const related = state.tables[joinTable] || [];
                    result = result.map(row => {
                         const match = related.find(candidate =>
                              candidate[normalize(join.left)] === row[join.right] ||
                              candidate[normalize(join.left)] === row[normalize(join.right)]);
                         return match ? {
                              ...row, ...match,
                              ...Object.fromEntries(Object.entries(match).map(([key, value]) => [`${joinAlias}.${key}`, value])),
                         } : row;
                    });
               }
               return result;
          };
          const query: any = {
               where(condition: any, value?: any) {
                    if (typeof condition === 'string') {
                         const column = normalize(condition);
                         filters.push(row => condition.includes('expires_at') && arguments.length > 2
                              ? new Date(row[condition] ?? row[column]).getTime() > new Date(arguments[2]).getTime()
                              : (row[condition] ?? row[column]) === value);
                    } else filters.push(row => Object.entries(condition).every(([key, expected]) => (row[key] ?? row[normalize(key)]) === expected));
                    return query;
               },
               whereIn(column: string, values: any[]) {
                    filters.push(row => values.includes(row[normalize(column)]));
                    return query;
               },
               whereNull(column: string) { filters.push(row => row[normalize(column)] == null); return query; },
               whereBetween(column: string, values: number[]) {
                    filters.push(row => row[normalize(column)] != null && row[normalize(column)] >= values[0] && row[normalize(column)] <= values[1]);
                    return query;
               },
               count() { counting = true; return query; },
               andWhere(callback: any) {
                    const clauses: Array<(row: any) => boolean> = [];
                    const builder: any = {
                         where(column: string, value: any) { clauses.push(row => row[column] === value); return builder; },
                         orWhere(column: string, value: any) { clauses.push(row => row[column] === value); return builder; },
                         whereNull(column: string) { clauses.push(row => row[column] == null); return builder; },
                         orWhereExists() { return builder; },
                    };
                    callback.call(builder, builder);
                    filters.push(row => clauses.some(clause => clause(row)));
                    return query;
               },
               join(joinTable: string, left: string, right: string) { joins.push({ tableName: joinTable, left, right }); return query; },
               select() { return query; },
               orderBy() { return query; },
               limit() { return query; },
               forUpdate() { return query; },
               first: async (...columns: string[]) => {
                    if (counting) return { total: records().filter(record => matches(record, filters)).length };
                    const row = records().find(record => matches(record, filters));
                    if (!row || !columns.length) return row;
                    return Object.fromEntries(columns.map(selection => {
                         const [column, alias] = selection.split(/\s+as\s+/i);
                         const key = alias || normalize(column);
                         return [key, row[column] ?? row[normalize(column)]];
                    }));
               },
               insert: async (input: any) => {
                    const newRecords = Array.isArray(input) ? input : [input];
                    const created = newRecords.map(record => {
                         const id = record.id ?? state.nextId++;
                         if (table === 'marketplace_payment_claims' &&
                              state.tables[table].some(row => row.reference_hash === record.reference_hash)) {
                              throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
                         }
                         const row = { id, ...record };
                         state.tables[table].push(row);
                         return id;
                    });
                    return created;
               },
               update: async (values: any) => {
                    const selected = (state.tables[table] || []).filter(row => matches(row, filters));
                    for (const row of selected) Object.assign(row, values);
                    return selected.length;
               },
               then: (resolve: any, reject: any) =>
                    Promise.resolve(records().filter(row => matches(row, filters))).then(resolve, reject),
          };
          return query;
     };
     db.raw = () => '';
     db.transaction = async (operation: (trx: any) => Promise<unknown>) => {
          state.transactionCount += 1;
          return operation(db);
     };
     return { systemConfigConnection: db };
});

vi.mock('../models/Tenancy/TenantRegistry', () => ({
     TENANTS_TABLE: 'prime_tenants',
     TenantRegistry: class { async requireTenant() { return { isActive: true }; } },
}));
vi.mock('../models/public/PublicFacilityCatalog', () => ({
     PublicCatalogError: class extends Error {},
     PublicFacilityCatalog: class {
          async list() { return { facilities: state.publicFacilities }; }
          async catalog() {
               return {
                    currency: 'GHS',
                    facility: { slug: 'sample-lab' },
                    tests: [{ id: 11, name: 'CBC', description: 'Blood count', price: 12.34 }],
                    panels: [{ id: 12, name: 'Synthetic panel', description: 'Public panel', price: 25 }],
                    services: [],
               };
          }
     },
     parsePublicFacilities: () => [{
          slug: 'sample-lab', tenantId: 9, published: true, catalogPublished: true,
     }],
}));

import { MarketplaceError, MarketplaceService } from './MarketplaceService';

const facility = () => ({
     id: 1, slug: 'sample-lab', name: 'Sample Lab', status: 'pending',
     integration_state: 'independent', currency: 'GHS', payment_instructions: 'Pay in person',
     opening_hours: '{}',
});
const booking = (overrides: Record<string, unknown> = {}) => ({
     id: '11111111-1111-4111-8111-111111111111',
     facility_id: 1,
     tracking_token_hash: createHash('sha256').update('A'.repeat(43)).digest('hex'),
     patient_name: 'Test Patient',
     patient_phone: '+123456789',
     patient_email: null,
     collection_address: null,
     collection_method: 'in_facility',
     status: 'requested',
     total_amount: '12.34',
     currency: 'GHS',
     branch_id: null,
     ...overrides,
});
const staff = () => ({ id: 3, email: 'admin@example.invalid', role: 'admin', facilityId: 1, sessionId: 5 });

describe('Marketplace independent approval, sessions, and booking workflow', () => {
     beforeEach(() => {
          state.coreTables = {};
          state.tables = {
               marketplace_facilities: [facility()],
               marketplace_staff: [],
               marketplace_sessions: [],
               marketplace_catalog_items: [],
               marketplace_catalog_price_history: [],
               marketplace_catalog_mappings: [],
               marketplace_bookings: [],
               marketplace_booking_items: [],
               marketplace_payment_claims: [],
               marketplace_refunds: [],
               marketplace_audit: [],
               marketplace_core_booking_links: [],
          };
          state.nextId = 10;
          state.transactionCount = 0;
          state.publicFacilities = [];
     });

     it('does not publish a pending registration; approval is the publication gate', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities = [];
          await service.register({
               name: 'New Laboratory', slug: 'new-lab', region: 'North', locality: 'Town',
               address: 'Street', phone: '12345678', contactEmail: 'public@example.invalid',
               description: 'Description', currency: 'GHS',
               adminEmail: 'admin@example.invalid', adminPassword: 'a-strong-passphrase7',
          });

          expect((await service.listFacilities()).facilities).toHaveLength(0);
          expect(state.tables.marketplace_facilities[0].status).toBe('pending');
          expect(state.tables.marketplace_staff[0].password_hash).not.toBe('a-strong-passphrase7');
          await service.approveFacility(10, { employeeId: 99 });
          expect(state.tables.marketplace_facilities[0].status).toBe('approved');
          expect((await service.listFacilities()).facilities).toHaveLength(1);
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toContain('facility_approved');
     });

     it('counts current active PLS registrations without exposing their identities', async () => {
          state.tables.prime_tenants = [
               { tenant_number: 1, status: 'active', deleted_at: null },
               { tenant_number: 2, status: 'suspended', deleted_at: null },
               { tenant_number: 3, status: 'active', deleted_at: '2025-01-01' },
               { tenant_number: null, status: 'active', deleted_at: null },
               { tenant_number: 0, status: 'active', deleted_at: null },
               { tenant_number: 1000000, status: 'active', deleted_at: null },
          ];
          const service = new MarketplaceService();
          expect(await service.publicStatistics()).toEqual({ activeFacilities: 1 });
          state.tables.prime_tenants.push({ tenant_number: 4, status: 'active', deleted_at: null });
          expect(await service.publicStatistics()).toEqual({ activeFacilities: 2 });
     });

     it('stores staff tokens hashed, enforces expiry, logout, and facility approval scope', async () => {
          const service = new MarketplaceService();
          await service.register({
               name: 'New Laboratory', slug: 'new-lab', region: 'North', locality: 'Town',
               address: 'Street', phone: '12345678', contactEmail: 'public@example.invalid',
               description: 'Description', currency: 'GHS',
               adminEmail: 'admin@example.invalid', adminPassword: 'a-strong-passphrase7',
          });
          await service.approveFacility(10, { employeeId: 99 });
          const login = await service.login({ facilitySlug: 'new-lab', email: 'admin@example.invalid', password: 'a-strong-passphrase7' });
          const session = state.tables.marketplace_sessions[0];
          expect(session.token_hash).toBe(createHash('sha256').update(login.accessToken).digest('hex'));
          expect(session.token_hash).not.toBe(login.accessToken);
          expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now() + 11 * 60 * 60 * 1000);
          expect((await service.authenticateStaff(login.accessToken)).facility.slug).toBe('new-lab');
          session.expires_at = new Date(Date.now() - 1000);
          await expect(service.authenticateStaff(login.accessToken)).rejects.toMatchObject({ statusCode: 401 });
          await expect(service.login({ facilitySlug: 'sample-lab', email: 'admin@example.invalid', password: 'bad-password' }))
               .rejects.toMatchObject({ statusCode: 401 });
          const freshSession = await service.login({
               facilitySlug: 'new-lab', email: 'admin@example.invalid', password: 'a-strong-passphrase7',
          });
          const storedFreshSession = state.tables.marketplace_sessions.find(row =>
               row.token_hash === createHash('sha256').update(freshSession.accessToken).digest('hex'));
          await service.revokeStaffSession({ sessionId: storedFreshSession.id });
          await expect(service.authenticateStaff(freshSession.accessToken)).rejects.toMatchObject({ statusCode: 401 });
     });

     it('requires manual payment verification before schedule and audits the payment and status decisions', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities[0].status = 'approved';
          state.tables.marketplace_bookings.push(booking());
          state.tables.marketplace_payment_claims.push({
               id: 4, booking_id: booking().id, claimed_amount: '12.34', status: 'pending',
          });
          state.tables.marketplace_payment_claims[0].claimed_amount = '12.33';
          await expect(service.decidePayment(staff(), booking().id, 4, {
               decision: 'verified', reason: 'Amount does not match',
          })).rejects.toMatchObject({ statusCode: 409 });
          state.tables.marketplace_payment_claims[0].claimed_amount = '12.34';
          await expect(service.decideBooking(staff(), booking().id, {
               action: 'schedule', reason: 'Appointment', scheduledAt: '2030-01-01T10:00:00Z',
          })).rejects.toMatchObject({ statusCode: 409 });
          await service.decidePayment(staff(), booking().id, 4, { decision: 'verified', reason: 'Matched bank statement' });
          await service.decideBooking(staff(), booking().id, { action: 'accept', reason: 'Accepted by lab' });
          const scheduled = await service.decideBooking(staff(), booking().id, {
               action: 'schedule', reason: 'Appointment', scheduledAt: '2030-01-01T10:00:00Z',
               scheduleInstructions: 'Bring ID',
          });
          expect(scheduled).toMatchObject({ status: 'scheduled', paymentStatus: 'verified' });
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toEqual(['payment_verified', 'booking_accept', 'booking_schedule']);
          expect(state.tables.marketplace_payment_claims[0]).toMatchObject({
               status: 'verified', decision_actor: staff().email, decision_reason: 'Matched bank statement',
          });
     });

     it('rejects a globally duplicated payment reference and never marks a claim verified on submission', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities[0].status = 'approved';
          state.tables.marketplace_bookings.push(booking(), booking({ id: '22222222-2222-4222-8222-222222222222' }));
          const token = 'A'.repeat(43);
          const claim = { trackingToken: token, reference: 'BANK-REF-1', amount: 12.34 };
          const submitted = await service.submitPatientPaymentClaim(claim);
          expect(submitted.status).toBe('pending_verification');
          expect(state.tables.marketplace_payment_claims[0].status).toBe('pending');
          await expect(service.submitPatientPaymentClaim({
               ...claim,
               trackingToken: randomBytes(32).toString('base64url'),
          })).rejects.toBeInstanceOf(MarketplaceError);
          expect(state.tables.marketplace_payment_claims).toHaveLength(1);
     });

     it('records cancellation/refund decisions and prevents duplicate refunds', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities[0].status = 'approved';
          state.tables.marketplace_bookings.push(booking({ status: 'accepted' }));
          state.tables.marketplace_payment_claims.push({
               id: 4, booking_id: booking().id, claimed_amount: '12.34', status: 'verified',
          });
          const cancelled = await service.decideBooking(staff(), booking().id, { action: 'cancel', reason: 'Patient request' });
          expect(cancelled).toMatchObject({ status: 'cancelled', paymentStatus: 'refund_pending' });
          const refunded = await service.recordRefund(staff(), booking().id, {
               externalReference: 'REFUND-1', amount: 12.34, reason: 'Refund issued externally',
          });
          expect(refunded.paymentStatus).toBe('refunded');
          await expect(service.recordRefund(staff(), booking().id, {
               externalReference: 'REFUND-2', amount: 12.34, reason: 'Duplicate attempt',
          })).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toEqual(['booking_cancel', 'payment_refunded']);
     });

     it('requires explicit complete catalog mapping before linking and preserves booking snapshots on success', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities[0].status = 'approved';
          state.tables.public_facility_profiles = [{ tenant_id: 9, profile_json: '{}' }];
          state.tables.marketplace_catalog_items.push({
               id: 20, facility_id: 1, item_type: 'test', active: true, name: 'CBC',
          });
          state.tables.marketplace_bookings.push(booking({ id: '33333333-3333-4333-8333-333333333333' }));
          state.tables.marketplace_booking_items.push({
               id: 21, booking_id: '33333333-3333-4333-8333-333333333333',
               catalog_item_id: 20, core_item_id: null, name_snapshot: 'CBC',
               unit_price_snapshot: '10.00', currency: 'GHS',
          });
          await expect(service.linkTenant(1, 9, true, [], { employeeId: 99 })).rejects.toMatchObject({ statusCode: 400 });
          expect(state.tables.marketplace_facilities[0].integration_state).toBe('independent');
          const linked = await service.linkTenant(1, 9, true, [{
               marketplaceItemId: 20, coreItemId: 11, coreItemType: 'test',
          }], { employeeId: 99 });
          expect(linked.integrationState).toBe('linked');
          expect(state.tables.marketplace_booking_items[0]).toMatchObject({
               name_snapshot: 'CBC', unit_price_snapshot: '10.00', core_item_id: 11,
          });
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toContain('facility_linked_to_pls');
     });

     it('returns the original priced snapshot after catalog price changes and rejects key reuse with different patient data', async () => {
          const service = new MarketplaceService();
          state.tables.marketplace_facilities[0].status = 'approved';
          state.tables.marketplace_catalog_items.push({
               id: 7, facility_id: 1, item_type: 'test', name: 'CBC', description: 'Blood count',
               price: '10.00', sample_requirements: '["Blood"]',
               collection_methods: '["in_facility"]', available: true, active: true,
          });

          const request = {
               facilitySlug: 'sample-lab', itemIds: [7], idempotencyKey: 'A'.repeat(43),
               patient: { name: 'Test Patient', phone: '+123456789' }, collectionMethod: 'in_facility',
          };
          const first = await service.createBooking(request);
          state.tables.marketplace_catalog_items[0].price = '99.00';
          const retry = await service.createBooking(request);
          expect(retry).toMatchObject({ bookingId: first.bookingId, totalAmount: 10 });
          expect(Number(state.tables.marketplace_booking_items[0].unit_price_snapshot)).toBe(10);
          await expect(service.createBooking({
               ...request, patient: { name: 'Different Patient', phone: '+123456789' },
          })).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables.marketplace_bookings).toHaveLength(1);
     });

     it('publishes and books live panels using unique tariff IDs and server-owned prices', async () => {
          state.publicFacilities = [{ slug: 'sample-lab', name: 'Sample Lab', facilityLoginUrl: 'https://lab.example/login' }];
          state.tables.marketplace_facilities[0] = {
               ...facility(), status: 'approved', integration_state: 'linked', linked_tenant_id: 9,
          };
          const service = new MarketplaceService();
          const catalog = await service.publicCatalog('sample-lab');
          expect(catalog.tests.map(item => [item.id, item.type])).toEqual([[11, 'test'], [12, 'panel']]);
          const result = await service.createBooking({
               facilitySlug: 'sample-lab', itemIds: [11, 12], idempotencyKey: 'P'.repeat(43),
               patient: { name: 'Synthetic Patient', phone: '+123456789' }, collectionMethod: 'in_facility',
          });
          expect(result.totalAmount).toBe(37.34);
          expect(state.tables.marketplace_booking_items.map(item => [item.core_item_id, item.item_type]))
               .toEqual([[11, 'test'], [12, 'panel']]);
          const directory = await service.listFacilities();
          expect(directory.facilities[0].facilityLoginUrl).toBe('https://lab.example/login');
     });

     it('includes an explicitly published core tenant without inventing marketplace booking support', async () => {
          state.tables.marketplace_facilities = [];
          state.publicFacilities = [{
               slug: 'sample-lab', name: 'Sample Laboratory', region: 'North', locality: 'Town',
               description: '', currency: 'GHS', facilityLoginUrl: 'https://lab.example/login',
          }];
          const service = new MarketplaceService();
          const directory = await service.listFacilities();
          expect(directory.facilities).toEqual([expect.objectContaining({
               slug: 'sample-lab', facilityType: 'pls-integrated', bookingSupported: false, currency: 'GHS',
          })]);
          expect(directory.facilities[0]).not.toHaveProperty('tenantId');
          const catalog = await service.publicCatalog('sample-lab');
          expect(catalog.facility).toMatchObject({ bookingSupported: false });
          expect(catalog.tests.map(item => [item.id, item.type])).toEqual([[11, 'test'], [12, 'panel']]);
          expect((await service.listFacilities('Synthetic panel')).facilities).toHaveLength(1);
          expect((await service.listFacilities('no matching investigation')).facilities).toHaveLength(0);
          expect(state.tables.marketplace_bookings).toHaveLength(0);
     });

     it('validates tenant, patient, billing, branch, and mapped tests before idempotent existing-record linkage', async () => {
          const service = new MarketplaceService();
          const bookingId = booking().id;
          Object.assign(state.tables.marketplace_facilities[0], {
               status: 'approved', integration_state: 'linked', linked_tenant_id: 9,
          });
          state.tables.marketplace_bookings.push(booking({ id: bookingId, status: 'scheduled', branch_id: 4 }));
          state.tables.marketplace_payment_claims.push({ id: 1, booking_id: bookingId, status: 'verified' });
          state.tables.marketplace_booking_items.push({ id: 2, booking_id: bookingId, core_item_id: 11, item_type: 'test' });
          state.coreTables = {
               new_patients: [{ patientid: 21 }],
               billing: [{ billingid: 31, patientid: 21, branchid: 4, status: 'active' }],
               branch: [{ branchid: 4 }],
               test_ascension: [{ billingid: 31, testid: 11 }],
               physical_samples: [{ id: 41, patientid: 21, billingid: 31 }],
          };
          const actor = { tenantId: 9, employeeId: 5, branchId: 4 };
          const body = { patientId: 21, billingId: 31, sampleId: 41 };

          await expect(service.linkExistingCoreRecords({ ...actor, tenantId: 10 }, bookingId, body))
               .rejects.toMatchObject({ statusCode: 404 });
          await expect(service.linkExistingCoreRecords(actor, bookingId, { ...body, patientId: 22 }))
               .rejects.toMatchObject({ statusCode: 404 });
          await expect(service.linkExistingCoreRecords(actor, bookingId, { ...body, billingId: 32 }))
               .rejects.toMatchObject({ statusCode: 409 });
          await expect(service.linkExistingCoreRecords(actor, bookingId, { ...body, sampleId: 42 }))
               .rejects.toMatchObject({ statusCode: 409 });

          const linked = await service.linkExistingCoreRecords(actor, bookingId, body);
          const retry = await service.linkExistingCoreRecords(actor, bookingId, body);
          expect(linked).toMatchObject({ bookingId, patientId: 21, billingId: 31, branchId: 4, sampleId: 41, alreadyLinked: false });
          expect(retry).toMatchObject({ bookingId, patientId: 21, billingId: 31, branchId: 4, sampleId: 41, alreadyLinked: true });
          expect(state.tables.marketplace_core_booking_links).toHaveLength(1);
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toContain('existing_core_records_linked');
     });
});
