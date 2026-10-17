import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRoleById: vi.fn(),
  roleTenants: [] as number[],
  company: vi.fn(),
  mode: vi.fn(),
  operational: vi.fn(),
  windowValid: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('../../../hooks/helper', () => ({
  customError: (message: string, statusCode: number, res: any) => res.status(statusCode).json({ status: 'error', statusCode, message }),
}));
vi.mock('../../../hooks/utility', () => ({
  PrimeSqlErrorHandler: { handleError: (_e: unknown, res: any) => res.status(500).json({ status: 'error', message: 'Internal Server Error' }) },
}));
vi.mock('../../../hooks/configuration', () => ({ effectiveTenantId: (id: number) => id }));
vi.mock('../../../models/settings/users/RolesRepository', () => ({
  default: class {
    constructor(tenantId: number) { mocks.roleTenants.push(tenantId); }
    getRoleById = mocks.getRoleById;
  },
}));
vi.mock('../../../models/settings/companyProfile', () => ({ getAllCompanyProfiles: mocks.company }));
vi.mock('../../../models/settings/users/PrimeWindowAccessRepository', () => ({
  default: class { validateLicense = mocks.windowValid; },
}));
vi.mock('../../../licensing/storage', () => ({ licenseMode: mocks.mode }));
vi.mock('../../../licensing/enforcement', () => ({ requireOperationalLicense: mocks.operational }));
vi.mock('../../../hooks/logger', () => ({ default: { error: mocks.logError } }));

import { getDeviceManagerSessionHandler, parseStaffPermissions } from './deviceManagerSessionController';
import { deviceManagerRouteAllowed } from '../../../models/security/deviceManagerSession';
import { LicenseError } from '../../../licensing/certificate';

beforeEach(() => {
  // Default: legacy mode with a valid existing PLS window.
  mocks.mode.mockReturnValue('legacy');
  mocks.windowValid.mockResolvedValue(true);
  mocks.operational.mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); mocks.roleTenants.length = 0; });

const actor = { employeeid: 7, email: 'ops@lab.test', role: 'scientist', branch: 2, tenantId: 3 };
const actorRow = {
  employeeid: 7, username: 'Ops User', email: 'ops@lab.test', role: 'scientist', activation: 1,
  password: '$2b$hash', pin: '1234', pin_hash: '$2b$pin', refresh_token: 'refresh-secret', mobile: '0200000000',
  permissions: JSON.stringify({ results: true, billing: false }),
};
const otherRow = { ...actorRow, employeeid: 99, email: 'admin@lab.test', role: 'admin', permissions: JSON.stringify({ admin: true }) };

