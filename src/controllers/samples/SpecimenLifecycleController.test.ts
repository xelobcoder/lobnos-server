import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authority', () => ({ getAuthUser: (request: any) => request.authUser || null }));

import { SpecimenLifecycleController } from './SpecimenLifecycleController';
import { SpecimenLifecycleError, SpecimenLifecycleService } from '../../models/samples/SpecimenLifecycleService';

function request(overrides: Record<string, any> = {}): any {
     return {
          authUser: { tenantId: 42, employeeid: 7, role: 'scientist' },
          query: { tenantId: '42' }, params: { id: '10' },
          body: { expectedVersion: 1, employeeid: 999, tenantId: 666 },
          ...overrides,
     };
}

function response(): any {
     return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

beforeEach(() => vi.restoreAllMocks());

describe('specimen lifecycle authorization', () => {
     it.each(['patient', 'clinician', 'organization', 'outsourced', 'receptionist'])('rejects %s access before querying specimens', async role => {
          const worklist = vi.spyOn(SpecimenLifecycleService.prototype, 'worklist').mockResolvedValue({ items: [] });
          const res = response();
          await SpecimenLifecycleController.worklist(request({ authUser: { tenantId: 42, employeeid: 7, role } }), res);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(worklist).not.toHaveBeenCalled();
     });

     it.each([
          { authUser: null },
          { authUser: { tenantId: 43, employeeid: 7, role: 'admin' } },
          { query: {} },
     ])('requires an authenticated session for the requested facility (%j)', async overrides => {
          const worklist = vi.spyOn(SpecimenLifecycleService.prototype, 'worklist').mockResolvedValue({ items: [] });
          const res = response();
          await SpecimenLifecycleController.worklist(request(overrides), res);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(worklist).not.toHaveBeenCalled();
     });

     it('takes the aliquot actor and tenant exclusively from authentication', async () => {
          let actualTenant: number | undefined;
          const aliquot = vi.spyOn(SpecimenLifecycleService.prototype, 'aliquot').mockImplementation(async function (this: any) {
               actualTenant = this.tenantId;
               return { sample: { id: 10, status: 'accepted', storage_state: 'available', quantity: '1.00' } };
          });
          const req = request();
          const res = response();
          await SpecimenLifecycleController.aliquot(req, res);
          expect(aliquot).toHaveBeenCalledWith(10, req.body, 7);
          expect(actualTenant).toBe(42);
          expect(res.status).toHaveBeenCalledWith(201);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
     });

     it('lets collection staff store a sample while protecting scientific operations', async () => {
          const req = request({ authUser: { tenantId: 42, employeeid: 7, role: 'phlebotomist' } });
          const store = vi.spyOn(SpecimenLifecycleService.prototype, 'store').mockResolvedValue({ sample: { id: 10, status: 'accepted', storage_state: 'stored', storage_position_id: 1 } });
          const res = response();
          await SpecimenLifecycleController.store(req, res);
          expect(store).toHaveBeenCalledWith(10, req.body, 7);
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json.mock.calls[0][0].data.capabilities).toMatchObject({ canRetrieve: true, canAliquot: false, canSetRetention: false, canDispose: false });

          const dispose = vi.spyOn(SpecimenLifecycleService.prototype, 'dispose').mockResolvedValue({});
          const rejected = response();
          await SpecimenLifecycleController.dispose(req, rejected);
          expect(rejected.status).toHaveBeenCalledWith(403);
          expect(dispose).not.toHaveBeenCalled();
     });

     it.each(['scientist', 'phlebotomist'])('does not allow %s to create storage positions', async role => {
          const createPosition = vi.spyOn(SpecimenLifecycleService.prototype, 'createPosition').mockResolvedValue({ id: 1 });
          const res = response();
          await SpecimenLifecycleController.createPosition(request({ authUser: { tenantId: 42, employeeid: 7, role } }), res);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(createPosition).not.toHaveBeenCalled();
     });

     it.each([
          ['scientist', false], ['admin', true], ['manager', true], ['super_admin', true],
     ])('derives early-disposal authority from authenticated %s role', async (role, allowed) => {
          const dispose = vi.spyOn(SpecimenLifecycleService.prototype, 'dispose').mockResolvedValue({});
          const req = request({
               authUser: { tenantId: 42, employeeid: 7, role },
               body: { expectedVersion: 1, overrideRetention: true, canOverrideRetention: true, role: 'admin', employeeid: 999 },
          });
          const res = response();
          await SpecimenLifecycleController.dispose(req, res);
          expect(dispose).toHaveBeenCalledWith(10, req.body, 7, allowed);
          expect(res.status).toHaveBeenCalledWith(200);
     });

     it.each([
          ['scientist', false], ['admin', true], ['manager', true], ['super_admin', true],
     ])('derives retention-shortening authority from authenticated %s role', async (role, allowed) => {
          const setRetention = vi.spyOn(SpecimenLifecycleService.prototype, 'setRetention').mockResolvedValue({});
          const req = request({
               authUser: { tenantId: 42, employeeid: 7, role },
               body: { expectedVersion: 1, retentionDays: 1, reason: 'Policy correction', canShortenRetention: true, role: 'admin' },
          });
          const res = response();
          await SpecimenLifecycleController.retention(req, res);
          expect(setRetention).toHaveBeenCalledWith(10, req.body, 7, allowed);
          expect(res.status).toHaveBeenCalledWith(200);
     });
});

describe('specimen lifecycle error responses', () => {
     it('preserves a stale-version conflict for the frontend to reload', async () => {
          vi.spyOn(SpecimenLifecycleService.prototype, 'store').mockRejectedValue(new SpecimenLifecycleError('Specimen was changed; reload', 409));
          const res = response();
          await SpecimenLifecycleController.store(request(), res);
          expect(res.status).toHaveBeenCalledWith(409);
          expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Specimen was changed; reload' });
     });

     it('maps uniqueness races to a conflict without exposing database details', async () => {
          vi.spyOn(SpecimenLifecycleService.prototype, 'store').mockRejectedValue(Object.assign(new Error('SQL duplicate internal connection details'), { code: 'ER_DUP_ENTRY' }));
          const res = response();
          await SpecimenLifecycleController.store(request(), res);
          expect(res.status).toHaveBeenCalledWith(409);
          expect(res.json.mock.calls[0][0].message).not.toContain('SQL');
     });

     it('does not expose unexpected internal errors to the caller', async () => {
          vi.spyOn(SpecimenLifecycleService.prototype, 'store').mockRejectedValue(new Error('Database password or connection details'));
          const res = response();
          await SpecimenLifecycleController.store(request(), res);
          expect(res.status).toHaveBeenCalledWith(500);
          expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unable to complete specimen operation' });
     });
});
