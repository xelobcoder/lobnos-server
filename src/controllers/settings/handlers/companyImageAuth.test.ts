import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({ standing: vi.fn(), role: vi.fn(), session: vi.fn() }));
vi.mock('../../../hooks/helper', () => ({
     customError: (message: string, status: number, res: any) => res.status(status).send({ status: 'error', statusCode: status, message }),
     responseError: (res: any) => res.status(500).send({ status: 'error' }),
     handleOverLoad: (handler: any) => handler,
}));
vi.mock('../../../models/Tenancy/tenancyRepo', () => ({
     TenancyRepository: class { validateTenantStanding = mocks.standing; },
}));
vi.mock('../../../models/settings/users/RolesRepository', () => ({
     default: class { getRoleByEmail = mocks.role; },
}));
vi.mock('../../../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class { findSessionById = mocks.session; },
}));
vi.mock('../../../middleware/resolveLoginTenant', () => ({ LOGIN_ROUTES: ['/api/v1/prime/login'] }));
vi.mock('./departmenthandlers', () => ({
     handleGetDepartments: vi.fn(), handleAddNewDepartment: vi.fn(), handleUpdateDepartment: vi.fn(),
     handleDeleteDepartment: vi.fn(), handleGetSpecificDepartment: vi.fn(),
}));
vi.mock('./companyhandler', () => ({
     getCompanyInfoHandler: vi.fn(), getCompanyImageHandler: vi.fn(),
     AddCompanyInfoHandler: vi.fn(), handleUploadCompanyImage: vi.fn(),
}));

import { checkTokenExists, ValidateTenancyAgreement } from '../../../middleware/validateTenancy';
import { configuration } from '../../../hooks/configuration';
import { requireCompanyImageAdmin } from './companyImageAccess';
import { handleUploadCompanyImage } from './companyhandler';
import router from '../route';

describe('company image HTTP authentication boundaries', () => {
     const original = { ...configuration };
     const claims = { tid: 4, employeeid: 9, email: 'staff@example.test', role: 'admin', sid: 'test-session' };
     const imagePath = '/api/v1/settings/companyprofile/images';
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', 'image-test-signing-key');
          configuration.isMultiTenant = true;
          configuration.defaultTenantId = 3;
          mocks.role.mockResolvedValue({ employeeid: 9, role: 'admin' });
          mocks.session.mockResolvedValue({ loggedout: 0, logoutTime: new Date(Date.now() + 60000) });
          mocks.standing.mockResolvedValue(true);
     });
     afterEach(() => {
          vi.unstubAllEnvs();
          Object.assign(configuration, original);
     });
     const response = () => ({
          status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(),
     });
     function request(method: string, token?: string) {
          return { path: imagePath, method, query: { tenantId: '4' }, headers: token ? { 'pls-prime-tenant-session': token } : {} } as any;
     }
     it.each(['GET', 'HEAD'])('allows public %s reads but still validates tenancy standing', async method => {
          const req = request(method);
          const next = vi.fn();
          await ValidateTenancyAgreement(req, response() as any, next);
          expect(mocks.standing).toHaveBeenCalledWith(4);
          expect(next).toHaveBeenCalledOnce();
          next.mockClear();
          await checkTokenExists(req, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          expect(mocks.role).not.toHaveBeenCalled();
     });
     it.each(['GET', 'POST'])('rejects tenantless multi-tenant %s images instead of injecting default tenant', async method => {
          const req = request(method);
          req.query = {};
          const res = response();
          const next = vi.fn();
          await ValidateTenancyAgreement(req, res as any, next);
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.standing).not.toHaveBeenCalled();
          expect(next).not.toHaveBeenCalled();
     });
     it('rejects inactive tenant public image reads', async () => {
          mocks.standing.mockResolvedValue(false);
          const res = response();
          const next = vi.fn();
          await ValidateTenancyAgreement(request('GET'), res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });
     it.each(['POST', 'PUT', 'DELETE'])('never grants the image-path token bypass to %s', async method => {
          const res = response();
          const next = vi.fn();
          await checkTokenExists(request(method), res as any, next);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
     });
     it('rejects cross-tenant tokens even if staff email exists in both facilities', async () => {
          const token = jwt.sign({ ...claims, tid: 3 }, 'image-test-signing-key', { expiresIn: '1h' });
          const res = response();
          const next = vi.fn();
          await checkTokenExists(request('POST', token), res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          expect(mocks.session).not.toHaveBeenCalled();
     });
     it('rejects expired, tampered and revoked upload sessions', async () => {
          const tokens = [
               jwt.sign(claims, 'image-test-signing-key', { expiresIn: -1 }),
               jwt.sign(claims, 'other-test-signing-key', { expiresIn: '1h' }),
               jwt.sign(claims, 'image-test-signing-key', { expiresIn: '1h' }),
          ];
          mocks.session.mockResolvedValue({ loggedout: 1 });
          for (const token of tokens) {
               const next = vi.fn();
               await checkTokenExists(request('POST', token), response() as any, next);
               expect(next).not.toHaveBeenCalled();
          }
     });
     it('uses live staff role and the verified tenant for upload authorization', async () => {
          const token = jwt.sign(claims, 'image-test-signing-key', { expiresIn: '1h' });
          const req = request('POST', token);
          const next = vi.fn();
          await checkTokenExists(req, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          next.mockClear();
          requireCompanyImageAdmin(req, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          mocks.role.mockResolvedValue({ employeeid: 9, role: 'scientist' });
          await checkTokenExists(req, response() as any, vi.fn());
          const res = response();
          next.mockClear();
          requireCompanyImageAdmin(req, res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });
     it('registers authentication and role checks before the upload handler', () => {
          const route = (router as any).stack.find(layer => layer.route?.path === imagePath && layer.route.methods.post).route;
          expect(route.stack.map(layer => layer.handle)).toEqual([
               checkTokenExists, requireCompanyImageAdmin, handleUploadCompanyImage,
          ]);
     });
});
