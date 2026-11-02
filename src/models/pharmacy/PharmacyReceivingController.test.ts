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
});
