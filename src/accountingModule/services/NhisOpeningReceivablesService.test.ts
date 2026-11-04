import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensureNhisAccountingSchema } from '../init/nhisAccountingSchema';
const mocks = vi.hoisted(() => ({ post: vi.fn(), can: vi.fn(), connect: vi.fn() }));
vi.mock('../index', () => ({ createAccountingService: () => ({ postTransaction: mocks.post }) }));
vi.mock('./AuthorityService', () => ({ AuthorityService: class { can = mocks.can; } }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('./AccountingPeriodService', () => ({ AccountingPeriodService: class { async assertPostingAllowed() {} } }));
import { NhisOpeningReceivablesService } from './NhisOpeningReceivablesService';
import { billingReceivableIds } from '../integrations/BillingAccounting';
let db: Knex, service: NhisOpeningReceivablesService;
const actor = { tenantId: 876954, branch: 4, employeeid: 3, role: 'admin', email: 'owner@example.test' };
const dates = { from: '2000-01-01', to: '2026-11-04', date: '2026-11-04' };
beforeEach(async () => {
    vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const fixture = accountingSqlDatabase(); db = fixture.db; mocks.connect.mockResolvedValue(db);
    fixture.native.exec(`
        CREATE TABLE billing(billingid INTEGER PRIMARY KEY,branchid INTEGER,billedon TEXT,payable NUMERIC,paid NUMERIC DEFAULT 0,writeoff NUMERIC DEFAULT 0,outstanding NUMERIC,status TEXT);
        CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,billingid INTEGER,isNHIS INTEGER,serviceCategory TEXT,categoryTrackId INTEGER,registrationType TEXT,isDeleted INTEGER DEFAULT 0,isRefunded INTEGER DEFAULT 0,status TEXT);
        CREATE TABLE billinghx(KeyID INTEGER PRIMARY KEY,Billingid INTEGER,Amount NUMERIC,type TEXT,isVoided INTEGER DEFAULT 0);
        CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT,name TEXT,type TEXT,is_active INTEGER);
        CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,source_module TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT,transaction_type TEXT,status TEXT,reversal_of_entry_id INTEGER);
        CREATE TABLE acc_posting_outbox(id INTEGER PRIMARY KEY,source_module TEXT,source_table TEXT,source_pk INTEGER,transaction_type TEXT);
        CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,timezone TEXT,status TEXT,workflow_version INTEGER,created_by INTEGER,created_at TEXT,updated_at TEXT,UNIQUE(branchid,financial_date));
        CREATE TABLE financial_historical_locks(id INTEGER PRIMARY KEY,branchid INTEGER,start_date TEXT,end_date TEXT);
        CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY,ledger TEXT,party_type TEXT,party_id INTEGER,party_name TEXT,document_type TEXT,document_ref TEXT,document_date TEXT,due_date TEXT,amount NUMERIC,gross_amount NUMERIC,tax_amount NUMERIC,source_module TEXT,source_table TEXT,source_ref TEXT,branchid INTEGER,created_at TEXT,UNIQUE(ledger,source_table,source_ref));
    `);
    await ensureNhisAccountingSchema(db);
    await db('billing').insert([{ billingid: 1, branchid: 4, billedon: '2026-01-01', payable: 115.01, paid: 15, outstanding: 100.01 },
        { billingid: 2, branchid: 4, billedon: '2026-01-01', payable: 0.02, outstanding: 0.02 },
        { billingid: 3, branchid: 5, billedon: '2026-01-01', payable: 50, outstanding: 50 }]);
    await db('dboservices').insert([1,2,3].map(id => ({ serviceid: id, billingid: id, isNHIS: 1 })));
    await db('acc_accounts').insert([{ id: 1, account_code: 'acc-3000', name: 'Opening equity', type: 'equity', is_active: 1 }, { id: 2, account_code: 'acc-1001', name: 'Bank', type: 'asset', is_active: 1 }]);
    mocks.can.mockResolvedValue({ allowed: true });
    mocks.post.mockImplementation(async payload => {
        const debit = payload.lines.filter((l: any) => l.direction === 'debit').reduce((sum: number,l: any) => sum + Math.round(l.amount * 100),0);
        const credit = payload.lines.filter((l: any) => l.direction === 'credit').reduce((sum: number,l: any) => sum + Math.round(l.amount * 100),0);
        expect(debit).toBe(credit);
        const [id] = await payload.trx('acc_journal_entries').insert({ source_module: payload.sourceModule, source_table: payload.sourceTable, source_pk: payload.sourcePk,
            source_ref: payload.sourceRef, transaction_type: payload.transactionType, status: 'posted', reversal_of_entry_id: payload.reversalOfEntryId || null });
        return { entry: { id } };
    });
    service = new NhisOpeningReceivablesService(876954, db);
});
afterEach(async () => { vi.useRealTimers(); await db.destroy(); });
async function input() { const preview = await service.preview(actor, dates); return { ...dates, amount: preview.amount, snapshotToken: preview.snapshotToken,
    offsetAccountCode: 'acc-3000', reference: 'Approved opening', reason: 'Reconciled migrated records', confirmed: true, acknowledgedLegacyReceipts: true, requestKey: 'opening-request-000001' }; }
describe('reviewed legacy NHIS opening receivables', () => {
    it('previews all missing branch bills without posting and exposes historical receipt differences', async () => {
        const preview = await service.preview(actor, dates);
        expect(preview).toMatchObject({ amount: 100.03, billCount: 2, unverifiedLegacyReceipts: 15 });
        expect(await db('acc_nhis_openings')).toHaveLength(0); expect(mocks.post).not.toHaveBeenCalled();
    });
    it('atomically records exact bill-linked AR and offset journals, enables settlement coverage and retries once', async () => {
        const before = await db('billing'); const payload = await input();
        const result = await service.post(actor, payload);
        expect(result).toMatchObject({ amount: 100.03, billCount: 2 });
        expect(await billingReceivableIds(876954, [1,2,3], db)).toEqual(new Set([1,2]));
        expect((await db('acc_subledger_entries')).reduce((sum,row) => sum + Math.round(row.amount * 100),0)).toBe(10003);
        expect(await db('billing')).toEqual(before);
        expect((await service.post(actor,payload)).alreadyApplied).toBe(true); expect(mocks.post).toHaveBeenCalledTimes(1);
        expect((await service.preview(actor,dates)).billCount).toBe(0);
    });
    it('rejects non-owners, wrong tenants, stale balances, wrong offset and missing confirmation without financial writes', async () => {
        const payload = await input();
        await expect(service.post({ ...actor, role: 'scientist' },payload)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.post({ ...actor, tenantId: 1 },payload)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.post(actor,{ ...payload, offsetAccountCode: 'acc-1001' })).rejects.toMatchObject({ code: 'INVALID_NHIS_OPENING_ACCOUNT' });
        await expect(service.post(actor,{ ...payload, confirmed: false })).rejects.toMatchObject({ code: 'INVALID_NHIS_OPENING' });
        await db('billing').where('billingid',1).update({ payable: 125.01, outstanding: 110.01 });
        await expect(service.post(actor,payload)).rejects.toMatchObject({ code: 'NHIS_SNAPSHOT_STALE' });
        expect(await db('acc_nhis_openings')).toHaveLength(0);
    });
    it('rolls back every header, journal, link and subledger entry on posting failure', async () => {
        const payload = await input(); mocks.post.mockRejectedValueOnce(new Error('posting failed'));
        await expect(service.post(actor,payload)).rejects.toThrow('posting failed');
        for (const table of ['acc_nhis_openings','acc_nhis_opening_bills','acc_journal_entries','acc_subledger_entries']) expect(await db(table)).toHaveLength(0);
    });
    it('reverses an opening atomically in both ledgers, preserves history and supports a later corrected import', async () => {
        const result = await service.post(actor,await input());
        const correction = { requestKey: 'opening-reverse-000001', reference: 'Correction', reason: 'Wrong opening offset' };
        expect(await service.reverse(actor,result.id,correction)).toMatchObject({ reversed: true });
        expect(await billingReceivableIds(876954,[1,2],db)).toEqual(new Set());
        expect((await db('acc_subledger_entries')).reduce((sum,row) => sum + Math.round(row.amount * 100),0)).toBe(0);
        expect((await service.reverse(actor,result.id,correction)).alreadyApplied).toBe(true);
        const next = { ...await input(), requestKey: 'opening-request-000002', reference: 'Corrected opening' };
        await service.post(actor,next); expect(await billingReceivableIds(876954,[1,2],db)).toEqual(new Set([1,2]));
    });
    it('blocks opening reversal while later NHIS settlements remain applied', async () => {
        const result = await service.post(actor,await input());
        const [eventId] = await db('acc_nhis_events').insert({ request_key:'later-receipt-00001',fingerprint:'hash',kind:'receipt',reference:'receipt',reason:'paid',event_date:'2026-11-04',branchid:4,amount:1,created_by:3 });
        await db('acc_nhis_allocations').insert({event_id:eventId,billingid:1,amount:1,tax_amount:0});
        await expect(service.reverse(actor,result.id,{ requestKey:'opening-reverse-00001',reference:'Correction',reason:'review' })).rejects.toMatchObject({code:'NHIS_OPENING_HAS_MOVEMENTS'});
        expect(await db('acc_nhis_opening_reversals')).toHaveLength(0);
    });    it('enforces approval ceilings and finalized days before creating financial records', async () => {
        const payload = await input();
        mocks.can.mockResolvedValueOnce({ allowed: false, reason: 'Approval limit' });
        await expect(service.post(actor,payload)).rejects.toMatchObject({ code: 'NHIS_AUTHORITY_DENIED' });
        expect(mocks.can).toHaveBeenCalledWith(3,'accounting.journal.approve',100.03,4);
        await db('financial_day_closures').insert({ branchid:4,financial_date:'2026-11-04',status:'finalized' });
        await expect(service.post(actor,payload)).rejects.toMatchObject({ code: 'FINANCIAL_RECORD_FINALIZED' });
        expect(await db('acc_nhis_openings')).toHaveLength(0);
    });
    it('rolls back an earlier complete batch when a later journal batch fails', async () => {
        const additional = Array.from({length:41},(_,index)=>({ billingid:index+4,branchid:4,billedon:'2026-01-01',payable:1,outstanding:1 }));
        await db('billing').insert(additional);
        await db('dboservices').insert(additional.map(row=>({serviceid:row.billingid,billingid:row.billingid,isNHIS:1})));
        const payload=await input(),post=mocks.post.getMockImplementation()!;
        mocks.post.mockImplementationOnce(post).mockRejectedValueOnce(new Error('Second batch failed'));
        await expect(service.post(actor,payload)).rejects.toThrow('Second batch failed');
        for (const table of ['acc_nhis_openings','acc_nhis_opening_bills','acc_journal_entries','acc_subledger_entries']) expect(await db(table)).toHaveLength(0);
    });
    it('rejects a changed amount or another branch snapshot and permits unchanged retries after finalization', async () => {
        const payload=await input();
        await expect(service.post(actor,{...payload,amount:100.02})).rejects.toMatchObject({code:'INVALID_NHIS_OPENING'});
        await expect(service.post({...actor,branch:5},payload)).rejects.toMatchObject({code:'NHIS_SNAPSHOT_STALE'});
        await service.post(actor,payload);
        await db('financial_day_closures').where('branchid',4).update({status:'finalized'});
        expect((await service.post(actor,payload)).alreadyApplied).toBe(true);
    });

});
