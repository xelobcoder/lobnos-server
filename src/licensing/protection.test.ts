import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import { Server } from 'http';

const mocks = vi.hoisted(() => ({
     status: vi.fn(), activate: vi.fn(), request: vi.fn(), window: vi.fn(),
     role: vi.fn(), session: vi.fn(), standing: vi.fn(),
}));
vi.mock('../hooks/helper', () => ({
     customError: (message: string, statusCode: number, res: any) => res.status(statusCode).json({ status: 'error', statusCode, message }),
     responseError: (res: any) => res.status(500).json({ status: 'error' }),
}));
vi.mock('../models/settings/users/PrimeWindowAccessRepository', () => ({
     default: class { validateLicense = mocks.window; },
}));
vi.mock('../models/settings/users/RolesRepository', () => ({
     default: class { getRoleByEmail = mocks.role; getRoleById = vi.fn(() => { throw new Error('caller id must not authorize'); }); },
}));
vi.mock('../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class { findSessionById = mocks.session; },
}));
vi.mock('../models/Tenancy/tenancyRepo', () => ({
     TenancyRepository: class { validateTenantStanding = mocks.standing; },
}));
vi.mock('../accountingModule/services/AuthorityService', () => ({
     AuthorityService: class {}, ACCOUNTING_ROLES: ['admin', 'super-admin', 'accountant'], OWNER_ONLY_ROLES: ['admin', 'super-admin'],
}));
vi.mock('../licensing/service', () => ({
     OfflineLicenseService: class { status = mocks.status; activate = mocks.activate; request = mocks.request; },
}));

import { signedLicenseGuard, licenseExemption } from './policy';
import { requireOperationalLicense } from './enforcement';
import licenseRoutes from '../controllers/security/licenseRoutes';
import { configuration } from '../hooks/configuration';

