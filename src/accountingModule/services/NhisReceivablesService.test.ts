import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import type { AuthUser } from '../../middleware/authority';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensureNhisAccountingSchema } from '../init/nhisAccountingSchema';
import KnexConnection from '../../database/KnexConnections';

const { enqueue, authority, accrual, coverage } = vi.hoisted(() => ({ enqueue: vi.fn(), authority: vi.fn(), accrual: vi.fn(), coverage: vi.fn() }));
vi.mock('./AccountingOutboxService', () => ({ enqueuePosting: enqueue }));
vi.mock('./AuthorityService', () => ({ AuthorityService: class { can = authority; } }));
vi.mock('../integrations/BillingAccounting', () => ({ hasBillingReceivable: accrual, billingReceivableIds: coverage }));
vi.mock('./AccountingPeriodService', () => ({
     AccountingPeriodService: class {
          async assertPostingAllowed(date: string, trx: Knex.Transaction) {
               const period = await trx('acc_periods').where({ period_code: date.slice(0, 7) }).first();
               if (period?.status === 'closed') throw new Error('Accounting period is closed');
          }
     },
}));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { NhisReceivablesService, nhisDate, nhisPostingLines } from './NhisReceivablesService';
import { assertMutableBill } from '../../models/billing/BillingFinancialGuard';
import { OutstandingReceivablesService } from './OutstandingReceivablesService';

const user: AuthUser = { tenantId: 17, branch: 4, employeeid: 9, role: 'admin', email: 'accountant@example.test' };
let db: Knex, service: NhisReceivablesService;
const receipt = (overrides: Record<string, unknown> = {}) => ({
     requestKey: 'nhis-receipt-reference-0001', reference: 'NHIA remittance 001', reason: 'Verified bank receipt',
     date: '2026-11-04', amount: 500000, paymentAccountCode: 'acc-1001',
     allocations: [{ billingId: 42, amount: 250000 }, { billingId: 43, amount: 250000 }], ...overrides,
});

beforeEach(async () => {
     vi.clearAllMocks();
     vi.useFakeTimers({ toFake: ['Date'] });
     vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
     const fixture = accountingSqlDatabase();
     db = fixture.db;
     vi.mocked(KnexConnection).mockResolvedValue(db);
     fixture.native.function('CONCAT_WS', { varargs: true }, (separator: unknown, ...parts: unknown[]) => parts.filter(part => part !== null).join(String(separator)));
     await ensureNhisAccountingSchema(db);
     fixture.native.exec(`
       CREATE TABLE billing(billingid INTEGER PRIMARY KEY,patientid INTEGER,branchid INTEGER,billedon TEXT,payable NUMERIC,paid NUMERIC DEFAULT 0,outstanding NUMERIC,writeoff NUMERIC DEFAULT 0,amountIncurredDueTax NUMERIC DEFAULT 0,status TEXT,islocked INTEGER DEFAULT 0,record_validated_and_signed_off INTEGER DEFAULT 0);
       CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,billingid INTEGER,isNHIS INTEGER,serviceCategory TEXT,categoryTrackId INTEGER,registrationType TEXT,status TEXT,isDeleted INTEGER DEFAULT 0,isRefunded INTEGER DEFAULT 0,totalpayable NUMERIC,outstanding NUMERIC,paidamount NUMERIC DEFAULT 0);
       CREATE TABLE billinghx(KeyID INTEGER PRIMARY KEY,Billingid INTEGER,Amount NUMERIC,Date TEXT,type TEXT,isVoided INTEGER DEFAULT 0);
       CREATE TABLE new_patients(patientid INTEGER PRIMARY KEY,firstname TEXT,middlename TEXT,lastname TEXT,fullpatientid TEXT);
       CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY,ledger TEXT,party_type TEXT,party_id INTEGER,party_name TEXT,document_type TEXT,document_ref TEXT,document_date TEXT,due_date TEXT,amount NUMERIC,gross_amount NUMERIC,tax_amount NUMERIC,source_module TEXT,source_table TEXT,source_ref TEXT,branchid INTEGER,created_at TEXT,UNIQUE(ledger,source_table,source_ref));
       CREATE TABLE acc_periods(period_code TEXT,status TEXT);
       CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,timezone TEXT,status TEXT,workflow_version INTEGER,created_by INTEGER,created_at TEXT,updated_at TEXT,UNIQUE(branchid,financial_date));
       CREATE TABLE financial_historical_locks(id INTEGER PRIMARY KEY,branchid INTEGER,start_date TEXT,end_date TEXT);
       CREATE TABLE financial_record_locks(source_table TEXT,source_ref TEXT);
       CREATE TABLE test_postings(id INTEGER PRIMARY KEY,payload TEXT);
     `);
     await db('billing').insert([
          { billingid: 42, patientid: 21, branchid: 4, billedon: '2026-01-15', payable: 600000, outstanding: 600000, status: 'pending' },
          { billingid: 43, patientid: 22, branchid: 4, billedon: '2026-04-30', payable: 600000, outstanding: 600000, status: 'pending' },
          { billingid: 44, patientid: 23, branchid: 5, billedon: '2026-04-15', payable: 50, outstanding: 50, status: 'pending' },
          { billingid: 45, patientid: 24, branchid: 4, billedon: '2026-03-15', payable: 100, outstanding: 100, status: 'pending' },
     ]);
     await db('dboservices').insert([
          { serviceid: 1, billingid: 42, isNHIS: 1, serviceCategory: 'NHIS', categoryTrackId: 4, registrationType: 'nhis', status: 'active' },
          { serviceid: 2, billingid: 43, isNHIS: 1, serviceCategory: 'NHIS', categoryTrackId: 4, registrationType: 'nhis', status: 'active' },
          { serviceid: 3, billingid: 44, isNHIS: 1, serviceCategory: 'NHIS', categoryTrackId: 4, registrationType: 'nhis', status: 'active' },
          { serviceid: 4, billingid: 45, isNHIS: 0, serviceCategory: 'GENERAL', categoryTrackId: 1, registrationType: 'self', status: 'active' },
     ]);
     authority.mockResolvedValue({ allowed: true, source: 'role', delegationId: null, reason: 'Administrator' });
     accrual.mockResolvedValue(true);
     coverage.mockImplementation(async (_tenant, ids: number[]) => new Set(ids));
     enqueue.mockImplementation(async (_tenant, payload, trx) => { await trx('test_postings').insert({ payload: JSON.stringify(payload) }); });
     service = new NhisReceivablesService(17, db);
});

