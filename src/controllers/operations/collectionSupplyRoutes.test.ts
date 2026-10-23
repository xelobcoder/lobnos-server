import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
const mocks = vi.hoisted(() => ({ consume: vi.fn().mockResolvedValue({ transactions: [], retried: false }) }));
vi.mock('../../models/operations/LabWorkbenchService', () => ({ LabWorkbenchService: class { consumeCollectionSupplies = mocks.consume; } }));
import router from './collectionSupplyRoutes';

async function request(actor: any, tenant = 1) {
     const app = express();
     app.use(express.json());
     app.use((req, _res, next) => { (req as any).authUser = actor; next(); });
     app.use('/supplies', router);
     const server = app.listen(0, '127.0.0.1');
     await once(server, 'listening');
     try {
          const address = server.address() as any;
          const response = await fetch(`http://127.0.0.1:${address.port}/supplies/10?tenantId=${tenant}`, {
               method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeid: 999, reason: 'Collection' }),
          });
          return response.status;
     } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
describe('collection supply authorization', () => {
     it.each(['phelobotomist', 'phlebotomist'])('allows %s and supplies the signed-in actor', async role => {
          const actor = { employeeid: 7, tenantId: 1, branch: 4, role };
          expect(await request(actor)).toBe(200);
          expect(mocks.consume).toHaveBeenLastCalledWith(actor, 10, expect.objectContaining({ employeeid: 999 }));
     });
     it('rejects unauthenticated, portal and unrelated staff sessions', async () => {
          expect(await request(null)).toBe(401);
          for (const role of ['patient', 'clinician', 'receptionist']) expect(await request({ role, employeeid: 7, tenantId: 1 })).toBe(403);
     });
     it('rejects another tenant even for a permitted staff role', async () => {
          expect(await request({ role: 'phlebotomist', employeeid: 7, tenantId: 1 }, 2)).toBe(403);
     });
});
