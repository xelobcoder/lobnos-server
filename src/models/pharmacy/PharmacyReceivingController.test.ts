import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import express, { Request } from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { pharmacyReceivingRouter } from '../../controllers/pharmacy/PharmacyReceivingController';
import { PharmacyReceiving } from './PharmacyReceiving';
import { allocationFixture } from './accounting/testSupport/fixture';

describe('pharmacy receiving HTTP and retry boundary', () => {
     let fixture: Awaited<ReturnType<typeof allocationFixture>>, server: Server, url: string;
     beforeEach(async () => {
          fixture = await allocationFixture();
          vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
          const app = express(); app.use(express.json());
          app.use((req, _res, next) => {
               (req as Request & { authUser: AuthUser }).authUser = { tenantId: 1, branch: 2, employeeid: 3, email: 'test@example.invalid', role: String(req.headers['x-test-role'] || 'pharmacy_manager') };
               next();
          });
          app.use('/receiving', pharmacyReceivingRouter); server = createServer(app);
          await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
          url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/receiving`;
     });
     afterEach(async () => {
          vi.restoreAllMocks();
          if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
          await fixture?.db.destroy();
     });
     const post = (path: string, role = 'pharmacy_manager') => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: JSON.stringify({ idempotencyKey: 'http-receiving-test', tenantId: 999, branch: 999 }) });
     it('loads an individual delivery using authenticated stock access and branch context', async () => {
          const delivery = vi.spyOn(PharmacyReceiving.prototype, 'delivery').mockResolvedValue({ id: 'old-delivery', details: { orderId: 'original-order' } });
          const response = await fetch(url + '/deliveries/old-delivery?tenantId=999&branch=999', { headers: { 'x-test-role': 'pharmacy_storekeeper' } });
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({ success: true, data: { id: 'old-delivery' } });
          expect(delivery).toHaveBeenLastCalledWith('old-delivery');
          expect(delivery.mock.instances[0]).toMatchObject({ branch: 2, user: { tenantId: 1 } });
          delivery.mockClear();
          expect((await fetch(url + '/deliveries/old-delivery', { headers: { 'x-test-role': 'pharmacy_accountant' } })).status).toBe(403);
          expect(delivery).not.toHaveBeenCalled();
     });
     it('opens older receipts outside the latest 200 and rejects foreign-branch or wrong-kind ids', async () => {
          await fixture.db('pharmacy_workflows').insert([
               { id: 'old', branchid: 2, kind: 'goods_delivery', created_at: '2020-01-01', details: JSON.stringify({ reference: 'OLD', orderId: 'original-order' }) },
               { id: 'foreign', branchid: 3, kind: 'goods_delivery', created_at: '2020-01-01', details: '{}' },
               { id: 'wrong-kind', branchid: 2, kind: 'purchase_request', created_at: '2020-01-01', details: '{}' },
               ...Array.from({ length: 201 }, (_, i) => ({ id: `new-${i}`, branchid: 2, kind: 'goods_delivery', created_at: '2026-01-01', details: '{}' })),
          ]);
          const listed = await (await fetch(url + '/deliveries')).json();
          expect(listed.data).toHaveLength(200);
          expect(listed.data.some((row: { id: string }) => row.id === 'old')).toBe(false);
          const response = await fetch(url + '/deliveries/old');
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({ success: true, data: { id: 'old', details: { orderId: 'original-order', reference: 'OLD' } } });
          for (const id of ['foreign', 'wrong-kind', 'missing']) {
               const rejected = await fetch(url + `/deliveries/${id}`);
               expect(rejected.status).toBe(400);
               expect(await rejected.json()).toMatchObject({ success: false });
          }
     });
     it('marks confirmed validation rejection so the client can correct an uncommitted request', async () => {
          vi.spyOn(PharmacyReceiving.prototype, 'record').mockRejectedValue(new Error('Choose a supplier'));
          const response = await post('/deliveries?tenantId=999');
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({ success: false, error: { code: 'PHARMACY_OPERATION_REJECTED', message: 'Choose a supplier' } });
          expect(KnexConnection).toHaveBeenLastCalledWith(1);
     });
     it('preserves the original retry after an uncertain database outcome without exposing SQL', async () => {
          vi.spyOn(PharmacyReceiving.prototype, 'record').mockRejectedValue(Object.assign(new Error('private database details'), { code: 'ECONNRESET' }));
          const response = await post('/deliveries');
          expect(response.status).toBe(503);
          expect(await response.json()).toEqual({ success: false, error: { code: 'PHARMACY_OPERATION_UNCONFIRMED', message: 'The operation could not be confirmed. Retry the original request.' } });
     });
     it('allows stock recording but rejects manager-only actions and finance-only stock access', async () => {
          const record = vi.spyOn(PharmacyReceiving.prototype, 'record');
          for (const path of ['/policy', '/invoices', '/deliveries/test/return']) expect((await post(path, 'pharmacy_storekeeper')).status).toBe(403);
          expect((await post('/deliveries', 'pharmacy_accountant')).status).toBe(403);
          expect(record).not.toHaveBeenCalled();
          const invoices = await fetch(url + '/invoices', { headers: { 'x-test-role': 'pharmacy_accountant' } });
          expect(invoices.status).toBe(200);
          expect(await invoices.json()).toEqual({ success: true, data: [] });
     });
     it('finishes receiving using authenticated scope and forbids storekeeper invoice posting in the combined route', async () => {
          const finish = vi.spyOn(PharmacyReceiving.prototype, 'finish').mockResolvedValue({ id: 'delivery-original', invoice: null });
          expect((await post('/deliveries/delivery-original/finish', 'pharmacy_storekeeper')).status).toBe(200);
          expect(finish).toHaveBeenLastCalledWith('delivery-original', expect.objectContaining({ idempotencyKey: 'http-receiving-test' }));
          expect(finish.mock.instances[0]).toMatchObject({ branch: 2, actor: 3, user: { tenantId: 1 } });
          finish.mockClear();
          const response = await fetch(url + '/deliveries/delivery-original/finish', { method: 'POST',
               headers: { 'Content-Type': 'application/json', 'x-test-role': 'pharmacy_storekeeper' },
               body: JSON.stringify({ invoice: { reference: 'INV-ATTEMPT', invoiceDate: new Date().toISOString().slice(0, 10) } }) });
          expect(response.status).toBe(403); expect(finish).not.toHaveBeenCalled();
     });
     it('receives stock in one request with authenticated scope and preserves invoice authority', async () => {
          const receive = vi.spyOn(PharmacyReceiving.prototype, 'receive').mockResolvedValue({ id: 'delivery', acceptedQuantity: 10, heldQuantity: 0 });
          expect((await post('/receive', 'pharmacy_storekeeper')).status).toBe(200);
          expect(receive.mock.instances[0]).toMatchObject({ branch: 2, actor: 3, user: { tenantId: 1 } });
          receive.mockClear();
          const response = await fetch(url + '/receive', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'pharmacy_storekeeper' },
               body: JSON.stringify({ invoice: { reference: 'INV-ATTEMPT', invoiceDate: new Date().toISOString().slice(0, 10) } }) });
          expect(response.status).toBe(403);
          expect(receive).not.toHaveBeenCalled();
          expect((await post('/receive', 'pharmacy_accountant')).status).toBe(403);
     });
     it('routes unsaved receipt previews to the same receiving cost calculation', async () => {
          const preview = vi.spyOn(PharmacyReceiving.prototype, 'previewReceivePrice').mockResolvedValue({ method: 'manual', value: 5, cost: 2, price: 5, margin: 60, increment: .01 });
          const response = await fetch(url + '/prices/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ receipt: { supplierId: 'supplier', lines: [] }, itemId: 'drug', method: 'manual', value: 5 }) });
          expect(response.status).toBe(200);
          expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ receipt: { supplierId: 'supplier', lines: [] }, itemId: 'drug' }));
     });
     it('rejects malformed or unsupported combined invoice adjustments explicitly', async () => {
          for (const invoice of [false, [], { reference: 'INV-INVALID', invoiceDate: '2026-11-02', extraTax: 20 }]) {
               const response = await fetch(url + '/deliveries/delivery-original/finish', { method: 'POST',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice }) });
               expect(response.status).toBe(400);
               expect(await response.json()).toMatchObject({ success: false, error: { code: 'PHARMACY_OPERATION_REJECTED', message: expect.stringContaining('detailed invoice form') } });
          }
     });
});
