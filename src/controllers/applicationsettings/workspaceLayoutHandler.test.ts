import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({ update: vi.fn(), role: vi.fn(), session: vi.fn() }));
vi.mock('../../models/application/appsettings/appset', () => ({
     default: class { updateWorkspaceLayout = mocks.update; },
}));
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, statusCode: number, res: any) => res.status(statusCode).send({ status: 'error', statusCode, message }),
}));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class { getRoleByEmail = mocks.role; } }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({ ApplicationLoginLog: class { findSessionById = mocks.session; } }));
vi.mock('../../middleware/resolveLoginTenant', () => ({ LOGIN_ROUTES: ['/api/v1/prime/login'] }));
vi.mock('../../accountingModule/services/AuthorityService', () => ({
     AuthorityService: class {},
     OWNER_ONLY_ROLES: ['admin', 'super_admin', 'super-admin'],
     ACCOUNTING_ROLES: ['admin', 'super_admin', 'super-admin', 'accountant'],
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
import { updateWorkspaceLayout } from './workspaceLayoutHandler';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireOwnerRole } from '../../middleware/authority';
import { configuration } from '../../hooks/configuration';

describe('workspace layout PATCH authentication and validation', () => {
     const original = { ...configuration };
     const path = '/api/v1/applicationsettings/workspace-layout';
     const claims = { tid: 42, employeeid: 9, email: 'admin@example.test', role: 'admin', sid: 'test-session' };
     const response = () => ({
          status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(),
     });
     const request = (workspaceLayout: unknown = 'zoho', token = jwt.sign(claims, 'layout-test-signing-key')) => ({
          path, method: 'PATCH', query: { tenantId: '42' },
          headers: token ? { 'pls-prime-tenant-session': token } : {},
          body: { workspaceLayout },
     } as any);
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', 'layout-test-signing-key');
          configuration.isMultiTenant = true;
          mocks.update.mockResolvedValue(true);
          mocks.role.mockResolvedValue({ employeeid: 9, role: 'admin' });
          mocks.session.mockResolvedValue({ loggedout: 0, logoutTime: new Date(Date.now() + 60000) });
     });
     afterEach(() => {
          vi.unstubAllEnvs();
          Object.assign(configuration, original);
     });
     const route = (): any => router.stack.find((layer: any) => layer.route?.path === path).route;
     async function patch(req: any, res: any) {
          for (const layer of route().stack) {
               const next = vi.fn();
               await layer.handle(req, res, next);
               if (!next.mock.calls.length) break;
          }
     }
     it('wires PATCH with authentication then the existing owner/admin role restriction', () => {
          expect(route().methods.patch).toBe(true);
          expect(route().stack.map((layer: any) => layer.handle)).toEqual([checkTokenExists, requireOwnerRole, updateWorkspaceLayout]);
     });
     it.each(['admin', 'super_admin', 'super-admin'])('allows existing owner role %s from the tenant role lookup', async role => {
          mocks.role.mockResolvedValue({ employeeid: 9, role });
          const res = response();
          await patch(request(), res);
          expect(mocks.role).toHaveBeenCalledWith('admin@example.test');
          expect(mocks.update).toHaveBeenCalledWith(42, 'zoho');
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith({ status: 'success', statusCode: 200, result: { workspaceLayout: 'zoho' } });
     });
     it.each(['manager', 'accountant', 'scientist', 'crm', 'clinician', 'patient', 'owner'])('denies non-owner role %s even when token claims admin', async role => {
          mocks.role.mockResolvedValue({ employeeid: 9, role });
          const res = response();
          await patch(request(), res);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(mocks.update).not.toHaveBeenCalled();
     });
     it('rejects an unauthenticated request before any write', async () => {
          const res = response();
          await patch(request('claude', ''), res);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(mocks.update).not.toHaveBeenCalled();
     });
     it('rejects token/query tenant mismatch before any write', async () => {
          const req = request();
          req.query.tenantId = '43';
          const res = response();
          await patch(req, res);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(mocks.update).not.toHaveBeenCalled();
     });
     it('preserves single-tenant authentication and connection context', async () => {
          configuration.isMultiTenant = false;
          configuration.defaultTenantId = 42;
          const res = response();
          await patch(request('claude'), res);
          expect(mocks.update).toHaveBeenCalledWith(42, 'claude');
          expect(res.status).toHaveBeenCalledWith(200);
     });
     it.each(['classic', 'zoho', 'claude', 'ribbon', 'slack', 'portal'])('persists valid %s', async value => {
          await patch(request(value), response());
          expect(mocks.update).toHaveBeenCalledWith(42, value);
     });
     it.each([undefined, null, '', 'Classic', 'modern', 'claude ', 3, {}, ['zoho']])('rejects invalid %j without a write', async value => {
          const req = request();
          req.body.workspaceLayout = value;
          const res = response();
          await patch(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.update).not.toHaveBeenCalled();
     });
     it('uses authenticated tenant, ignoring database, column, tenant, and other settings in the body', async () => {
          const req = request();
          req.body = { workspaceLayout: 'zoho', tenantId: 43, database: 'other', keyid: 2, headerColor: 'red' };
          await patch(req, response());
          expect(mocks.update).toHaveBeenCalledWith(42, 'zoho');
     });
     it('rejects invalid authenticated tenant context', async () => {
          const req = request();
          req.authUser = { tenantId: NaN };
          const res = response();
          await updateWorkspaceLayout(req, res as any);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.update).not.toHaveBeenCalled();
     });
     it('reports missing settings rather than claiming persistence', async () => {
          mocks.update.mockResolvedValue(false);
          const res = response();
          await patch(request(), res);
          expect(res.status).toHaveBeenCalledWith(409);
     });
     it('does not expose database errors', async () => {
          mocks.update.mockRejectedValue(new Error('sensitive database details'));
          const res = response();
          await patch(request(), res);
          expect(res.status).toHaveBeenCalledWith(500);
          expect(res.json).toHaveBeenCalledWith({ status: 'error', statusCode: 500, message: 'Unable to update workspace layout' });
     });
});
