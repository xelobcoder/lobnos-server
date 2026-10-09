import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), session: vi.fn(), ready: vi.fn(), tenant: vi.fn() }));
vi.mock('../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../models/Tenancy/TenantRegistry', () => ({
     TenantRegistry: class {
          static ensureReady = mocks.ready;
          requireTenant = mocks.tenant;
     },
}));
vi.mock('./validateTenancy', () => ({
     verifyStaffSession: mocks.session,
     parseCookies: (cookie: string) => cookie ? { 'pls-prime-tenant-session': cookie.split('=')[1] } : {},
}));

import { requirePlatformFacilityAuthority } from './platformFacilityAuthority';
import { configuration } from '../hooks/configuration';

describe('platform facility HTTP authority', () => {
     const claims = { tid: 123456, employeeid: 9, email: 'control@example.test', role: 'super-admin' };
     let row: any;
     let requestedId: any;
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', 'test-only-signing-key');
          configuration.isMultiTenant = true;
          configuration.defaultTenantId = 123456;
          row = { employeeid: 9, email: claims.email, role: 'super-admin', activation: 1 };
          mocks.tenant.mockResolvedValue({ isActive: true });
          mocks.session.mockResolvedValue({ ok: true });
          mocks.connection.mockResolvedValue(() => ({
               where: (where: any) => { requestedId = where; return { first: async () => row }; },
          }));
     });
     async function call(payload: any = claims, query: any = {}, options: any = {}) {
          const token = options.token !== undefined ? options.token : jwt.sign(payload, 'test-only-signing-key', { expiresIn: '1h' });
          const req: any = { query, headers: { 'pls-prime-tenant-session': token } };
          const res: any = { locals: {}, status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
          const next = vi.fn();
          await requirePlatformFacilityAuthority(req, res, next);
          return { req, res, next };
     }
     it('allows a verified live control super-admin without caller tenantId', async () => {
          const { res, next } = await call();
          expect(next).toHaveBeenCalledOnce();
          expect(res.locals.facilityActor).toEqual({ tenantId: 123456, employeeId: 9 });
          expect(requestedId).toEqual({ employeeid: 9 });
     });
     it.each([
          { payload: { ...claims, tid: 654321 } }, { payload: { ...claims, tid: undefined } },
          { payload: { ...claims, employeeid: '9' } }, { query: { tenantId: '654321' } },
          { query: { tenantId: '123456junk' } }, { query: { tenantId: ['123456'] } },
     ])('rejects cross-tenant and malformed claims/query %j', async value => {
          const { res, next } = await call(value.payload || claims, value.query || {});
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
     });
     it.each(['admin', 'super_admin', 'superadmin'])('does not trust the token role after live role changes to %s', async role => {
          row.role = role;
          const { res, next } = await call();
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
     });
     it('does not trust caller employeeid to substitute another account', async () => {
          const { next } = await call(claims, { employeeid: '42' });
          expect(next).toHaveBeenCalledOnce();
          expect(requestedId).toEqual({ employeeid: 9 });
     });
     it('rejects disabled accounts, inactive control tenant and revoked sessions', async () => {
          row.activation = 0;
          expect((await call()).res.status).toHaveBeenCalledWith(403);
          row.activation = 1;
          mocks.tenant.mockResolvedValue({ isActive: false });
          expect((await call()).res.status).toHaveBeenCalledWith(403);
          mocks.tenant.mockResolvedValue({ isActive: true });
          mocks.session.mockResolvedValue({ ok: false, statusCode: 401, body: { status: 'error', code: 'SESSION_REPLACED' } });
          const { res, next } = await call();
          expect(next).not.toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith({ status: 'error', code: 'SESSION_REPLACED' });
     });
     it('rejects missing, tampered and expired tokens', async () => {
          for (const token of ['', 'invalid', jwt.sign(claims, 'test-only-signing-key', { expiresIn: -1 }),
               jwt.sign(claims, 'test-only-signing-key')]) {
               const { res, next } = await call(claims, {}, { token });
               expect(next).not.toHaveBeenCalled();
               expect(res.status).toHaveBeenCalledWith(401);
          }
          expect(mocks.connection).not.toHaveBeenCalled();
     });
});
