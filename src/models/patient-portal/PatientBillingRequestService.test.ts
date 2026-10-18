import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     db: null as any, checkout: vi.fn(), generate: vi.fn(), services: vi.fn(),
     catalog: vi.fn(), settings: vi.fn(), outbox: vi.fn(), notify: vi.fn(),
}));
vi.mock('../../database/KnexConnections', () => ({ default: () => mocks.db }));
vi.mock('./PatientBillingRequestBootstrapper', () => ({ bootstrapPatientBillingRequests: async () => mocks.db }));
vi.mock('./PatientPortalSettings', () => ({ PatientPortalSettingsService: class { get = mocks.settings; } }));
vi.mock('../clincians/billingstrategy', () => ({ default: class { getProvidentialBillingHandler = mocks.catalog; } }));
vi.mock('../billing/multi/customerBillingCheckout', () => ({ CustomerBillingCheckout: { checkoutCustomerBilling: mocks.checkout } }));
vi.mock('../billing/billing_shared', () => ({
     BillingSharedRepo: class {
          static generateBillingID = mocks.generate;
          mapAndInsertServices = mocks.services;
     },
}));
vi.mock('../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingReceivable: mocks.outbox }));
vi.mock('../../LobnosAuth/user', () => ({ default: class { getUserRole = async () => 'admin'; } }));
vi.mock('../application/notifications/services/NotificationDispatcher', () => ({ NotificationDispatcher: { dispatch: mocks.notify } }));
vi.mock('../commissions/commission-configurations', () => ({
     CommissionLogger: { error: vi.fn() }, CommissionServiceFactory: {},
     logger: { error: vi.fn() },
}));

import { PatientBillingRequestService, requestTestIds } from './PatientBillingRequestService';

/** Transaction double: row locks wait, commits publish staged writes, rollback discards them.
 * The real SubmitCustomerBilling.submit(), processTestCart and conversion hooks execute here.
 * This does not replace an InnoDB integration test.
 */
function database() {
     let state: any = { requests: [], bills: [], audit: [], entries: [] };
     let queue = Promise.resolve();
     const events: string[] = [];
     const controls = { failAudit: false, failBill: false };
     const clone = (value: any) => JSON.parse(JSON.stringify(value));
     function transaction() {
          let staged: any;
          let release: (() => void) | undefined;
          const acquire = async () => {
               if (staged) return;
               const previous = queue;
               queue = new Promise<void>(resolve => { release = resolve; });
               await previous;
               staged = clone(state);
               events.push('lock');
          };
          const trx: any = (table: string) => query(table, () => staged || state, acquire);
          trx.snapshot = () => staged;
          trx.commit = async () => { if (staged) state = staged; events.push('commit'); release?.(); };
          trx.rollback = async () => { events.push('rollback'); release?.(); };
          return trx;
     }
     function query(table: string, snapshot: () => any, acquire?: () => Promise<void>) {
          let criteria: any = {};
          let lock = false;
          let changes: any;
          const rows = () => table === 'patient_billing_requests' ? snapshot().requests :
               table === 'billing' ? snapshot().bills : [];
          const matches = (row: any) => Object.entries(criteria).every(([key, value]) => row[key] === value);
          const builder: any = {
               where(value: any) { criteria = value; return builder; },
               select() { return builder; },
               forUpdate() { lock = true; return builder; },
               async first() {
                    if (lock) await acquire?.();
                    if (table === 'patient_portal_accounts') return { patientid: criteria.patientid };
                    return rows().find(matches);
               },
               update(value: any) { changes = value; return builder; },
               async insert(value: any) {
                    if (table === 'patient_portal_audit') {
                         if (controls.failAudit) throw new Error('audit insert failed');
                         snapshot().audit.push(value);
                         return [1];
                    }
                    const id = snapshot().requests.length + 1;
                    snapshot().requests.push({ id, ...value, billingid: null, review_note: '', created_at: '2026-10-18' });
                    return [id];
               },
               then(resolve: any, reject: any) {
                    return Promise.resolve().then(() => {
                         if (table === 'billing' && controls.failBill) throw new Error('bill update failed');
                         const selected = rows().filter(matches);
                         selected.forEach((row: any) => Object.assign(row, changes));
                         return selected.length;
                    }).then(resolve, reject);
               },
          };
          return builder;
     }
     const db: any = (table: string) => query(table, () => state);
     db.transaction = async (callback?: any) => {
          const trx = transaction();
          if (!callback) return trx;
          try { const value = await callback(trx); await trx.commit(); return value; }
          catch (error) { await trx.rollback(); throw error; }
     };
     return { db, controls, events, state: () => state };
}

describe('Patient billing request lifecycle through existing bill submission', () => {
     let fixture: ReturnType<typeof database>;
     let service: PatientBillingRequestService;
     const body = { testIds: [2, 1], submissionKey: 'submission-test-key-0001', note: 'Morning visit' };
     const conversion = { cart: [{ testid: 1 }, { testid: 2 }], amountPayable: 105.25, paid: 0 };

     beforeEach(() => {
          vi.clearAllMocks();
          fixture = database();
          mocks.db = fixture.db;
          service = new PatientBillingRequestService(3);
          mocks.settings.mockResolvedValue({ portal_enabled: true, billing_enabled: true });
          mocks.catalog.mockResolvedValue([
               { testid: 1, name: 'Test A', price: '40.00' }, { testid: 2, name: 'Test B', price: '65.25' },
          ]);
          mocks.checkout.mockImplementation(async (payload: any) => ({
               success: true, data: {
                    cart: payload.cart.map((item: any) => ({
                         testid: item.testid, actualPrice: item.testid === 1 ? 40 : 65.25,
                         totalcost: item.testid === 1 ? 40 : 65.25,
                         totalpayable: item.testid === 1 ? 40 : 65.25, discount: 0, amountIncurredDueTax: 0,
                    })),
                    subtotal: 105.25, totaldiscount: 0, totalAmountIncurredDueTax: 0,
                    totalServiceAmount: 0, totalcost: 105.25, totalServiceAmountPayable: 0,
                    testPayableAmount: 105.25, amountPayable: 105.25,
               },
          }));
          mocks.generate.mockImplementation(async (_patient: number, _tenant: number, _branch: number, _actor: number, trx: any) => {
               fixture.events.push('bill.insert');
               const id = 9000 + trx.snapshot().bills.length;
               trx.snapshot().bills.push({ billingid: id, payable: 0, amountIncurredDueTax: 0 });
               return id;
          });
          mocks.services.mockImplementation(async (_tenant: number, entries: any[], _bill: number, _patient: number,
               _delivery: any, _date: any, trx: any) => { trx.snapshot().entries.push(...entries); return []; });
          mocks.notify.mockResolvedValue(undefined);
          mocks.outbox.mockResolvedValue(undefined);
     });

     it.each([[], [1, 1], [0], ['1'], [1.5], Array.from({ length: 51 }, (_, i) => i + 1)].map(ids => ({ ids })))('rejects invalid selections $ids', ({ ids }) => {
          expect(() => requestTestIds(ids)).toThrow();
     });

     it('loads the General catalog without an associated entity', async () => {
          expect(await service.catalog()).toEqual([
               { testid: 1, name: 'Test A', estimatedPrice: '40.00' },
               { testid: 2, name: 'Test B', estimatedPrice: '65.25' },
          ]);
          expect(mocks.catalog).toHaveBeenCalledWith(expect.any(Number), 'general', 0, true);
     });

     it('submission only writes a request and audit, deduplicates simultaneous retries, and ignores supplied identity/prices', async () => {
          const results = await Promise.all([
               service.create(101, { ...body, patientid: 999, price: 0 }),
               service.create(101, body),
          ]);
          expect(results.map(r => r.id)).toEqual([1, 1]);
          expect(fixture.state().requests).toHaveLength(1);
          expect(fixture.state().requests[0].patientid).toBe(101);
          expect(fixture.state().audit).toHaveLength(1);
          expect(fixture.state().bills).toHaveLength(0);
          expect(mocks.checkout).not.toHaveBeenCalled();
          expect(results[0].testIds).toEqual([1, 2]);
          await expect(service.create(101, { ...body, testIds: [1] })).rejects.toThrow('already been used');
     });

     it('rejects unavailable tests and disabled portal billing', async () => {
          await expect(service.create(101, { ...body, testIds: [999] })).rejects.toThrow('no longer available');
          mocks.settings.mockResolvedValue({ portal_enabled: true, billing_enabled: false });
          await expect(service.create(101, body)).rejects.toThrow('not available');
          expect(fixture.state().requests).toHaveLength(0);
     });

     it('rolls back request submission if its audit cannot be written', async () => {
          fixture.controls.failAudit = true;
          await expect(service.create(101, body)).rejects.toThrow('audit insert failed');
          expect(fixture.state().requests).toHaveLength(0);
     });

     it('concurrent conversions create exactly one General bill with canonical rows and a single conversion audit', async () => {
          await service.create(101, body);
          const results = await Promise.all([
               service.convert(1, 12, 4, { ...conversion, patientid: 999, tenantId: 999, employeeid: 999, billingSource: 6,
                    focStaffId: 123, cart: [{ testid: 1, actualPrice: 0, discount: 100 }, { testid: 2, actualPrice: 0 }] }),
               service.convert(1, 12, 4, conversion),
          ]);
          expect(results.map(r => r.billingid)).toEqual([9000, 9000]);
          expect(mocks.generate).toHaveBeenCalledTimes(1);
          expect(mocks.generate).toHaveBeenCalledWith(101, 3, 4, 12, expect.anything());
          expect(mocks.checkout.mock.calls[0][0]).toMatchObject({
               tenantId: 3, patientId: 101, branchid: 4, employeeid: 12, billingSource: 1,
               cart: [{ testid: 1 }, { testid: 2 }], servicesList: [],
          });
          expect(fixture.state().bills[0]).toMatchObject({ payable: 105.25, outstanding: 105.25, paid: 0, patientid: 101, status: 'pending' });
          expect(fixture.state().entries.map((entry: any) => entry.totalpayable)).toEqual([40, 65.25]);
          expect(fixture.state().entries.every((entry: any) => entry.categoryTrackId === 1 && entry.paidamount === 0)).toBe(true);
          expect(fixture.state().requests[0]).toMatchObject({ status: 'converted', billingid: 9000, reviewed_by: 12 });
          expect(fixture.state().audit.filter((a: any) => a.action === 'billing_request.converted')).toHaveLength(1);
          expect(fixture.events.indexOf('lock')).toBeLessThan(fixture.events.indexOf('bill.insert'));
          expect(mocks.outbox).toHaveBeenCalledTimes(1);
          expect(mocks.notify).toHaveBeenCalledTimes(1);
     });

     it('confirmed converted replay returns the existing bill before checkout', async () => {
          await service.create(101, body);
          await service.convert(1, 12, 4, conversion);
          mocks.checkout.mockClear();
          expect(await service.convert(1, 12, 4, {})).toMatchObject({ status: true, billingid: 9000 });
          expect(mocks.checkout).not.toHaveBeenCalled();
     });

     it.each(['failBill', 'failAudit'] as const)('rolls back both bill and request when %s fails; retry is safe', async failure => {
          await service.create(101, body);
          fixture.controls[failure] = true;
          const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});
          try { await expect(service.convert(1, 12, 4, conversion)).rejects.toThrow('Failed to submit billing'); }
          finally { quiet.mockRestore(); }
          expect(fixture.state().requests[0]).toMatchObject({ status: 'submitted', billingid: null });
          expect(fixture.state().bills).toHaveLength(0);
          expect(fixture.state().entries).toHaveLength(0);
          expect(mocks.notify).not.toHaveBeenCalled();
          fixture.controls[failure] = false;
          expect(await service.convert(1, 12, 4, conversion)).toMatchObject({ status: true, billingid: 9000 });
     });

     it('failed checkout, stale totals and missing live tests never mark a request converted', async () => {
          await service.create(101, body);
          mocks.checkout.mockResolvedValueOnce({ success: false, message: 'No active session' });
          expect(await service.convert(1, 12, 4, conversion)).toMatchObject({ status: false });
          expect(await service.convert(1, 12, 4, { ...conversion, amountPayable: 1 })).toMatchObject({ status: false });
          mocks.checkout.mockResolvedValueOnce({ success: true, data: { cart: [], amountPayable: 105.25 } });
          expect(await service.convert(1, 12, 4, conversion)).toMatchObject({ status: false });
          expect(fixture.state().requests[0].status).toBe('submitted');
          expect(fixture.state().bills).toHaveLength(0);
     });

     it('decline wins safely over a concurrent conversion, and conversion wins safely over decline', async () => {
          await service.create(101, body);
          const results = await Promise.allSettled([
               service.reject(1, 12, 'Please contact the lab'),
               service.convert(1, 12, 4, conversion),
          ]);
          expect(results[0].status).toBe('fulfilled');
          expect(fixture.state().requests[0].status).toBe('rejected');
          expect(fixture.state().bills).toHaveLength(0);
          await service.create(102, { ...body, submissionKey: 'submission-test-key-0002' });
          await service.convert(2, 12, 4, conversion);
          await expect(service.reject(2, 12, 'Too late')).rejects.toThrow('already been converted');
          expect(fixture.state().bills).toHaveLength(1);
     });

     it.each([
          { cart: [{ testid: 1 }] }, { isPackageUsed: true }, { isAdjustment: 1 },
          { servicesProvided: [{ keyid: 1 }] }, { payments: [{ amount: 1 }] }, { paid: 1 },
          { amountPayable: '105.25' }, { isPromo: true },
     ])('rejects unsupported conversion inputs %j', async change => {
          await service.create(101, body);
          await expect(service.convert(1, 12, 4, { ...conversion, ...change })).rejects.toThrow();
          expect(fixture.state().bills).toHaveLength(0);
     });
});