let server: Server, url: string;
const secret = 'test-only-license-auth-secret';
function token(claims: Record<string, unknown> = {}, expired = false) {
     return jwt.sign({ email: 'admin@example.test', role: 'admin', tid: 3, employeeid: 9, sid: 'test-session', ...claims },
          secret, { expiresIn: expired ? -1 : 3600 });
}
async function call(route: string, method = 'GET', session?: string, body?: unknown) {
     const response = await fetch(url + route, { method,
          headers: { ...(session ? { 'pls-prime-tenant-session': session } : {}),
               ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) });
     return { status: response.status, body: await response.json() };
}
beforeEach(async () => {
     vi.clearAllMocks();
     vi.stubEnv('PLS_LICENSE_MODE', 'signed');
     vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
     configuration.isMultiTenant = true;
     configuration.defaultTenantId = 3;
     mocks.status.mockResolvedValue({ mode: 'signed', state: 'missing', signedValid: false, reason: 'LICENSE_MISSING' });
     mocks.window.mockResolvedValue(true);
     mocks.activate.mockResolvedValue(undefined);
     mocks.request.mockResolvedValue({ version: 1, tenantId: 3 });
     mocks.role.mockResolvedValue({ role: 'admin', employeeid: 9 });
     mocks.session.mockResolvedValue({ loggedout: false, logoutTime: new Date(Date.now() + 3600000) });
     mocks.standing.mockResolvedValue(false);
     const app = express();
     app.use(express.json());
     app.use(signedLicenseGuard);
     app.use(licenseRoutes);
     app.use((_req, res) => res.json({ status: 'downstream' }));
     server = app.listen(0, '127.0.0.1');
     await new Promise<void>(resolve => server.once('listening', resolve));
     url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
     server.closeAllConnections();
     await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
     vi.unstubAllEnvs();
});
describe('signed-mode operational intersection and router protection', () => {
     it.each(['POST', 'GET', 'PUT', 'DELETE'])('blocks ordinary %s APIs when unactivated', async method => {
          expect((await call('/api/v1/billing/payment/update?tenantId=3', method)).status).toBe(403);
          expect(mocks.window).not.toHaveBeenCalled();
     });
     it('blocks early marketplace/platform/device APIs, case variants and mutating GETs', async () => {
          for (const route of ['/api/v1/marketplace/orders', '/api/v1/interfacing/devices',
               '/API/v1/inventory/items', '/api/v1/security/getloggedsessions/update', '/api/v1/result/entry/customtest/drugs']) {
               expect((await call(route + '?tenantId=3')).status).toBe(403);
          }
     });
     it('gates tenantless control surfaces by server-selected control tenant, not a borrowed query id', async () => {
          mocks.status.mockResolvedValue({ mode: 'signed', state: 'active', signedValid: true });
          expect((await call('/api/v1/marketplace/facilities?q=test')).status).toBe(200);
          expect(mocks.status).toHaveBeenLastCalledWith(3);
          expect((await call('/api/v1/public/facilities?tenantId=4')).status).toBe(200);
          expect(mocks.status).toHaveBeenLastCalledWith(3);
     });
     it('allows operational writes only when both validations pass', async () => {
          mocks.status.mockResolvedValue({ mode: 'signed', state: 'active', signedValid: true });
          expect((await call('/api/v1/billing/payment/update?tenantId=3', 'POST')).status).toBe(200);
          mocks.window.mockResolvedValue(false);
          expect((await call('/api/v1/billing/payment/update?tenantId=3', 'POST')).body.message).toBe('LICENSE_EXISTING_WINDOW_INVALID');
          mocks.status.mockResolvedValue({ mode: 'signed', state: 'expired', signedValid: false, reason: 'LICENSE_EXPIRED' });
          mocks.window.mockResolvedValue(true); // Editing the DB date does not bypass signed expiry.
          await expect(requireOperationalLicense(3)).rejects.toMatchObject({ code: 'LICENSE_EXPIRED' });
     });
     it('distinguishes database/config failures from expiry', async () => {
          mocks.status.mockResolvedValue({ mode: 'signed', signedValid: true });
          mocks.window.mockRejectedValue(new Error('sensitive SQL text'));
          expect((await call('/api/v1/billing?tenantId=3')).body).toMatchObject({ message: 'LICENSE_EXISTING_WINDOW_UNAVAILABLE', statusCode: 503 });
          mocks.status.mockResolvedValue({ mode: 'signed', signedValid: false, reason: 'LICENSE_PUBLIC_KEY_INVALID' });
          expect((await call('/api/v1/billing?tenantId=3')).status).toBe(503);
     });
     it('leaves health/login recovery reachable and does not broadly exempt GET', async () => {
          expect((await call('/api/v1/health')).status).toBe(200);
          expect((await call('/api/v1/prime/login', 'POST')).status).toBe(200);
          expect(mocks.status).not.toHaveBeenCalled();
          expect(licenseExemption('GET', '/api/v1/security-features/backup/generate-key')).toBeNull();
          expect(licenseExemption('DELETE', '/api/v1/security-features/backup/1')).toBeNull();
          expect(licenseExemption('POST', '/api/v1/result/approve')).toBeNull();
     });
     it('keeps status/request/activation admin-only but subscription/license independent', async () => {
          expect((await call('/api/v1/security/license/status?tenantId=3')).status).toBe(401);
          expect((await call('/api/v1/security/license/request?tenantId=3', 'GET', token())).status).toBe(200);
          const status = await call('/api/v1/security/license/status?tenantId=3', 'GET', token());
          expect(status.body.result).toMatchObject({ signedValid: false, existingWindowValid: true, operationalValid: false });
          expect((await call('/api/v1/security/license/activate?tenantId=3', 'POST', token(), { certificate: {} })).status).toBe(200);
          expect(mocks.activate).toHaveBeenCalledWith({}, 3);
          expect(mocks.standing).not.toHaveBeenCalled();
     });
     it('rejects remote anonymous activation, expired/invalid tokens, wrong tenants and closed sessions', async () => {
          const route = '/api/v1/security/license/activate?tenantId=3&employeeid=9';
          for (const value of [undefined, 'invalid', token({}, true), token({ tid: 4 })]) {
               expect((await call(route, 'POST', value, { certificate: {} })).status).not.toBe(200);
          }
          mocks.session.mockResolvedValue({ loggedout: true });
          expect((await call(route, 'POST', token(), { certificate: {} })).status).not.toBe(200);
          expect(mocks.activate).not.toHaveBeenCalled();
     });
     it('uses live session role, not supplied administrator id or token role', async () => {
          mocks.role.mockResolvedValue({ role: 'scientist', employeeid: 9 });
          expect((await call('/api/v1/security/license/activate?tenantId=3&employeeid=1', 'POST', token(),
               { certificate: {}, employeeid: 1 })).status).toBe(403);
          expect(mocks.activate).not.toHaveBeenCalled();
     });
     it('requires explicit valid tenant on licensing routes and protects single-tenant identity', async () => {
          expect((await call('/api/v1/security/license/status', 'GET', token())).status).toBe(400);
          expect((await call('/api/v1/security/license/status?tenantId=3junk', 'GET', token())).status).toBe(400);
          configuration.isMultiTenant = false;
          expect((await call('/api/v1/security/license/status?tenantId=4', 'GET', token())).status).toBe(403);
     });
     it('allows only authenticated staff results and administrator backup/export continuity', async () => {
          const result = '/api/v1/result/printout/ascension/getResult?tenantId=3&employeeid=1';
          expect((await call(result)).status).toBe(401);
          expect((await call(result, 'GET', token())).status).toBe(200);
          expect((await call(result, 'GET', token({ role: 'patient', patientid: 9 }))).status).toBe(403);
          const backup = '/api/v1/security-features/backup/database?tenantId=3';
          expect((await call(backup, 'POST')).status).toBe(401);
          expect((await call(backup, 'POST', token())).status).toBe(200);
          mocks.role.mockResolvedValue({ role: 'scientist', employeeid: 9 });
          expect((await call(backup, 'POST', token())).status).toBe(403);
          expect(mocks.status).not.toHaveBeenCalled();
     });
     it('legacy mode does not add operational checks', async () => {
          vi.stubEnv('PLS_LICENSE_MODE', 'legacy');
          expect((await call('/api/v1/billing/payment/update', 'POST')).status).toBe(200);
          await requireOperationalLicense(3);
          expect(mocks.status).not.toHaveBeenCalled();
          expect(mocks.window).not.toHaveBeenCalled();
     });
});
