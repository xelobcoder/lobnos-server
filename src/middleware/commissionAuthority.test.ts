import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ can: vi.fn(), connect: vi.fn() }));
vi.mock('../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../accountingModule/services/AuthorityService', () => ({ AuthorityService: class { can = mocks.can; }, OWNER_ONLY_ROLES: ['admin'], ACCOUNTING_ROLES: ['admin', 'accountant'] }));
import { bindCommissionActor, commissionAccess } from './commissionAuthority';
const actor = { employeeid: 7, tenantId: 3, branch: 4, role: 'accountant' };
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any);
beforeEach(() => { vi.clearAllMocks(); mocks.can.mockResolvedValue({ allowed: true }); });
describe('commission authority boundary', () => {
     it('binds employee, tenant, branch and audit identity to the session', () => {
          const req: any = { authUser: actor, query: { employeeid: '1', tenantId: '99', branchid: '9' }, body: { employeeId: 1, employeeid: 1, branchid: 9 } }, next = vi.fn();
          bindCommissionActor(req, response(), next);
          expect(req.query).toMatchObject({ employeeid: '7', tenantId: '3', branchid: '4' });
          expect(req.body).toMatchObject({ employeeid: 7, employeeId: 7, branchid: 4, created_by: 7 });
          expect(next).toHaveBeenCalledOnce();
     });
     it('rejects portal users and requests without a session', () => {
          for (const authUser of [null, { ...actor, role: 'clinician' }, { ...actor, role: 'patient' }]) {
               const next = vi.fn(), res = response(); bindCommissionActor({ authUser, query: {} } as any, res, next);
               expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
          }
     });
     it('checks delegated creation authority for payment requests, using session identity', async () => {
          const next = vi.fn();
          await commissionAccess({ authUser: actor, path: '/commission/batch/process-services', method: 'POST' } as any, response(), next);
          expect(mocks.can).toHaveBeenCalledWith(7, 'expense.create', null, 4);
          expect(next).toHaveBeenCalledOnce();
     });
     it('requires facility-wide delegation to modify global commission configuration', async () => {
          mocks.can.mockResolvedValue({ allowed: false });
          const res = response(), next = vi.fn();
          await commissionAccess({ authUser: actor, path: '/configs', method: 'POST' } as any, res, next);
          expect(mocks.can).toHaveBeenCalledWith(7, 'expense.configure', null, null);
          expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
     });
});
