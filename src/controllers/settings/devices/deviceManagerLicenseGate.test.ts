import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mode: vi.fn(), windowValid: vi.fn(), operational: vi.fn() }));
vi.mock('../../../hooks/helper', () => ({
  customError: (message: string, statusCode: number, res: any) => res.status(statusCode).json({ status: 'error', statusCode, message }),
}));
vi.mock('../../../hooks/configuration', () => ({ effectiveTenantId: (id: number) => id }));
vi.mock('../../../middleware/validateTenancy', () => ({
  parseCookies: (header?: string) => Object.fromEntries((header || '').split(';').filter(Boolean).map((c) => {
    const [k, ...v] = c.trim().split('='); return [k, v.join('=')];
  })),
}));
vi.mock('../../../licensing/storage', () => ({ licenseMode: mocks.mode }));
vi.mock('../../../licensing/enforcement', () => ({ requireOperationalLicense: mocks.operational }));
vi.mock('../../../models/settings/users/PrimeWindowAccessRepository', () => ({
  default: class { validateLicense = mocks.windowValid; },
}));
vi.mock('../../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../../models/settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn() }));
vi.mock('../../../hooks/utility', () => ({ PrimeSqlErrorHandler: { handleError: vi.fn() } }));
vi.mock('../../../hooks/logger', () => ({ default: { error: vi.fn() } }));

import { deviceManagerLicenseGate } from './deviceManagerLicenseGate';

const SECRET = 'gate-test-secret';
beforeAll(() => { process.env.ACCESS_TOKEN_SECRET = SECRET; });
beforeEach(() => {
  mocks.mode.mockReturnValue('legacy');
  mocks.windowValid.mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

const staff = { employeeid: 7, email: 'ops@lab.test', role: 'scientist', branch: 2, tenantId: 3 };
const managerToken = () => jwt.sign({ email: 'ops@lab.test', clientType: 'device-manager', sid: 'device-manager:x' }, SECRET, { expiresIn: '3h' });
const browserToken = () => jwt.sign({ email: 'ops@lab.test', sid: 'abc' }, SECRET, { expiresIn: '3h' });
const forgedManagerToken = () => jwt.sign({ email: 'ops@lab.test', clientType: 'device-manager' }, 'wrong-secret');

async function call(headers: Record<string, string>, authUser: unknown = staff) {
  const app = express();
  const handler = vi.fn((_req, res) => res.status(200).json({ status: 'success', result: [] }));
  app.use((req, _res, next) => { (req as any).authUser = authUser; next(); });
  app.get('/api/v1/interfacing/devices', deviceManagerLicenseGate, handler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/interfacing/devices?tenantId=3`, { headers });
    return { status: response.status, body: await response.json(), handler };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('deviceManagerLicenseGate (legacy mode)', () => {
  it('allows a verified Device Manager session with a valid PLS window', async () => {
    const res = await call({ 'pls-prime-tenant-session': managerToken() });
    expect(res.status).toBe(200);
    expect(mocks.windowValid).toHaveBeenCalledTimes(1);
  });

  it('blocks a verified Device Manager session when the PLS window is invalid', async () => {
    mocks.windowValid.mockResolvedValue(false);
    const res = await call({ cookie: `pls-prime-tenant-session=${managerToken()}` });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: 'error', statusCode: 403, message: 'LICENSE_EXISTING_WINDOW_INVALID' });
    expect(res.handler).not.toHaveBeenCalled();
  });

  it('fails closed with no internal detail when the window cannot be read', async () => {
    mocks.windowValid.mockRejectedValue(new Error('AES decryption failed PRIME_WINDOWS_KEY'));
    const res = await call({ 'pls-prime-tenant-session': managerToken() });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/AES|PRIME_WINDOWS_KEY/);
    expect(res.handler).not.toHaveBeenCalled();
  });

  it('leaves standard browser sessions unchanged even when the window is invalid', async () => {
    mocks.windowValid.mockResolvedValue(false);
    const res = await call({ 'pls-prime-tenant-session': browserToken() });
    expect(res.status).toBe(200);
    expect(mocks.windowValid).not.toHaveBeenCalled();
  });

  it('does not treat an unverified clientType claim as a manager session (no bypass, no grant)', async () => {
    mocks.windowValid.mockResolvedValue(false);
    const res = await call({ 'pls-prime-tenant-session': forgedManagerToken() });
    // Gate only ever rejects; authentication of the forged token is checkTokenExists' job.
    expect(mocks.windowValid).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('requires the authenticated actor for manager sessions', async () => {
    const res = await call({ 'pls-prime-tenant-session': managerToken() }, null);
    expect(res.status).toBe(401);
    expect(res.handler).not.toHaveBeenCalled();
  });
});

describe('deviceManagerLicenseGate (signed mode)', () => {
  it('defers to the global signedLicenseGuard without a second check', async () => {
    mocks.mode.mockReturnValue('signed');
    const res = await call({ 'pls-prime-tenant-session': managerToken() });
    expect(res.status).toBe(200);
    expect(mocks.operational).not.toHaveBeenCalled();
    expect(mocks.windowValid).not.toHaveBeenCalled();
  });

  it('fails closed on an invalid license mode', async () => {
    mocks.mode.mockImplementation(() => { throw new Error('bad mode'); });
    const res = await call({ 'pls-prime-tenant-session': managerToken() });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('LICENSE_VALIDATION_UNAVAILABLE');
  });
});
