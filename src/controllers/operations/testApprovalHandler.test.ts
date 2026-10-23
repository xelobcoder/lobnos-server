import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), allowed: vi.fn(), connection: vi.fn(), details: vi.fn(), staff: vi.fn(), approve: vi.fn() }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: mocks.actor }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../models/application/appsettings/result-settings/resultSettings', () => ({ default: { canStaffApproveResult: mocks.allowed } }));
vi.mock('../../models/application/in-app-notifications/InAppNotificationService', () => ({ InAppNotificationService: { publish: vi.fn().mockResolvedValue(1) } }));
vi.mock('../../hooks/helper', () => ({ customError: vi.fn(), responseError: vi.fn() }));
vi.mock('../../models/operations/testApprovalClass', () => ({ TestApprovalClass: class { getAscensionApprovedDetail = mocks.details; getAscensionAprovedListDetails = mocks.staff; static updateTestApprovalStatus = mocks.approve; } }));
import { getAscensionApprovalDetailsHandler, updateAscensionApprovalDetailsHandler } from './testApprovalHandler';
const actor = { employeeid: 7, role: 'scientist', tenantId: 1, branch: 4 };
function response() { const res: any = {}; res.status = vi.fn(() => res); res.json = vi.fn(() => res); res.send = vi.fn(() => res); return res; }
beforeEach(() => {
 vi.clearAllMocks(); mocks.actor.mockReturnValue(actor); mocks.allowed.mockResolvedValue(true);
 const query: any = { join() { return query; }, where() { return query; }, select() { return query; }, first: vi.fn().mockResolvedValue({ branchid: 4 }) };
 mocks.connection.mockResolvedValue(() => query); mocks.details.mockResolvedValue({ approval_revision: 6, requires_revalidation: 1, isapproved: 0 }); mocks.staff.mockResolvedValue([]);
});
describe('result validation revision API', () => {
 it('returns the signed-in tenant revision before loading validators', async () => {
  const res = response(); await getAscensionApprovalDetailsHandler({ query: { ascensionid: '1', tenantId: '99' } } as any, res);
  expect(mocks.connection).toHaveBeenCalledWith(1);
  expect(res.json).toHaveBeenCalledWith({ staff: [], approval_revision: 6, requires_revalidation: true });
  expect(mocks.details.mock.invocationCallOrder[0]).toBeLessThan(mocks.staff.mock.invocationCallOrder[0]);
 });
 it('submits the reviewed revision using canonical actor identity', async () => {
  const res = response(); mocks.approve.mockResolvedValue(true);
  await updateAscensionApprovalDetailsHandler({ query: { ascensionid: '1', tenantId: '99' }, body: { approval_revision: 6, employeeid: 99 } } as any, res);
  expect(mocks.approve).toHaveBeenCalledWith(1, 7, 1, 4, 6);
 });
 it('returns a stale result conflict without reporting successful validation', async () => {
  const res = response(); mocks.approve.mockRejectedValue(Object.assign(new Error('Reload the amended result'), { statusCode: 409 }));
  await updateAscensionApprovalDetailsHandler({ query: { ascensionid: '1', tenantId: '1' }, body: { approval_revision: 5 } } as any, res);
  expect(res.status).toHaveBeenCalledWith(409); expect(res.json).toHaveBeenCalledWith({ status: false, message: 'Reload the amended result' });
  expect(res.send).not.toHaveBeenCalled();
 });
});
