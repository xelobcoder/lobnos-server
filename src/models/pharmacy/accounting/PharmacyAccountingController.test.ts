import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../PharmacyAccountingBridge', () => ({ synchronizePharmacyJournal: vi.fn() }));
import express from 'express';
import { createServer, request, Server } from 'http';
import { AddressInfo } from 'net';
import KnexConnection from '../../../database/KnexConnections';
import { allocationFixture, ctx, firstDate, allocationDate, releaseDate } from './testSupport/fixture';
import { PharmacyAccountingSubledgers } from './PharmacyAccountingSubledgers';
import { pharmacyAccountingContext, pharmacyAccountingFailure, pharmacyAccountingRouter } from '../../../controllers/pharmacy/PharmacyAccountingController';
import { PharmacyAccountingError } from './PharmacyAccountingCore';
const response = () => { const r: any = {}; r.status = vi.fn(() => r); r.json = vi.fn(() => r); return r; };
describe('Pharmacy accounting HTTP boundary', () => {
     it('derives tenant, branch and employee only from authenticated context', () => {
          const req: any = { authUser: { tenantId: 1, branch: 2, employeeid: 3, role: 'pharmacy_accountant' }, body: { tenantId: 99, branch: 99, actor: 99 }, query: { tenantId: 99, branch: 99 } };
          expect(pharmacyAccountingContext(req)).toEqual({ tenantId: 1, branch: 2, actor: 3, role: 'pharmacy_accountant' });
          req.authUser.branch = null; expect(() => pharmacyAccountingContext(req)).toThrow('branch');
     });

     describe('Pharmacy accounting actual HTTP + isolated SQL', () => {
          let fixture: Awaited<ReturnType<typeof allocationFixture>>, server: Server, port: number;
          beforeEach(async () => {
               fixture = await allocationFixture();
               vi.mocked(KnexConnection).mockResolvedValue(fixture.db as any);
               const app = express(); app.use(express.json());
               app.use((req, _res, next) => {
                    (req as any).authUser = { tenantId: 1, branch: Number(req.headers['x-test-branch'] || 2), employeeid: Number(req.headers['x-test-actor'] || 3), role: req.headers['x-test-role'] || 'pharmacy_accountant' }; next();
               });
               app.use('/accounting', pharmacyAccountingRouter);
               server = createServer(app);
               await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
               port = (server.address() as AddressInfo).port;
          });
          afterEach(async () => {
               if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
               await fixture?.db.destroy();
          });
          const http = (method: string, path: string, body?: any, actor = 3, branch = 2, role = 'pharmacy_accountant'): Promise<any> => new Promise((resolve, reject) => {
               const req = request({ host: '127.0.0.1', port, path: '/accounting' + path, method, headers: { 'Content-Type': 'application/json', 'x-test-actor': actor, 'x-test-branch': branch, 'x-test-role': role } }, res => {
                    let data = ''; res.on('data', c => { data += c; }); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch (e) { reject(e); } });
               });
               req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
          });
          const reviewed = async (root: string, id: string) => {
               expect((await http('POST', `${root}/${id}/submit`, { idempotencyKey: 'http-submit:' + id, expectedVersion: 1 })).status).toBe(200);
               expect((await http('POST', `${root}/${id}/approve`, { idempotencyKey: 'http-self:' + id, expectedVersion: 2 })).status).toBe(403);
               expect((await http('POST', `${root}/${id}/approve`, { idempotencyKey: 'http-approve:' + id, expectedVersion: 2 }, 4)).status).toBe(200);
          };
          it('serves reviewed payment applications/releases with exact response shapes and no duplicate financial posting', async () => {
               const bill = await fixture.bill(); await fixture.payment();
               const before = await fixture.db('pharmacy_journal_lines').orderBy('id');
               const candidates = await http('GET', '/payables/allocation-sources/candidates?sourceKind=payment');
               expect(candidates.body.data.items[0].sourceRef).toBe('legacy-payment');
               const sourceResponse = await http('POST', '/payables/allocation-sources', { idempotencyKey: 'http-source-register', sourceKind: 'payment', sourceRef: 'legacy-payment', branch: 99, actor: 99 });
               expect(sourceResponse.status).toBe(201);
               const source = sourceResponse.body.data;
               const creation = await http('POST', '/payables/allocations', { idempotencyKey: 'http-allocation-create', sourceId: source.id, date: allocationDate, reason: 'Reviewed actual original bank payment', allocations: [{ billId: bill.id, amount: '40.01' }] });
               expect(creation).toMatchObject({ status: 201, body: { success: true, data: { status: 'draft', version: 1, amount: '40.01' } } });
               const id = creation.body.data.id; await reviewed('/payables/allocations', id);
               const input = { idempotencyKey: 'http-allocation-post', expectedVersion: 3 };
               expect((await http('POST', `/payables/allocations/${id}/post`, input)).body.data.status).toBe('posted');
               expect((await http('POST', `/payables/allocations/${id}/post`, input)).status).toBe(200);
               expect((await http('GET', `/payables/allocations/${id}`)).body.data.details.sourceId).toBe(source.id);
               expect((await http('GET', `/payables/allocations/${id}`, undefined, 3, 9)).status).toBe(404);
               expect((await http('GET', '/payables/aging?asOf=' + allocationDate)).body.data.reconciliation.reconciled).toBe(true);
               const r = await http('POST', `/payables/allocations/${id}/reversals`, { idempotencyKey: 'http-release-create', date: releaseDate, reason: 'Reviewed reassignment of original source' });
               expect(r.status).toBe(201); const reverseId = r.body.data.id;
               await reviewed('/payables/allocation-reversals', reverseId);
               expect((await http('POST', `/payables/allocation-reversals/${reverseId}/post`, { idempotencyKey: 'http-release-post', expectedVersion: 3 })).body.data.status).toBe('posted');
               const evidence = await http('GET', `/payables/allocation-reversals/${reverseId}`);
               expect(evidence.body.data.sourceUses[0]).toMatchObject({ amount: '-40.01', bill_id: bill.id, source_id: source.id });
               expect((await http('GET', '/payables/allocation-sources')).body.data.items[0].availableAmount).toBe('40.01');
               expect(await fixture.db('pharmacy_journal_lines').orderBy('id')).toEqual(before);
          });
          it('does not shadow reversal replacements and requires fresh independent review over HTTP', async () => {
               const bill = await fixture.bill(), s = new PharmacyAccountingSubledgers(fixture.db, ctx);
               const settlement = await s.createSettlement({ idempotencyKey: 'http-settlement-create', date: firstDate, description: 'Original approved supplier settlement', allocations: [{ billId: bill.id, amount: '40.01' }] });
               await s.settlementAction(settlement.id, 'submit', { idempotencyKey: 'http-settlement-submit', expectedVersion: 1 });
               await new PharmacyAccountingSubledgers(fixture.db, { ...ctx, actor: 4 }).settlementAction(settlement.id, 'approve', { idempotencyKey: 'http-settlement-approve', expectedVersion: 2 });
               await s.settlementAction(settlement.id, 'pay', { idempotencyKey: 'http-settlement-pay', expectedVersion: 3, method: 'card', reference: 'BANK-HTTP-SETTLEMENT' });
               const original = await http('POST', `/payables/settlements/${settlement.id}/reversals`, { idempotencyKey: 'http-reversal-initial', date: allocationDate, reason: 'Initial reviewed reversal request' });
               expect(original.status).toBe(201); const oldId = original.body.data.id;
               await http('POST', `/payables/settlement-reversals/${oldId}/void`, { idempotencyKey: 'http-reversal-void', expectedVersion: 1, reason: 'Incomplete return evidence' });
               const payload = { idempotencyKey: 'http-reversal-replace', expectedVersion: 2, date: allocationDate, reason: 'Replacement with corrected evidence' };
               expect((await http('POST', `/payables/settlement-reversals/${oldId}/replacements`, { ...payload, expectedVersion: 1 })).status).toBe(409);
               const replacement = await http('POST', `/payables/settlement-reversals/${oldId}/replacements`, payload);
               expect(replacement).toMatchObject({ status: 201, body: { success: true, data: { replacesIntentId: oldId, originalDocumentId: settlement.id, status: 'draft', version: 1 } } });
               const newId = replacement.body.data.id;
               await reviewed('/payables/settlement-reversals', newId);
               const posted = await http('POST', `/payables/settlement-reversals/${newId}/post`, { idempotencyKey: 'http-reversal-post', expectedVersion: 3, confirmedReceived: true, reference: 'BANK-HTTP-RETURN' });
               expect(posted.status).toBe(200);
               expect((await fixture.db('pharmacy_accounting_documents').where({ id: oldId }).first()).reversal_of).toBe(settlement.id);
          });
          it('keeps bounded finance APIs behind the finance gate and rejects cross-branch sources and changed idempotency payloads', async () => {
               await fixture.bill(); await fixture.payment(); const source = await fixture.register();
               const unauthorized = await http('GET', '/payables/allocation-sources', undefined, 3, 2, 'pharmacy_cashier');
               expect(unauthorized.status).toBe(403);
               const wrongBranch = await http('POST', '/payables/allocation-sources', { idempotencyKey: 'http-foreign-source', sourceKind: 'payment', sourceRef: 'legacy-payment' }, 3, 9);
               expect(wrongBranch.status).toBe(404);
               const body = { idempotencyKey: 'http-reused-source', sourceKind: 'payment', sourceRef: 'missing-source' };
               const first = await http('POST', '/payables/allocation-sources', body);
               expect(first.status).toBe(404);
               expect((await http('GET', '/payables/allocation-sources?limit=999')).status).toBe(400);
               const bill = await fixture.db('pharmacy_accounting_bills').first();
               const payload = { idempotencyKey: 'http-allocation-replay', sourceId: source.id, date: allocationDate, reason: 'Reviewed allocation request', allocations: [{ billId: bill.id, amount: '10.00' }] };
               expect((await http('POST', '/payables/allocations', payload)).status).toBe(201);
               const conflict = await http('POST', '/payables/allocations', { ...payload, allocations: [{ billId: bill.id, amount: '11.00' }] });
               expect(conflict).toMatchObject({ status: 409, body: { success: false, error: { code: 'IDEMPOTENCY_CONFLICT' } } });
          });
     });
     it('runs its own finance gate before every route', () => {
          const gate = pharmacyAccountingRouter.stack[0].handle;
          const res = response(), next = vi.fn();
          gate({ authUser: { role: 'pharmacy_cashier' } } as any, res, next);
          expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
          gate({ authUser: { role: 'pharmacy_accountant' } } as any, response(), next); expect(next).toHaveBeenCalledOnce();
     });
     it('never exposes internal database or provider errors', () => {
          const res = response();
          pharmacyAccountingFailure(res, new Error('select payment_secret from private_table; password=secret'));
          expect(res.status).toHaveBeenCalledWith(500);
          expect(JSON.stringify(res.json.mock.calls)).not.toContain('payment_secret');
          expect(JSON.stringify(res.json.mock.calls)).not.toContain('password');
     });
     it('returns explicit domain conflicts without losing their code', () => {
          const res = response();
          pharmacyAccountingFailure(res, new PharmacyAccountingError('Request differs', 'IDEMPOTENCY_CONFLICT', 409));
          expect(res.status).toHaveBeenCalledWith(409);
          expect(res.json).toHaveBeenCalledWith({ success: false, error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Request differs' } });
     });
     it('does not shadow attachment/refund creation with generic expense actions', () => {
          const generic: any = pharmacyAccountingRouter.stack.find((layer: any) => layer.route?.path === '/expenses/:id/:action(submit|approve|pay|reverse|void)');
          expect(generic.match('/expenses/expense-id/attachments')).toBe(false);
          expect(generic.match('/expenses/expense-id/refunds')).toBe(false);
          expect(generic.match('/expenses/expense-id/approve')).toBe(true);
     });
     it('does not shadow reviewed reversal creation with original document actions', () => {
          const ap: any = pharmacyAccountingRouter.stack.find((layer: any) => layer.route?.path === '/payables/settlements/:id/:action(submit|approve|pay|void)');
          const ar: any = pharmacyAccountingRouter.stack.find((layer: any) => layer.route?.path === '/receivables/adjustments/:id/:action(submit|approve|post|void)');
          expect(ap.match('/payables/settlements/original-id/reversals')).toBe(false);
          expect(ar.match('/receivables/adjustments/original-id/reversals')).toBe(false);
          expect(ap.match('/payables/settlements/original-id/pay')).toBe(true);
          expect(ar.match('/receivables/adjustments/original-id/post')).toBe(true);
     });
});
