import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  decode: vi.fn(),
}));
vi.mock('../../hooks/helper', () => ({ customError: vi.fn() }));
vi.mock('../../middleware/validateTenancy', () => ({
  hashDeviceFingerprint: vi.fn(),
  parseCookies: (header?: string) => Object.fromEntries((header || '').split(';').filter(Boolean).map((cookie) => {
    const [key, ...value] = cookie.trim().split('=');
    return [key, value.join('=')];
  })),
}));
vi.mock('../../models/settings/users/TokenValidator', () => ({
  default: class { validateAccessToken = mocks.validate; decodeAccessToken = mocks.decode; },
}));
vi.mock('../../models/application/appsettings/appset', () => ({
  default: class { async getAllAppSettings() { return {}; } },
}));
vi.mock('../../models/application/appsettings/result-settings/resultSettings', () => ({ default: {} }));
vi.mock('../../models/security/errors/SecurityErrors', () => ({ SessionCreationError: class extends Error {} }));
vi.mock('../../models/security/services/ApplicationLoginLoggging.services', () => ({ ApplicationLoginLoggingService: class {} }));
vi.mock('../../hooks/configuration', () => ({ effectiveTenantId: (id: number) => id }));
vi.mock('../../models/settings/companyProfile', () => ({ getAllCompanyProfiles: async () => ({ name: 'Test facility' }) }));
vi.mock('../../models/settings/users/AuthenticationRepository', () => ({ default: class {} }));
vi.mock('../../models/settings/users/PrimeWindowAccessRepository', () => ({ default: class {} }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: vi.fn() }));
vi.mock('../../accountingModule/services/FinancialPinVerificationService', () => ({ FinancialPinVerificationService: class {} }));

import { AuthController } from './authController';

afterEach(() => vi.resetAllMocks());

async function validate(headers: Record<string, string>) {
  const app = express();
  const controller = new AuthController();
  app.get('/validate', (req, res) => { void controller.validateToken(req, res); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/validate?tenantId=3`, { headers });
    return { status: response.status, body: await response.json() };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('token validation transport compatibility', () => {
  it.each([
    { 'pls-prime-tenant-session': 'header-token' },
    { cookie: 'pls-prime-tenant-session=cookie-token' },
  ])('accepts the supported header or existing web cookie', async (headers) => {
    mocks.validate.mockResolvedValue({ expired: false });
    mocks.decode.mockResolvedValue({ role: 'patient', patientid: 42, username: 'Test patient' });
    const response = await validate(headers);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(true);
    expect(mocks.validate).toHaveBeenCalledWith(headers['pls-prime-tenant-session'] || 'cookie-token');
  });
  it('uses the same header precedence as authentication middleware', async () => {
    mocks.validate.mockResolvedValue({ expired: false });
    mocks.decode.mockResolvedValue({ role: 'patient', patientid: 42 });
    await validate({ 'pls-prime-tenant-session': 'header-token', cookie: 'pls-prime-tenant-session=cookie-token' });
    expect(mocks.validate).toHaveBeenCalledWith('header-token');
  });
  it('rejects missing tokens without decoding', async () => {
    const response = await validate({});
    expect(response.status).toBe(401);
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.decode).not.toHaveBeenCalled();
  });
  it.each([null, { expired: true }])('rejects invalid or expired header tokens', async (result) => {
    mocks.validate.mockResolvedValue(result);
    const response = await validate({ 'pls-prime-tenant-session': 'bad-token' });
    expect(response.status).toBe(401);
    expect(mocks.decode).not.toHaveBeenCalled();
  });
});
