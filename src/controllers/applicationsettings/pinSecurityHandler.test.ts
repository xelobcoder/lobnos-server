import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ policy: vi.fn(), updatePolicy: vi.fn(), list: vi.fn(), reset: vi.fn() }));
vi.mock('../../models/security/StaffPinSecurity', async importOriginal => {
     const original = await importOriginal<any>();
     return { ...original, StaffPinSecurity: class {
          policy = mocks.policy; updatePolicy = mocks.updatePolicy; list = mocks.list; reset = mocks.reset;
     } };
});
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, statusCode: number, res: any) => res.status(statusCode).send({ status: 'error', statusCode, message }),
}));
vi.mock('./handler', () => ({
     getApplicationSettings: vi.fn(), getApplicationSettingsBilling: vi.fn(), updateApplicationSettings: vi.fn(),
     updateApplicationBillSettingsHandler: vi.fn(), updateSmsSettings: vi.fn(), getSmsSettings: vi.fn(),
     getEmailPreference: vi.fn(), getGeneralEmailSettings: vi.fn(), updateGeneralEmailSettings: vi.fn(),
     updateEmailPreference: vi.fn(), resultEntrySettingsUpdateHandler: vi.fn(), updateRegistrationFields: vi.fn(),
     getRegistrationSettings: vi.fn(), addTax: vi.fn(), getTax: vi.fn(), resultEntrySettingsHandler: vi.fn(),
     updateTax: vi.fn(), changeTaxStatus: vi.fn(), deleteTax: vi.fn(), getResultSettings: vi.fn(),
     updateResultSettings: vi.fn(), TableFiltering: vi.fn(), columnFiltering: vi.fn(), getCategoryColumns: vi.fn(),
}));

import router from './route';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireOwnerRole } from '../../middleware/authority';
import { getPinSecurityPolicy, listStaffPinSecurity, resetStaffPinAttempts, updatePinSecurityPolicy } from './pinSecurityHandler';
import { StaffPinSecurityError } from '../../models/security/StaffPinSecurity';

const actor = { employeeid: 1, role: 'admin', tenantId: 42, email: 'admin@example.test', branch: 1 };
const response = () => ({ status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const request = () => ({
     authUser: actor, query: { tenantId: '42' }, params: { employeeid: '7' },
     body: { pinAttemptLimit: 4, reason: 'Verified contact', employeeid: 999, actor_employeeid: 999, tenantId: 999 },
} as any);

describe('PIN security application settings routes', () => {
     beforeEach(() => { vi.clearAllMocks(); mocks.policy.mockResolvedValue({ pinAttemptLimit: 5 }); mocks.list.mockResolvedValue([]); });

     it.each([
          ['get', '/api/v1/applicationsettings/pin-security', getPinSecurityPolicy],
          ['put', '/api/v1/applicationsettings/pin-security', updatePinSecurityPolicy],
          ['get', '/api/v1/applicationsettings/pin-security/staff', listStaffPinSecurity],
          ['post', '/api/v1/applicationsettings/pin-security/staff/:employeeid/reset', resetStaffPinAttempts],
     ])('protects %s %s with current session validation and owner role', (method, path, handler) => {
          const route = (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method as string]).route;
          expect(route.stack.map((layer: any) => layer.handle)).toEqual([checkTokenExists, requireOwnerRole, handler]);
     });

     it.each(['manager', 'scientist', 'accountant', 'patient', 'clinician'])('blocks %s before invoking a handler', role => {
          const res = response(), next = vi.fn();
          requireOwnerRole({ authUser: { ...actor, role } } as any, res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });

     it.each([getPinSecurityPolicy, updatePinSecurityPolicy, listStaffPinSecurity, resetStaffPinAttempts])('requires authentication even when called directly', async handler => {
          const res = response(), req = request();
          delete req.authUser;
          await handler(req, res as any);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(mocks.reset).not.toHaveBeenCalled();
     });

     it.each(['42junk', '0', '-1', '1.5', ['42'], undefined, '43', '9007199254740992'])('rejects invalid or mismatched tenant %s', async tenantId => {
          const req = request(), res = response();
          req.query.tenantId = tenantId;
          await resetStaffPinAttempts(req, res as any);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.reset).not.toHaveBeenCalled();
     });

     it.each(['7junk', '0', '-1', '1.5', '9007199254740992'])('rejects invalid staff identifier %s', async employeeid => {
          const req = request(), res = response();
          req.params.employeeid = employeeid;
          await resetStaffPinAttempts(req, res as any);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.reset).not.toHaveBeenCalled();
     });

     it('takes the audit actor from authentication and reset target only from the path', async () => {
          const res = response();
          mocks.reset.mockResolvedValue({ employeeid: 7, failed_attempts: 0, locked_at: null });
          await resetStaffPinAttempts(request(), res as any);
          expect(mocks.reset).toHaveBeenCalledWith(actor, 7, 'Verified contact');
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json.mock.calls[0][0].message).toContain('PIN has not changed');
     });

     it('passes policy values without coercing strings to numbers', async () => {
          const req = request();
          req.body.pinAttemptLimit = '5';
          await updatePinSecurityPolicy(req, response() as any);
          expect(mocks.updatePolicy).toHaveBeenCalledWith(actor, '5', 'Verified contact');
     });

     it('paginates staff counters and rejects unbounded/invalid pagination', async () => {
          const req = request(), res = response();
          req.query.page = '2'; req.query.count = '20';
          await listStaffPinSecurity(req, res as any);
          expect(mocks.list).toHaveBeenCalledWith(actor, 2, 20);
          for (const count of ['101', '0', '-1', '2x']) {
               req.query.count = count;
               const invalid = response();
               await listStaffPinSecurity(req, invalid as any);
               expect(invalid.status).toHaveBeenCalledWith(400);
          }
     });

     it('returns domain errors but never leaks internal database errors', async () => {
          mocks.reset.mockRejectedValueOnce(new StaffPinSecurityError('PIN attempts are not exhausted', 409));
          const conflict = response();
          await resetStaffPinAttempts(request(), conflict as any);
          expect(conflict.status).toHaveBeenCalledWith(409);
          mocks.reset.mockRejectedValueOnce(new Error('SQL internal details and credentials'));
          const failed = response();
          await resetStaffPinAttempts(request(), failed as any);
          expect(failed.status).toHaveBeenCalledWith(500);
          expect(failed.send).toHaveBeenCalledWith({ status: 'error', statusCode: 500, message: 'Unable to manage PIN security' });
     });
});
