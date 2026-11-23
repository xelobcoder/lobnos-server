import { describe, expect, it, vi } from 'vitest';
import { InstrumentMaintenanceController, requireMaintenanceSupervisor } from './InstrumentMaintenanceController';

describe('maintenance authority', () => {
     const response = () => {
          const res: any = { status: vi.fn(), json: vi.fn() };
          res.status.mockReturnValue(res);
          return res;
     };
     it('requires an authenticated supervisor in the requested tenant for schedule changes', () => {
          const next = vi.fn();
          const res = response();
          requireMaintenanceSupervisor({ query: { tenantId: '4' } } as any, res, next);
          expect(res.status).toHaveBeenCalledWith(401);
          requireMaintenanceSupervisor({ query: { tenantId: '4' }, authUser: { tenantId: 4, role: 'scientist' } } as any, res, next);
          expect(res.status).toHaveBeenCalledWith(403);
          requireMaintenanceSupervisor({ query: { tenantId: '5' }, authUser: { tenantId: 4, role: 'admin' } } as any, res, next);
          expect(next).not.toHaveBeenCalled();
          requireMaintenanceSupervisor({ query: { tenantId: '4' }, authUser: { tenantId: 4, role: 'manager' } } as any, res, next);
          expect(next).toHaveBeenCalledOnce();
     });
     it('rejects a task completion using a different tenant before touching the database', async () => {
          const res = response();
          await new InstrumentMaintenanceController().completeTask({
               query: { tenantId: '5' }, authUser: { tenantId: 4, employeeid: 7 }, params: { taskId: '1' },
          } as any, res);
          expect(res.status).toHaveBeenCalledWith(403);
     });
});
