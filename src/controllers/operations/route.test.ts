import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';

vi.mock('../../models/operations/testApprovalClass', () => ({ TestApprovalClass: class {} }));

vi.mock('../../middleware/validateTenancy', () => ({
     checkTokenExists: (_req: any, _res: any, next: any) => next(),
     isAuthorizedRoleScientistPhelobotomist: (_req: any, _res: any, next: any) => next(),
}));
import operationsRouter from './route';

describe('operations middleware scope', () => {
     it.each([null, { role: 'patient', employeeid: 4 }, { role: 'scientist', employeeid: 7 }])(
          'leaves patient-information queries unchanged for session %j', async (actor) => {
               const app = express();
               app.use((req, _res, next) => { (req as any).authUser = actor; next(); });
               app.use(operationsRouter);
               app.get('/api/v1/register/personalinformation', (req, res) => {
                    res.json(req.query);
               });
               const server = app.listen(0, '127.0.0.1');
               await once(server, 'listening');
               try {
                    const address = server.address() as any;
                    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/register/personalinformation?patientid=4&tenantId=309027`);
                    expect(response.status).toBe(200);
                    expect(await response.json()).toEqual({ patientid: '4', tenantId: '309027' });
                    if (!actor || actor.role === 'patient') {
                         for (const path of ['/api/v1/operations/collection', '/api/v1/operations/laboratory/workbench']) {
                              const protectedResponse = await fetch(`http://127.0.0.1:${address.port}${path}`);
                              expect(protectedResponse.status).toBe(actor ? 403 : 401);
                         }
                    }
               } finally {
                    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
               }
          }
     );
});
