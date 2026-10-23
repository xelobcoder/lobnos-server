import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ approve: vi.fn() }));
vi.mock('../../models/operations/testApprovalClass', () => ({ TestApprovalClass: class {
     static updateTestApprovalStatus = state.approve;
     async getAscensionApprovedDetail() { return { isapproved: 0 }; }
     async getAscensionAprovedListDetails() { return [{ employeeid: 7 }]; }
} }));
vi.mock('../../models/application/in-app-notifications/InAppNotificationService', () => ({ InAppNotificationService: { publish: vi.fn() } }));
import { updateAscensionApprovalDetailsHandler } from './testApprovalHandler';
beforeEach(() => { vi.clearAllMocks(); state.approve.mockResolvedValue(true); });
describe('signed-in result validator', () => {
     it('ignores a forged validator ID and distinguishes recorded approval from finalization', async () => {
          const req: any = { query: { ascensionid: '1', employeeid: '999', tenantId: '1' }, authUser: { employeeid: 7, branch: 4, tenantId: 1 } };
          const res: any = { send: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
          await updateAscensionApprovalDetailsHandler(req, res);
          expect(state.approve).toHaveBeenCalledWith(1, 7, 1, 4);
          expect(res.send).toHaveBeenCalledWith({ status: true, finalized: false, staff: [{ employeeid: 7 }] });
     });
});