async function call(authUser: unknown, query = 'tenantId=3') {
  const app = express();
  app.use((req, _res, next) => { (req as any).authUser = authUser; next(); });
  app.get('/api/v1/interfacing/devices/session', getDeviceManagerSessionHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/interfacing/devices/session?${query}`);
    return { status: response.status, body: await response.json() };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('GET /api/v1/interfacing/devices/session', () => {
  it('returns the authenticated actor, organization and actual permissions', async () => {
    mocks.getRoleById.mockImplementation(async (id: number) => id === 7 ? actorRow : otherRow);
    mocks.company.mockResolvedValue({
      name: 'Prime Lab', motto: 'Care', email: 'info@lab.test', phonenumber: '0300000000', alternativenumber: null,
      address: 'Main', street: 'First', website: 'https://lab.test', additionalInfo: 'internal notes',
    });
    const res = await call(actor);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'success',
      result: {
        user: { employeeid: 7, username: 'Ops User', email: 'ops@lab.test', role: 'scientist', branch: 2, tenantId: 3 },
        organization: {
          name: 'Prime Lab', motto: 'Care', email: 'info@lab.test', phonenumber: '0300000000', alternativenumber: null,
          address: 'Main', street: 'First', website: 'https://lab.test',
        },
        permissions: { results: true, billing: false },
        deviceInterfacing: true,
      },
    });
    expect(mocks.getRoleById).toHaveBeenCalledWith(7);
    expect(mocks.roleTenants).toEqual([3]);
    expect(mocks.company).toHaveBeenCalledWith(3);
  });

  it('ignores a caller-supplied employeeid and returns the session actor permissions', async () => {
    mocks.getRoleById.mockImplementation(async (id: number) => id === 7 ? actorRow : otherRow);
    mocks.company.mockResolvedValue(null);
    const res = await call(actor, 'tenantId=3&employeeid=99&permissions=99');
    expect(res.status).toBe(200);
    expect(mocks.getRoleById).toHaveBeenCalledTimes(1);
    expect(mocks.getRoleById).toHaveBeenCalledWith(7);
    expect(res.body.result.user.employeeid).toBe(7);
    expect(res.body.result.permissions).toEqual({ results: true, billing: false });
    expect(res.body.result.organization).toBeNull();
  });

  it('does not expose credentials, PINs, tokens or internal settings', async () => {
    mocks.getRoleById.mockResolvedValue(actorRow);
    mocks.company.mockResolvedValue({ name: 'Prime Lab', additionalInfo: 'internal notes' });
    const res = await call(actor);
    const text = JSON.stringify(res.body);
    for (const secret of ['$2b$hash', '$2b$pin', 'refresh-secret', '1234', '0200000000', 'internal notes']) {
      expect(text).not.toContain(secret);
    }
    expect(Object.keys(res.body.result).sort()).toEqual(['deviceInterfacing', 'organization', 'permissions', 'user']);
    expect(res.body.result).not.toHaveProperty('settings');
  });

  it('requires an authenticated actor', async () => {
    const res = await call(undefined);
    expect(res.status).toBe(401);
    expect(mocks.getRoleById).not.toHaveBeenCalled();
  });

  it.each(['clinician', 'patient'])('rejects %s portal sessions', async (role) => {
    const res = await call({ ...actor, role });
    expect(res.status).toBe(403);
    expect(mocks.getRoleById).not.toHaveBeenCalled();
  });

  it('rejects when the staff record no longer matches the session identity', async () => {
    mocks.getRoleById.mockResolvedValue({ ...actorRow, email: 'someone-else@lab.test' });
    expect((await call(actor)).status).toBe(401);
  });

  it('rejects deactivated staff', async () => {
    mocks.getRoleById.mockResolvedValue({ ...actorRow, activation: 0 });
    expect((await call(actor)).status).toBe(403);
  });

  it('is available to any staff role', async () => {
    mocks.getRoleById.mockResolvedValue({ ...actorRow, role: 'phelobotomist' });
    mocks.company.mockResolvedValue(null);
    expect((await call({ ...actor, role: 'phelobotomist' })).status).toBe(200);
  });

  it('does not leak database errors', async () => {
    mocks.getRoleById.mockRejectedValue(new Error('ER_ACCESS_DENIED for user root'));
    const res = await call(actor);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('ER_ACCESS_DENIED');
  });
});

describe('parseStaffPermissions', () => {
  it('treats absent permissions as none assigned', () => {
    expect(parseStaffPermissions(null)).toEqual({});
    expect(parseStaffPermissions(undefined)).toEqual({});
    expect(parseStaffPermissions('')).toEqual({});
    expect(parseStaffPermissions({ a: true })).toEqual({ a: true });
    expect(parseStaffPermissions('{"a":true}')).toEqual({ a: true });
  });
  it.each([
    ['{bad', 'MALFORMED_JSON'],
    ['[1]', 'INVALID_SHAPE'],
    ['null', 'INVALID_SHAPE'],
    ['"text"', 'INVALID_SHAPE'],
    ['42', 'INVALID_SHAPE'],
    [[1, 2], 'INVALID_SHAPE'],
    [7, 'INVALID_SHAPE'],
    [true, 'INVALID_SHAPE'],
  ])('rejects %j as %s', (value, reason) => {
    expect(() => parseStaffPermissions(value)).toThrow(expect.objectContaining({ reason }));
  });
});

describe('session endpoint permission faults', () => {
  it.each([
    ['empty string', ''],
    ['null', null],
  ])('returns {} when permissions are absent (%s)', async (_label, permissions) => {
    mocks.getRoleById.mockResolvedValue({ ...actorRow, permissions });
    mocks.company.mockResolvedValue(null);
    const res = await call(actor);
    expect(res.status).toBe(200);
    expect(res.body.result.permissions).toEqual({});
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{"results":tru', 'MALFORMED_JSON'],
    ['array', '["results"]', 'INVALID_SHAPE'],
    ['scalar', '"admin-secret-perm"', 'INVALID_SHAPE'],
  ])('logs and fails on %s without a success-shaped body', async (_label, permissions, reason) => {
    mocks.getRoleById.mockResolvedValue({ ...actorRow, permissions });
    mocks.company.mockResolvedValue({ name: 'Prime Lab' });
    const res = await call(actor);
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body).not.toHaveProperty('result');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(permissions);
    expect(text).not.toContain('$2b$');
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    const logged = String(mocks.logError.mock.calls[0][0]);
    expect(logged).toContain(reason);
    expect(logged).toContain('employee 7');
    expect(logged).not.toContain(permissions);
  });
});

describe('session endpoint license enforcement', () => {
  it('legacy mode: rejects an invalid existing PLS window before loading staff or company data', async () => {
    mocks.windowValid.mockResolvedValue(false);
    const res = await call(actor);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ status: 'error', message: 'LICENSE_EXISTING_WINDOW_INVALID' });
    expect(res.body).not.toHaveProperty('result');
    expect(mocks.getRoleById).not.toHaveBeenCalled();
    expect(mocks.company).not.toHaveBeenCalled();
    expect(mocks.operational).not.toHaveBeenCalled();
  });

  it('legacy mode: a window read failure fails closed with 503 and no internal detail', async () => {
    mocks.windowValid.mockRejectedValue(new Error('AES decryption failed: PRIME_WINDOWS_KEY=abc'));
    const res = await call(actor);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('LICENSE_EXISTING_WINDOW_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/AES|PRIME_WINDOWS_KEY|abc/);
    expect(mocks.getRoleById).not.toHaveBeenCalled();
  });

  it('signed mode: delegates to requireOperationalLicense for the session tenant and rejects when invalid', async () => {
    mocks.mode.mockReturnValue('signed');
    mocks.operational.mockRejectedValue(new LicenseError('LICENSE_EXPIRED', 403));
    const res = await call(actor, 'tenantId=3&employeeid=99');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('LICENSE_EXPIRED');
    expect(res.body).not.toHaveProperty('result');
    expect(mocks.operational).toHaveBeenCalledWith(3);
    expect(mocks.windowValid).not.toHaveBeenCalled();
    expect(mocks.getRoleById).not.toHaveBeenCalled();
  });

  it('signed mode: succeeds when the operational license is valid', async () => {
    mocks.mode.mockReturnValue('signed');
    mocks.getRoleById.mockResolvedValue(actorRow);
    mocks.company.mockResolvedValue(null);
    expect((await call(actor)).status).toBe(200);
    expect(mocks.operational).toHaveBeenCalledWith(3);
  });

  it('an invalid PLS_LICENSE_MODE fails closed', async () => {
    mocks.mode.mockImplementation(() => { throw new LicenseError('LICENSE_MODE_INVALID', 503); });
    const res = await call(actor);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('LICENSE_MODE_INVALID');
    expect(mocks.getRoleById).not.toHaveBeenCalled();
  });
});

describe('Device Manager route allowlist', () => {
  it('allows only GET for the exact session path', () => {
    expect(deviceManagerRouteAllowed('GET', '/api/v1/interfacing/devices/session')).toBe(true);
    expect(deviceManagerRouteAllowed('POST', '/api/v1/interfacing/devices/session')).toBe(false);
    expect(deviceManagerRouteAllowed('GET', '/api/v1/interfacing/devices/session/extra')).toBe(false);
    expect(deviceManagerRouteAllowed('GET', '/api/v1/interfacing/devices/5')).toBe(false);
  });
});
