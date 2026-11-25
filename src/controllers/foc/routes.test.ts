import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthUser } from '../../middleware/authority';

const mocks = vi.hoisted(() => ({
     approve: vi.fn(),
     reverse: vi.fn(),
     process: vi.fn(),
     authenticate: vi.fn(),
}));

vi.mock('../../middleware/validateTenancy', () => ({ checkTokenExists: mocks.authenticate }));
vi.mock('../../models/foc/services/StaffFocService', () => ({
     StaffFocService: class {
          approveFocTransaction = mocks.approve;
          reverseFocTransaction = mocks.reverse;
          processFocTransaction = mocks.process;
     },
}));

import router from './routes';
import { StaffFocController } from './StaffFocController';
import { requireAccountingRole } from '../../middleware/authority';

const actor: AuthUser = {
     employeeid: 7, tenantId: 2, role: 'accountant', branch: 1, email: 'accountant@example.test',
};

function response() {
     const res = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
     };
     return res;
}

describe('staff FOC authorization', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.approve.mockResolvedValue(true);
          mocks.reverse.mockResolvedValue(true);
          mocks.process.mockResolvedValue({});
     });

     it('uses the session-based accounting role guard on every privileged FOC route', () => {
          const routes = router.stack.filter(layer => layer.route).map(layer => layer.route);
          for (const { path, handler } of [
               { path: '/api/v1/foc/transactions', handler: StaffFocController.getTransactions },
               { path: '/api/v1/foc/reports/summary', handler: StaffFocController.getSummaryReport },
               { path: '/api/v1/foc/accounts/staff/:employeeid/limit', handler: StaffFocController.updateLimit },
               { path: '/api/v1/foc/transactions/:id/approve', handler: StaffFocController.approveTransaction },
               { path: '/api/v1/foc/transactions/:id/reverse', handler: StaffFocController.reverseTransaction },
          ]) {
               const route = routes.find(item => item.path === path && item.stack.some(layer => layer.handle === handler));
               expect(route).toBeDefined();
               expect(route.stack.map(layer => layer.handle)).toContain(requireAccountingRole);
          }
     });

     it('rejects a non-accounting session even when the request claims an administrator ID', () => {
          const req = {
               authUser: { ...actor, role: 'scientist' },
               query: { tenantId: '2', requesterEmployeeid: '1' },
               body: { approverEmployeeId: 1 },
          } as unknown as Request;
          const res = response();
          const next = vi.fn();
          requireAccountingRole(req, res as unknown as Response, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });

     it('requires a session and permits admin, super-admin and accountant roles', () => {
          const res = response();
          const next = vi.fn();
          requireAccountingRole({ query: {} } as unknown as Request, res as unknown as Response, next);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
          for (const role of ['admin', 'super_admin', 'accountant']) {
               requireAccountingRole({ authUser: { ...actor, role } } as unknown as Request, res as unknown as Response, next);
          }
          expect(next).toHaveBeenCalledTimes(3);
     });

     it('attributes approvals and reversals to the authenticated tenant and employee', async () => {
          const req = {
               authUser: actor,
               query: { tenantId: '99' },
               params: { id: '12' },
               body: { approverEmployeeId: 1, revokerEmployeeId: 1, reason: 'Correction' },
          } as unknown as Request;
          const res = response();
          await StaffFocController.approveTransaction(req, res as unknown as Response);
          await StaffFocController.reverseTransaction(req, res as unknown as Response);
          expect(mocks.approve).toHaveBeenCalledWith(2, 12, 7);
          expect(mocks.reverse).toHaveBeenCalledWith(2, 12, 7, 'Correction');
     });

     it('attributes transaction requests to the authenticated employee rather than requested_by', async () => {
          const req = {
               authUser: actor,
               query: { tenantId: '99' },
               body: { employeeid: 3, patientid: 4, billingid: 5, gross_amount: 10, requested_by: 1 },
          } as unknown as Request;
          const res = response();
          await StaffFocController.processTransaction(req, res as unknown as Response);
          expect(mocks.process).toHaveBeenCalledWith(2, expect.objectContaining({
               employeeid: 3, patientid: 4, billingid: 5, requested_by: 7,
          }));
     });

     it('rejects approval or reversal without an authenticated actor', async () => {
          const req = {
               query: { tenantId: '2' }, params: { id: '12' },
               body: { approverEmployeeId: 1, revokerEmployeeId: 1, reason: 'Correction' },
          } as unknown as Request;
          const res = response();
          await StaffFocController.approveTransaction(req, res as unknown as Response);
          await StaffFocController.reverseTransaction(req, res as unknown as Response);
          expect(res.status).toHaveBeenCalledTimes(2);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(mocks.approve).not.toHaveBeenCalled();
          expect(mocks.reverse).not.toHaveBeenCalled();
     });

     it.each(['12abc', '1.5', '0', '9007199254740992'])('rejects invalid transaction ID %s', async id => {
          const req = {
               authUser: actor, params: { id }, body: { reason: 'Correction' },
          } as unknown as Request;
          const res = response();
          await StaffFocController.approveTransaction(req, res as unknown as Response);
          await StaffFocController.reverseTransaction(req, res as unknown as Response);
          expect(res.status).toHaveBeenCalledTimes(2);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.approve).not.toHaveBeenCalled();
          expect(mocks.reverse).not.toHaveBeenCalled();
     });
});
