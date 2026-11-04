import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import { Workbook } from 'exceljs';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../models/pharmacy/PharmacyGeneralLedger', async importOriginal => {
     const original = await importOriginal<typeof import('../../models/pharmacy/PharmacyGeneralLedger')>();
     return { ...original, pharmacyGeneralLedger: vi.fn() };
});
import KnexConnection from '../../database/KnexConnections';
import { pharmacyGeneralLedger } from '../../models/pharmacy/PharmacyGeneralLedger';
import { pharmacyAccountingLedgerRouter } from './PharmacyAccountingLedgerController';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

let server: Server, url: string;
beforeEach(async () => {
     vi.clearAllMocks();
     const trx = { testTransaction: true };
     vi.mocked(KnexConnection).mockResolvedValue({ transaction: vi.fn(async callback => callback(trx)) } as never);
     vi.mocked(pharmacyGeneralLedger).mockResolvedValue({
          rows: [{ id: 1, journal_id: 'journal', date: '2026-10-01', reference: 'sale', kind: 'sale', description: 'Pharmacy sale', account: 'collection:1', account_name: 'Pharmacy till', source_document: 'sale', branchid: 2, debit: 100, credit: 0, business_unit: 'pharmacy', running_balance: 100 }],
          total: 1, page: 1, count: 50, totalPages: 1, journalCount: 1, periodTotals: { debit: 100, credit: 0 }, normalBalance: 'debit', openingBalance: 0, closingBalance: 100, accountBalances: [],
     });
     const app = express();
     app.use(express.json());
     app.use((req, _res, next) => {
          Object.assign(req, { authUser: { tenantId: 17, employeeid: 3, branch: 2, role: String(req.headers['x-test-role'] || 'pharmacy_accountant') } });
          next();
     });
     app.use('/accounting', pharmacyAccountingLedgerRouter);
     server = createServer(app);
     await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
     const address = server.address();
     if (!address || typeof address === 'string') throw new Error('Test server did not bind');
     url = `http://127.0.0.1:${address.port}/accounting`;
});
afterEach(async () => {
     await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
describe('pharmacy accounting ledger API', () => {
     it('derives tenant and branch from the authenticated context, not broadened query parameters', async () => {
          const response = await fetch(`${url}/ledger?tenantId=99&branchid=9&account=collection%3A1`);
          expect(response.status).toBe(200);
          expect(vi.mocked(KnexConnection)).toHaveBeenCalledWith(17);
          expect(vi.mocked(pharmacyGeneralLedger)).toHaveBeenCalledWith(expect.anything(), 2, expect.objectContaining({ branchid: '9' }));
          expect((await response.json()).data.rows[0].branchid).toBe(2);
     });
     it.each(['pharmacy_cashier', 'pharmacy_storekeeper', 'pharmacist', 'accountant'])('denies %s before querying financial data', async role => {
          const response = await fetch(`${url}/ledger`, { headers: { 'x-test-role': role } });
          expect(response.status).toBe(403);
          expect(vi.mocked(KnexConnection)).not.toHaveBeenCalled();
     });
     it('exports the complete filtered register as a real Excel workbook', async () => {
          const response = await fetch(`${url}/ledger/export?from=2026-10-01&to=2026-10-02&count=1`);
          expect(response.status).toBe(200);
          expect(response.headers.get('content-type')).toContain('spreadsheetml');
          expect(vi.mocked(pharmacyGeneralLedger)).toHaveBeenCalledWith(expect.anything(), 2, expect.objectContaining({ all: true, from: '2026-10-01' }));
          const workbook = new Workbook();
          await workbook.xlsx.load(await response.arrayBuffer());
          const sheet = workbook.getWorksheet('Pharmacy general ledger')!;
          expect(sheet.getCell('C2').value).toBe('collection:1');
          expect(sheet.getCell('I2').value).toBe(100);
          expect(sheet.getCell('K2').value).toBe(100);
     });
     it('surfaces export limits as an explicit error rather than a truncated workbook', async () => {
          vi.mocked(pharmacyGeneralLedger).mockRejectedValue(new Error('Ledger exports are limited to 10,000 rows'));
          const response = await fetch(`${url}/ledger/export`);
          expect(response.status).toBe(400);
          expect((await response.json()).error.message).toContain('10,000');
     });
     it('opens immutable operational journal detail with original source and denies foreign branch IDs', async () => {
          const fixture = accountingSqlDatabase();
          try {
               fixture.native.exec(`
                 CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER);
                 CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,debit NUMERIC,credit NUMERIC,document_ref TEXT);
                 CREATE TABLE pharmacy_accounting_settings(branchid INTEGER PRIMARY KEY,mappings TEXT);
                 CREATE TABLE pharmacy_accounting_posting_links(journal_id TEXT PRIMARY KEY,branchid INTEGER,shared_entry_id INTEGER);
                 CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,name TEXT,account_type TEXT);
               `);
               await fixture.db('pharmacy_collection_accounts').insert({ id: 1, branchid: 2, name: 'Pharmacy till', account_type: 'cash' });
               await fixture.db('pharmacy_journals').insert([{ id: 'operational', branchid: 2, source_ref: 'sale', kind: 'sale', description: 'Pharmacy receipt', financial_date: '2026-10-01', created_by: 3 }, { id: 'foreign', branchid: 9, source_ref: 'private', kind: 'sale', description: 'Other branch', financial_date: '2026-10-01', created_by: 9 }]);
               await fixture.db('pharmacy_journal_lines').insert([{ journal_id: 'operational', account_code: 'collection:1', debit: 100, credit: 0, document_ref: 'original-invoice' }, { journal_id: 'operational', account_code: 'sales', debit: 0, credit: 100 }]);
               vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
               const response = await fetch(`${url}/posted-journals/operational?branchid=9`);
               expect(response.status).toBe(200);
               const result = await response.json();
               expect(result.data).toMatchObject({ immutable: true, status: 'posted', kind: 'sale', branchid: 2, source_ref: 'sale' });
               expect(result.data.lines[0]).toMatchObject({ account_name: 'Pharmacy till', source_document: 'original-invoice', debit: 100 });
               expect((await fetch(`${url}/posted-journals/foreign?branchid=9`)).status).toBe(404);
          } finally { await fixture.db.destroy(); }
     });
     it('does not disclose query text or patient values when the database rejects a register query', async () => {
          vi.mocked(pharmacyGeneralLedger).mockRejectedValue(Object.assign(new Error('select patient_secret from private_table'), { code: 'ER_BAD_FIELD_ERROR', sql: 'select patient_secret from private_table' }));
          const response = await fetch(`${url}/ledger`);
          expect(response.status).toBe(500);
          expect(await response.text()).not.toContain('patient_secret');
     });
     it.each(['orphan', 'linked difference', 'empty shared source'])('reviews bounded sources and blocks direct consolidation for %s outside the review batch', async issue => {
          const fixture = accountingSqlDatabase();
          try {
               fixture.native.exec(`
                 CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER);
                 CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,debit NUMERIC,credit NUMERIC);
                 CREATE TABLE pharmacy_accounting_settings(branchid INTEGER PRIMARY KEY,tenant_id INTEGER,enabled INTEGER,effective_date TEXT,mappings TEXT);
                 CREATE TABLE pharmacy_accounting_posting_links(journal_id TEXT PRIMARY KEY,branchid INTEGER,shared_entry_id INTEGER);
                 CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,account_type TEXT);
                 CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT,type TEXT,is_active INTEGER);
                 CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,source_module TEXT,source_table TEXT,source_ref TEXT,status TEXT,occurred_at TEXT);
                 CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,journal_entry_id INTEGER,account_id INTEGER,direction TEXT,amount NUMERIC,branchid INTEGER);
                 CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
                 INSERT INTO pharmacy_collection_accounts VALUES(1,2,'cash');
                 INSERT INTO pharmacy_accounting_settings VALUES(2,17,1,'2026-10-01','{"cash":"cash","sales":"sales"}');
                 INSERT INTO acc_accounts VALUES(1,'cash','asset',1),(2,'sales','revenue',1);
               `);
               for (let i = 0; i < 151; i++) {
                    const id = `review-${String(i).padStart(4, '0')}`;
                    fixture.native.prepare('INSERT INTO pharmacy_journals VALUES(?,2,?,\'sale\',?,\'2026-10-01\',3)').run(id, id, id);
                    fixture.native.prepare('INSERT INTO pharmacy_journal_lines(journal_id,account_code,debit,credit) VALUES(?,\'collection:1\',1,0),(?,\'sales\',0,1)').run(id, id);
               }
               vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
               const range = 'from=2026-10-01&to=2026-10-01&branchid=9';
               const pending = await (await fetch(`${url}/consolidation?${range}`)).json();
               expect(pending.data).toMatchObject({ unlinked: 151, truncated: true, reviewLimit: 100 });
               expect(pending.data.items).toHaveLength(100);
               const check = await (await fetch(`${url}/consolidation/reconciliation?${range}`)).json();
               expect(check.data).toMatchObject({ journalCount: 151, unlinked: 151, linkedMismatchCount: 0, fullyChecked: true, rowsTruncated: true });
               expect([...new Set(check.data.rows.map((row: { journal_id: string }) => row.journal_id))]).toEqual(pending.data.items.map((row: { id: string }) => row.id));
               if (issue === 'orphan') fixture.native.exec(`
                    INSERT INTO acc_journal_entries VALUES(42,'pharmacy','unknown_source','orphan','posted','2026-10-01');
                    INSERT INTO acc_journal_lines(journal_entry_id,account_id,direction,amount,branchid) VALUES(42,1,'debit',1,2),(42,2,'credit',1,2);
               `);
               else if (issue === 'linked difference') fixture.native.exec(`
                    INSERT INTO acc_journal_entries VALUES(42,'pharmacy','pharmacy_journals','review-0150','posted','2026-10-01');
                    INSERT INTO pharmacy_accounting_posting_links VALUES('review-0150',2,42);
                    INSERT INTO acc_journal_lines(journal_entry_id,account_id,direction,amount,branchid) VALUES(42,1,'debit',0.5,2),(42,2,'credit',0.5,2);
               `);
               else fixture.native.exec("INSERT INTO acc_journal_entries VALUES(42,'pharmacy','pharmacy_journals','review-0150','posted','2026-10-01')");
               const existingLinks = await fixture.db('pharmacy_accounting_posting_links');
               const response = await fetch(`${url}/consolidation`, {
                    method: 'POST', headers: { 'content-type': 'application/json', 'x-test-role': 'pharmacy_manager' },
                    body: JSON.stringify({ idempotencyKey: 'reviewed-consolidation-001', from: '2026-10-01', to: '2026-10-01', journalIds: ['review-0000'], confirmed: true, reason: 'Reviewed source batch' }),
               });
               expect(response.status).toBe(409);
               expect((await response.json()).error.code).toBe('CONSOLIDATION_RECONCILIATION_REQUIRED');
               expect(await fixture.db('pharmacy_accounting_posting_links')).toEqual(existingLinks);
               expect(await fixture.db('pharmacy_enterprise_requests')).toHaveLength(0);
          } finally { await fixture.db.destroy(); }
     });
});