const period = (overrides: Record<string, unknown> = {}) => ({
     from: '2026-01-01', to: '2026-05-31', amount: '600000.00', date: '2026-11-04', remainingDisposition: 'pending', ...overrides,
});
async function periodInput(overrides: Record<string, unknown> = {}) {
     const intent = period(overrides), preview = await service.previewPeriod(user, intent);
     return { ...intent, snapshotToken: preview.snapshotToken, requestKey: 'nhis-period-settlement-0001',
          reference: 'NHIA period receipt', reason: 'Bank remittance verified', paymentAccountCode: 'acc-1001' };
}

describe('NHIS server-authoritative period settlements', () => {
     beforeEach(async () => {
          await db('billing').where({ billingid: 42 }).update({ payable: 300000, outstanding: 300000 });
          await db('billing').where({ billingid: 43 }).update({ payable: 500000, outstanding: 500000 });
     });
     it('allocates GHS600000 against GHS800000 proportionally and persists period metadata without changing invoices', async () => {
          const preview = await service.previewPeriod(user, period());
          expect(preview).toMatchObject({ billCount: 2, eligibleOutstanding: 800000, received: 600000, remaining: 200000, adjusted: 0, outstandingAfter: 200000 });
          expect(preview.allocationSample.map(a => a.received)).toEqual([225000, 375000]);
          const input = await periodInput(), result = await service.settlePeriod(user, input);
          expect(result.settlement).toMatchObject({ from: '2026-01-01', to: '2026-05-31', remainingDisposition: 'pending', state: 'applied' });
          expect(result.receiptEvent).toMatchObject({ allocationCount: 2, allocations: [] });
          expect((await service.events(user)).rows[0].periodSettlement).toMatchObject({ remaining: 200000, remainingDisposition: 'pending' });
          expect((await service.cohort(user)).totals.outstanding).toBe(200000);
          expect((await db('billing').where({ billingid: 42 }).first()).outstanding).toBe(300000);
          vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
          await db('acc_periods').insert({ period_code: '2026-11', status: 'closed' });
          expect((await service.settlePeriod(user, input)).alreadyApplied).toBe(true);
          await expect(service.settlePeriod(user, { ...input, reason: 'Different intent' })).rejects.toMatchObject({ code: 'NHIS_REQUEST_CONFLICT' });
     });
     it.each(['appeal', 'disputed'] as const)('keeps %s in AR with auditable reasons', async remainingDisposition => {
          const input = await periodInput({ remainingDisposition });
          await expect(service.settlePeriod(user, input)).rejects.toMatchObject({ code: 'INVALID_NHIS_DISPOSITION' });
          const result = await service.settlePeriod(user, { ...input, remainingReason: 'Claim under NHIA review' });
          expect(result.settlement).toMatchObject({ outstandingAfter: 200000, remainingReason: 'Claim under NHIA review' });
          expect(await db('acc_nhis_events')).toHaveLength(1);
     });
     it.each(['write_off', 'revenue_adjustment'] as const)('atomically posts receipt plus explicit %s of the entire remainder', async adjustmentKind => {
          const input = { ...await periodInput({ remainingDisposition: 'final', adjustmentKind }),
               adjustmentReference: 'Approved final determination', adjustmentReason: 'Authorized unrecoverable claim determination' };
          const result = await service.settlePeriod(user, input);
          expect(result.settlement).toMatchObject({ adjusted: 200000, outstandingAfter: 0 });
          expect(result.adjustmentEvent).toMatchObject({ kind: adjustmentKind, amount: 200000 });
          expect(authority).toHaveBeenCalledWith(9, 'accounting.journal.post', 600000, 4);
          expect(authority).toHaveBeenCalledWith(9, 'accounting.journal.approve', 200000, 4);
          expect((await service.cohort(user)).totals.outstanding).toBe(0);
          await expect(service.reverse(user, result.receiptEvent!.id, { requestKey: 'individual-reversal-key', date: '2026-11-04', reference: 'Correction', reason: 'Wrong reference' }))
               .rejects.toMatchObject({ code: 'NHIS_SETTLEMENT_REVERSAL_REQUIRED' });
          const reversalInput = { requestKey: 'period-reversal-key-0001', date: '2026-11-04', reference: 'Period correction', reason: 'Wrong cohort' };
          const reversal = await service.reversePeriod(user, result.settlement.id, reversalInput);
          expect(reversal.settlement.state).toBe('reversed');
          expect((await service.cohort(user)).totals.outstanding).toBe(800000);
          expect((await service.reversePeriod(user, result.settlement.id, reversalInput)).alreadyApplied).toBe(true);
          expect((await service.events(user)).rows.every(row => row.periodSettlement?.state === 'reversed')).toBe(true);
     });
     it('allows a later period final adjustment with no cash, no receipt and only approve authority', async () => {
          await service.settlePeriod(user, await periodInput());
          const intent = period({ amount: '0.00', remainingDisposition: 'final', adjustmentKind: 'write_off' });
          const preview = await service.previewPeriod(user, intent);
          authority.mockClear();
          const result = await service.settlePeriod(user, { ...intent, snapshotToken: preview.snapshotToken, requestKey: 'period-final-only-0001',
               reference: 'Final period decision', reason: 'Reviewed appealed cohort', adjustmentReference: 'APPROVAL-123', adjustmentReason: 'Final unrecoverable decision' });
          expect(result.receiptEvent).toBeNull();
          expect(result.adjustmentEvent).toMatchObject({ amount: 200000 });
          expect(authority.mock.calls.every(call => call[1] === 'accounting.journal.approve')).toBe(true);
          expect((await service.cohort(user)).totals.outstanding).toBe(0);
     });
     it('omits zero allocations, uses exact pesewas and breaks remainder ties by billing ID', async () => {
          await db('billing').whereIn('billingid', [42, 43]).update({ payable: 0.03, outstanding: 0.03 });
          const input = await periodInput({ amount: '0.01' });
          const result = await service.settlePeriod(user, input);
          expect(await db('acc_nhis_allocations').where({ event_id: result.receiptEvent!.id })).toEqual([
               expect.objectContaining({ billingid: 42, amount: 0.01 }),
          ]);
          expect(result.settlement.remaining).toBe(0.05);
     });
     it.each(['balance', 'membership', 'coverage', 'new bill', 'tax'] as const)('rejects stale %s snapshots with no financial writes', async change => {
          const input = await periodInput();
          if (change === 'balance') await db('billing').where({ billingid: 42 }).update({ outstanding: 1 });
          if (change === 'membership') await db('dboservices').where({ billingid: 42 }).update({ isNHIS: 0, categoryTrackId: 1, registrationType: 'self', serviceCategory: 'GENERAL' });
          if (change === 'coverage') coverage.mockResolvedValue(new Set([43]));
          if (change === 'tax') await db('billing').where({ billingid: 42 }).update({ amountIncurredDueTax: 10 });
          if (change === 'new bill') {
               await db('billing').insert({ billingid: 46, patientid: 25, branchid: 4, billedon: '2026-05-31', payable: 1, outstanding: 1 });
               await db('dboservices').insert({ serviceid: 6, billingid: 46, isNHIS: 1 });
          }
          await expect(service.settlePeriod(user, input)).rejects.toMatchObject({ code: 'NHIS_SNAPSHOT_STALE' });
          expect(await db('acc_nhis_events')).toHaveLength(0);
          expect(await db('test_postings')).toHaveLength(0);
     });
     it('excludes mixed, other-branch and unaccrued bills rather than inventing opening accruals', async () => {
          await db('dboservices').insert({ serviceid: 5, billingid: 45, isNHIS: 1 });
          coverage.mockResolvedValue(new Set([43]));
          const preview = await service.previewPeriod(user, period({ amount: 100 }));
          expect(preview).toMatchObject({ billCount: 1, eligibleOutstanding: 500000, excludedMixedBillCount: 1, excludedMissingAccrualBillCount: 1 });
     });
     it('rolls back receipt, allocations and subledger when the paired adjustment enqueue fails', async () => {
          const input = { ...await periodInput({ remainingDisposition: 'final', adjustmentKind: 'write_off' }),
               adjustmentReference: 'APPROVAL', adjustmentReason: 'Final determination' };
          enqueue.mockImplementationOnce(async (_tenant, payload, trx) => { await trx('test_postings').insert({ payload: JSON.stringify(payload) }); })
               .mockRejectedValueOnce(new Error('Injected outbox failure'));
          await expect(service.settlePeriod(user, input)).rejects.toThrow('Injected outbox failure');
          for (const table of ['acc_nhis_events', 'acc_nhis_allocations', 'acc_subledger_entries', 'acc_nhis_period_settlements', 'test_postings']) expect(await db(table)).toHaveLength(0);
     });
     it('checks approval against the whole final remainder and rolls back a conflicting external reference', async () => {
          const input = { ...await periodInput({ remainingDisposition: 'final', adjustmentKind: 'write_off' }),
               adjustmentReference: 'APPROVAL', adjustmentReason: 'Final determination' };
          authority.mockImplementation(async (_employee, permission, amount) => ({ allowed: !(permission === 'accounting.journal.approve' && amount > 100000), reason: 'Approval ceiling' }));
          await expect(service.settlePeriod(user, input)).rejects.toMatchObject({ code: 'NHIS_AUTHORITY_DENIED' });
          expect(await db('acc_nhis_events')).toHaveLength(0);
          authority.mockResolvedValue({ allowed: true });
          await service.settlePeriod(user, input);
          const next = await periodInput({ from: '2026-04-01', amount: '1.00' }).catch(() => null);
          expect(next).toBeNull(); // cohort is fully settled, no invented receipt fallback
          await service.reversePeriod(user, 1, { requestKey: 'reverse-reference-check', date: '2026-11-04', reference: 'Restore', reason: 'Corrected determination' });
          const refreshed = await periodInput();
          await expect(service.settlePeriod(user, { ...refreshed, requestKey: 'conflicting-reference-0002' })).rejects.toMatchObject({ code: 'NHIS_REFERENCE_CONFLICT' });
          expect(await db('acc_nhis_period_settlements')).toHaveLength(1);
     });
     it('fully paid final cohorts omit noncash events and unchanged preview tokens are stable', async () => {
          const intent = period({ amount: '800000.00', remainingDisposition: 'final', adjustmentKind: 'write_off' });
          const preview = await service.previewPeriod(user, intent);
          expect((await service.previewPeriod(user, { ...intent, amount: 800000 })).snapshotToken).toBe(preview.snapshotToken);
          const input = { ...await periodInput({ amount: 800000, remainingDisposition: 'final', adjustmentKind: 'write_off' }),
               adjustmentReference: 'APPROVAL-full', adjustmentReason: 'Full remittance reviewed' };
          const result = await service.settlePeriod(user, input);
          expect(result.adjustmentEvent).toBeUndefined(); expect(result.settlement.adjusted).toBe(0);
          expect(await db('acc_nhis_events')).toHaveLength(1);
     });
     it('rolls back both reversal events when the second reversal fails', async () => {
          const input = { ...await periodInput({ remainingDisposition: 'final', adjustmentKind: 'write_off' }),
               adjustmentReference: 'APPROVAL-reverse', adjustmentReason: 'Final determination' };
          const result = await service.settlePeriod(user, input);
          enqueue.mockImplementationOnce(async (_tenant, payload, trx) => { await trx('test_postings').insert({ payload: JSON.stringify(payload) }); })
               .mockRejectedValueOnce(new Error('Second reversal failed'));
          await expect(service.reversePeriod(user, result.settlement.id, { requestKey: 'atomic-reversal-failure', date: '2026-11-04', reference: 'Correction', reason: 'Wrong cohort' })).rejects.toThrow('Second reversal failed');
          expect(await db('acc_nhis_events').where({ kind: 'reversal' })).toHaveLength(0);
          expect((await service.cohort(user)).totals.outstanding).toBe(0);
     });
     it('honors current close guards while allowing closed historic service dates', async () => {
          await db('acc_periods').insert({ period_code: '2026-01', status: 'closed' });
          const input = await periodInput();
          await db('financial_day_closures').insert({ branchid: 4, financial_date: '2026-11-04', timezone: 'UTC', status: 'finalized', workflow_version: 1 });
          await expect(service.settlePeriod(user, input)).rejects.toThrow();
          expect(await db('acc_nhis_events')).toHaveLength(0);
     });
     it('rejects missing approval, zero nonfinal cash, invalid precision, missing payment account and tenant mismatch', async () => {
          await expect(service.previewPeriod(user, period({ amount: '0.00' }))).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
          await expect(service.previewPeriod(user, period({ amount: '1.001' }))).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
          await expect(service.previewPeriod({ ...user, tenantId: 18 }, period())).rejects.toMatchObject({ code: 'NHIS_CONTEXT_REQUIRED' });
          const input = await periodInput();
          await expect(service.settlePeriod(user, { ...input, paymentAccountCode: undefined })).rejects.toMatchObject({ code: 'NHIS_PAYMENT_ACCOUNT_REQUIRED' });
          authority.mockResolvedValue({ allowed: false, reason: 'Approval ceiling exceeded' });
          await expect(service.settlePeriod(user, input)).rejects.toMatchObject({ code: 'NHIS_AUTHORITY_DENIED' });
     });
     it('processes 5001 bills regardless of report page and bounds insert/query batches', async () => {
          await db('billing').delete(); await db('dboservices').delete();
          for (let start = 1; start <= 5001; start += 100) {
               const ids = Array.from({ length: Math.min(100, 5002 - start) }, (_, i) => start + i);
               await db('billing').insert(ids.map(id => ({ billingid: id, patientid: id, branchid: 4, billedon: '2026-03-15', payable: 160, outstanding: 160 })));
               await db('dboservices').insert(ids.map(id => ({ serviceid: id, billingid: id, isNHIS: 1 })));
          }
          const queries: string[] = []; db.on('query', query => queries.push(query.sql));
          const input = await periodInput(), result = await service.settlePeriod(user, input);
          expect(result.settlement.billCount).toBe(5001);
          expect(result.settlement.allocationSample).toHaveLength(20);
          const allocations = await db('acc_nhis_allocations').where({ event_id: result.receiptEvent!.id });
          expect(allocations).toHaveLength(5001);
          expect(allocations.reduce((sum, a) => sum + Math.round(Number(a.amount) * 100), 0)).toBe(60000000);
          expect(allocations.every(a => Number(a.amount) <= 160)).toBe(true);
          expect(queries.length).toBeLessThan(500);
          expect(enqueue.mock.calls.every(([, payload]) => Buffer.byteLength(JSON.stringify(payload), 'utf8') < 64000)).toBe(true);
          expect(new Set(enqueue.mock.calls.map(([, payload]) => payload.sourceRef)).size).toBe(enqueue.mock.calls.length);
          const events = await service.events(user);
          expect(events.rows[0]).toMatchObject({ allocationCount: 5001, allocations: [], allocationsTruncated: true });
          const page = await service.eventAllocations(user, result.receiptEvent!.id, { page: 2, count: 20 });
          expect(page).toMatchObject({ total: 5001, page: 2, count: 20 });
          expect(page.rows).toHaveLength(20); expect(page.rows[0].billingid).toBe(21);
          await expect(service.eventAllocations({ ...user, branch: 5 }, result.receiptEvent!.id)).rejects.toMatchObject({ code: 'NHIS_EVENT_NOT_FOUND' });
     }, 30000);
});
afterEach(async () => { vi.useRealTimers(); await db.destroy(); });

