import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensurePharmacyTaxSchema } from '../../models/pharmacy/PharmacyTax';
import { pharmacyTaxRouter } from './PharmacyTaxController';

let fixture: ReturnType<typeof accountingSqlDatabase>, server: Server, url: string;
beforeEach(async () => {
     fixture = accountingSqlDatabase();
     await ensurePharmacyTaxSchema(fixture.db);
     await ensurePharmacyTaxSchema(fixture.db);
     fixture.native.exec(`
       CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER);
       CREATE TABLE pharmacy_accounting_settings(branchid INTEGER PRIMARY KEY,mappings TEXT);
       CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT,type TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
       CREATE TABLE pharmacy_enterprise_events(id INTEGER PRIMARY KEY,workflow_id TEXT,branchid INTEGER,actor_id INTEGER,action TEXT,details TEXT,created_at TEXT);
     `);
     await fixture.db('pharmacy_inventory_items').insert([{ id: 'medicine', branchid: 2 }, { id: 'foreign', branchid: 9 }]);
     await fixture.db('pharmacy_accounting_settings').insert({ branchid: 2, mappings: JSON.stringify({ 'liability:output_tax': 'output-tax' }) });
     await fixture.db('acc_accounts').insert({ account_code: 'output-tax', type: 'liability', is_active: true });
     vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
     const app = express(); app.use(express.json());
     app.use((req, _res, next) => {
          Object.assign(req, { authUser: { tenantId: 17, employeeid: 3, branch: 2, role: String(req.headers['x-test-role'] || 'pharmacy_manager') } }); next();
     });
     app.use('/accounting', pharmacyTaxRouter);
     server = createServer(app);
     await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
     const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test listener did not bind');
     url = `http://127.0.0.1:${address.port}/accounting`;
});
afterEach(async () => {
     await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     await fixture.db.destroy();
});
const input = () => ({ itemId: 'medicine', rate: 20, localAccount: 'liability:output_tax', effectiveDate: new Date().toISOString().slice(0, 10), reason: 'Approved inclusive tax policy', idempotencyKey: 'tax-rule-request' });
const save = (body: object, role = 'pharmacy_manager') => fetch(`${url}/tax/rules?branchid=9&tenantId=99`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: JSON.stringify(body) });
describe('pharmacy tax policy API', () => {
     it('creates an audited immutable policy in the authenticated branch and replays the same request once', async () => {
          const body = input(), first = await save(body), second = await save(body);
          expect(first.status).toBe(200); expect(second.status).toBe(200);
          expect(await first.json()).toEqual(await second.json());
          expect(await fixture.db('pharmacy_tax_rules')).toMatchObject([{ branchid: 2, item_id: 'medicine', rate: 20 }]);
          expect(await fixture.db('pharmacy_enterprise_events')).toHaveLength(1);
          expect(vi.mocked(KnexConnection)).toHaveBeenCalledWith(17);
          const changed = await save({ ...body, rate: 10 });
          expect(changed.status).toBe(400);
     });
     it.each(['pharmacy_cashier', 'pharmacist', 'accountant'])('denies %s financial access', async role => {
          const response = await fetch(`${url}/tax`, { headers: { 'x-test-role': role } });
          expect(response.status).toBe(403);
     });
     it('allows accountants to read but not configure approved rates', async () => {
          expect((await fetch(`${url}/tax`, { headers: { 'x-test-role': 'pharmacy_accountant' } })).status).toBe(200);
          expect((await save(input(), 'pharmacy_accountant')).status).toBe(403);
     });
     it('rejects foreign medicines, missing mapping, backdating and invalid rates without recording success', async () => {
          for (const body of [{ ...input(), itemId: 'foreign' }, { ...input(), localAccount: 'liability:unmapped' }, { ...input(), effectiveDate: '2000-01-01' }, { ...input(), rate: '20' }, { ...input(), rate: 100.01 }]) {
               expect((await save(body)).status).toBe(400);
          }
          expect(await fixture.db('pharmacy_tax_rules')).toHaveLength(0);
          expect(await fixture.db('pharmacy_enterprise_requests')).toHaveLength(0);
     });
     it('returns the full date-filtered register without foreign branch records', async () => {
          const row = { id: 'event', branchid: 2, sale_id: 'sale', sale_line_id: 'line', rule_id: 'rule', event_type: 'sale', financial_date: '2026-10-01', gross_amount: 120, net_amount: 100, tax_amount: 20, rate: 20, local_account: 'liability:output_tax' };
          await fixture.db('pharmacy_tax_events').insert([row, { ...row, id: 'foreign', sale_line_id: 'other-line', branchid: 9 }]);
          const response = await fetch(`${url}/tax?from=2026-10-01&to=2026-10-31&branchid=9`);
          expect(response.status).toBe(200);
          const body = await response.json(); expect(body.data.total).toBe(1); expect(body.data.transactions).toMatchObject([{ id: 'event', branchid: 2 }]);
     });
});