describe('NHIS claims receivables and settlement accounting', () => {
     it('reconciles the 1.2 million / 500,000 example without recognizing revenue twice', async () => {
          const result = await service.record(user, 'receipt', receipt());
          expect(result.allocations).toHaveLength(2);
          const report = await service.cohort(user, { from: '2026-01-01', to: '2026-04-30', count: 1 });
          expect(report.total).toBe(2);
          expect(report.rows).toHaveLength(1);
          expect(report.totals).toMatchObject({ expected: 1200000, received: 500000, outstanding: 700000, writtenOff: 0, revenueAdjustments: 0 });
          const posting = enqueue.mock.calls[0][1];
          expect(posting.lines.every((line: { accountCode: string }) => ['acc-1001', 'acc-1002'].includes(line.accountCode))).toBe(true);
          expect(await db('acc_subledger_entries')).toEqual(expect.arrayContaining([
               expect.objectContaining({ party_type: 'nhis', document_ref: 'BILL-42', amount: -250000 }),
               expect.objectContaining({ party_type: 'nhis', document_ref: 'BILL-43', amount: -250000 }),
          ]));
          expect((await db('billing').where({ billingid: 42 }).first()).outstanding).toBe(600000);
     });
     it('separates service-period recovery from receipt-period cash', async () => {
          await service.record(user, 'receipt', receipt());
          expect((await service.cashReceipts(user, { from: '2026-01-01', to: '2026-04-30' })).totals.netReceived).toBe(0);
          expect((await service.cashReceipts(user, { from: '2026-11-01', to: '2026-11-30' })).totals.netReceived).toBe(500000);
          expect((await service.cohort(user, { from: '2026-01-01', to: '2026-04-30' })).totals.received).toBe(500000);
     });
     it('keeps rejected/unpaid balances outstanding until an explicit authorized adjustment', async () => {
          await service.record(user, 'receipt', receipt());
          await service.record(user, 'revenue_adjustment', {
               requestKey: 'nhis-tariff-adjustment-0001', date: '2026-11-04', reference: 'Final tariff determination', reason: 'Final reviewed tariff reduction',
               amount: 100000, allocations: [{ billingId: 42, amount: 100000 }],
          });
          expect((await service.cohort(user)).totals).toMatchObject({ received: 500000, revenueAdjustments: 100000, writtenOff: 0, outstanding: 600000 });
          await service.record(user, 'write_off', {
               requestKey: 'nhis-bad-debt-writeoff-0001', date: '2026-11-04', reference: 'Authorized write-off', reason: 'Accountant-approved uncollectible valid claims',
               amount: 600000, allocations: [{ billingId: 42, amount: 250000 }, { billingId: 43, amount: 350000 }],
          });
          expect((await service.cohort(user)).totals).toMatchObject({ received: 500000, revenueAdjustments: 100000, writtenOff: 600000, outstanding: 0 });
          expect(enqueue.mock.calls[2][1].lines).toEqual(expect.arrayContaining([expect.objectContaining({ accountCode: 'acc-5007', direction: 'debit' })]));
     });
     it('keeps the generic frontend receivables projection aligned with NHIS cash received rather than total debt reductions', async () => {
          await service.record(user, 'receipt', receipt());
          await service.record(user, 'revenue_adjustment', {
               requestKey: 'nhis-projection-adjustment-0001', date: '2026-11-04', reference: 'Reviewed tariff deduction',
               reason: 'Final tariff determination', amount: 100000, allocations: [{ billingId: 42, amount: 100000 }],
          });
          const report = await new OutstandingReceivablesService(17).list({ payerType: 'nhis' });
          expect(report.rows.find(row => row.billingId === 42)).toMatchObject({
               payerPaid: 250000, nhisReceivedAmount: 250000, nhisSettledAmount: 350000, payerOutstanding: 250000,
          });
          expect(report.totals.byPayer.nhis).toBe(600050);
     });
     it('is idempotent and rejects changing a successful request', async () => {
          const first = await service.record(user, 'receipt', receipt());
          const second = await service.record(user, 'receipt', receipt());
          expect(second).toMatchObject({ id: first.id, alreadyApplied: true });
          expect(await db('acc_nhis_events')).toHaveLength(1);
          expect(await db('test_postings')).toHaveLength(1);
          await expect(service.record(user, 'receipt', receipt({ reason: 'Changed reason' }))).rejects.toMatchObject({ code: 'NHIS_REQUEST_CONFLICT' });
     });
     it('prevents recording the same external remittance twice under different request keys',async()=>{
          await service.record(user,'receipt',receipt());
          await expect(service.record(user,'receipt',receipt({requestKey:'nhis-duplicate-reference-0001'}))).rejects.toMatchObject({code:'NHIS_REFERENCE_CONFLICT'});
          expect(await db('acc_nhis_events')).toHaveLength(1);
     });
     it('reports 1,000 insurance transactions without a payer lookup per transaction',async()=>{
          await db('billing').delete();await db('dboservices').delete();
          for(let start=1;start<=1000;start+=100){
               const ids=Array.from({length:100},(_,index)=>start+index);
               await db('billing').insert(ids.map(billingid=>({billingid,patientid:billingid,branchid:4,billedon:'2026-04-30',payable:1200,outstanding:1200,status:'pending'})));
               await db('dboservices').insert(ids.map(serviceid=>({serviceid,billingid:serviceid,isNHIS:1,serviceCategory:'NHIS',categoryTrackId:4,registrationType:'nhis',status:'active'})));
          }
          const queries:string[]=[];
          db.on('query',(query:{sql:string})=>queries.push(query.sql));
          const report=await service.cohort(user,{from:'2026-01-01',to:'2026-04-30',count:25});
          expect(report.total).toBe(1000);expect(report.rows).toHaveLength(25);expect(report.totals.expected).toBe(1200000);
          expect(queries.filter(sql=>sql.includes('from `dboservices`'))).toHaveLength(1);
     });
     it.each([
          { amount: 500000.001 }, { amount: 500001 },
          { allocations: [{ billingId: 42, amount: 500000 }, { billingId: 42, amount: 0 }] },
          { amount: -1, allocations: [{ billingId: 42, amount: -1 }] },
          { date: '2026-02-31' }, { date: '2026-11-05' }, { date: '2025-12-31' },
          { paymentAccountCode: undefined },
          { allocations: [{ billingId: 44, amount: 500000 }] },
          { allocations: [{ billingId: 45, amount: 500000 }] },
     ])('rejects invalid money, dates, accounts and payer/branch associations %#', async overrides => {
          await expect(service.record(user, 'receipt', receipt(overrides))).rejects.toThrow();
          expect(await db('acc_nhis_events')).toHaveLength(0);
          expect(await db('acc_nhis_allocations')).toHaveLength(0);
          expect(await db('test_postings')).toHaveLength(0);
     });
     it('serializes competing settlements and prevents over-allocation', async () => {
          const [first, second] = await Promise.allSettled([
               service.record(user, 'receipt', receipt()),
               service.record(user, 'receipt', receipt({ requestKey: 'nhis-competing-receipt-0001', amount: 800000, allocations: [{ billingId: 42, amount: 400000 }, { billingId: 43, amount: 400000 }] })),
          ]);
          expect([first, second].filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect((await service.cohort(user)).totals.outstanding).toBeGreaterThanOrEqual(0);
     });
     it('rolls back allocations, subledger and events when enqueue fails', async () => {
          enqueue.mockRejectedValueOnce(new Error('Outbox unavailable'));
          await expect(service.record(user, 'receipt', receipt())).rejects.toThrow('Outbox unavailable');
          expect(await db('acc_nhis_events')).toHaveLength(0);
          expect(await db('acc_nhis_allocations')).toHaveLength(0);
          expect(await db('acc_subledger_entries')).toHaveLength(0);
          expect((await service.record(user, 'receipt', receipt())).id).toBeGreaterThan(0);
     });
     it('supports current-period settlement of immutable historical bills without rewriting history', async () => {
          await db('financial_historical_locks').insert({ branchid: 4, start_date: '2026-01-01', end_date: '2026-04-30' });
          const before = await db('billing').where({ billingid: 42 }).first();
          await service.record(user, 'receipt', receipt());
          expect(await db('billing').where({ billingid: 42 }).first()).toEqual(before);
          await expect(service.record(user, 'receipt', receipt({ requestKey: 'nhis-historical-date-0001', date: '2026-04-30' }))).rejects.toMatchObject({ code: 'FINANCIAL_RECORD_FINALIZED' });
     });
     it('blocks postings into finalized days and closed accounting periods', async () => {
          await db('financial_day_closures').insert({ branchid: 4, financial_date: '2026-11-04', status: 'finalized' });
          await expect(service.record(user, 'receipt', receipt())).rejects.toMatchObject({ code: 'FINANCIAL_RECORD_FINALIZED' });
          await db('financial_day_closures').delete();
          await db('acc_periods').insert({ period_code: '2026-11', status: 'closed' });
          await expect(service.record(user, 'receipt', receipt())).rejects.toThrow('Accounting period is closed');
          expect(await db('acc_nhis_events')).toHaveLength(0);
     });
     it('requires authority for the complete remittance amount and rejects cross-tenant actors', async () => {
          authority.mockResolvedValueOnce({ allowed: false, reason: 'Amount exceeds delegated ceiling' });
          await expect(service.record(user, 'receipt', receipt())).rejects.toMatchObject({ code: 'NHIS_AUTHORITY_DENIED' });
          expect(authority).toHaveBeenCalledWith(9, 'accounting.journal.post', 500000, 4);
          await expect(service.record({ ...user, tenantId: 18 }, 'receipt', receipt())).rejects.toMatchObject({ code: 'NHIS_CONTEXT_REQUIRED' });
     });
     it('requires existing accrual coverage instead of silently recognizing new revenue on collection', async () => {
          accrual.mockResolvedValue(false);
          await expect(service.record(user, 'receipt', receipt())).rejects.toMatchObject({ code: 'NHIS_ACCRUAL_REQUIRED' });
          expect(await db('test_postings')).toHaveLength(0);
     });
     it('reverses receipts once with exact opposing entries and restored balances', async () => {
          const original = await service.record(user, 'receipt', receipt());
          const payload = { requestKey: 'nhis-reversal-reference-0001', date: '2026-11-04', reference: 'Correction of remittance', reason: 'Wrong bank remittance reference' };
          const reversed = await service.reverse(user, Number(original.id), payload);
          expect(reversed.reversal_of_event_id).toBe(original.id);
          expect((await service.reverse(user, Number(original.id), payload)).alreadyApplied).toBe(true);
          expect((await service.cohort(user)).totals).toMatchObject({ received: 0, outstanding: 1200000 });
          expect((await service.cashReceipts(user)).totals).toEqual({ received: 500000, reversedOrRefunded: 500000, netReceived: 0 });
          expect(enqueue.mock.calls[1][1].lines).toEqual(expect.arrayContaining([expect.objectContaining({ accountCode: 'acc-1001', direction: 'credit', amount: 250000 })]));
          await expect(service.reverse(user, Number(original.id), { ...payload, requestKey: 'nhis-second-reversal-0001' })).rejects.toMatchObject({ code: 'NHIS_ALREADY_REVERSED' });
     });
     it('blocks legacy collections or bill edits after payer events so the stale invoice balance cannot be spent twice', async () => {
          await service.record(user, 'receipt', receipt());
          const bill = await db('billing').where({ billingid: 42 }).first();
          await expect(db.transaction(trx => assertMutableBill(trx, 17, bill))).rejects.toThrow('linked NHIS accounting events');
     });
     it('excludes mixed bills explicitly, and never treats them as wholly NHIS', async () => {
          await db('dboservices').insert({ serviceid: 5, billingid: 42, isNHIS: 0, serviceCategory: 'GENERAL', categoryTrackId: 1, registrationType: 'self', status: 'active' });
          expect((await service.cohort(user)).excludedMixedBills).toContain(42);
          await expect(service.record(user, 'receipt', receipt())).rejects.toMatchObject({ code: 'NHIS_PAYER_MISMATCH' });
     });
     it('flags legacy receipt discrepancies rather than inventing cash receipts', async () => {
          await db('billing').where({ billingid: 42 }).update({ paid: 100, outstanding: 599900 });
          expect((await service.cohort(user)).totals.unverifiedLegacyReceipts).toBe(100);
          expect((await service.cashReceipts(user)).totals.netReceived).toBe(0);
     });
     it('balances tariff adjustments including proportional tax and exact reversals', () => {
          const allocations = [{ billingId: 42, amount: 110, taxAmount: 10 }];
          const forward = nhisPostingLines('revenue_adjustment', allocations, 4, 9);
          expect(forward).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-4000', direction: 'debit', amount: 100 }),
               expect.objectContaining({ accountCode: 'acc-2002', direction: 'debit', amount: 10 }),
          ]));
          expect(forward.reduce((sum, line) => sum + (line.direction === 'debit' ? line.amount : -line.amount), 0)).toBe(0);
          expect(nhisPostingLines('revenue_adjustment', allocations, 4, 9, undefined, true).map(line => line.direction)).toEqual(['credit', 'credit', 'debit']);
          expect(() => nhisDate('2026-02-29')).toThrow();
     });
});
