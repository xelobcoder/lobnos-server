import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ initSession: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('../../hooks/helper', () => ({ customError: vi.fn() }));
vi.mock('../../middleware/validateTenancy', () => ({
  hashDeviceFingerprint: (id: unknown) => (id ? `fp-${id}` : null),
  parseCookies: () => ({}),
}));
vi.mock('../../models/application/appsettings/appset', () => ({
  default: class { async getAllAppSettings() { return { allowScientistToRegisterClient: 1 }; } },
}));
vi.mock('../../models/application/appsettings/result-settings/resultSettings', () => ({ default: {} }));
vi.mock('../../models/security/errors/SecurityErrors', () => ({ SessionCreationError: class extends Error {} }));
vi.mock('../../models/security/services/ApplicationLoginLoggging.services', () => ({
  ApplicationLoginLoggingService: class { initUserLoginSession = mocks.initSession; },
}));
vi.mock('../../hooks/configuration', () => ({ effectiveTenantId: (id: number) => id }));
vi.mock('../../models/settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn() }));
vi.mock('../../models/settings/users/PrimeWindowAccessRepository', () => ({ default: class {} }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: vi.fn() }));
vi.mock('../../accountingModule/services/FinancialPinVerificationService', () => ({ FinancialPinVerificationService: class {} }));

import AuthenticationRepository from '../../models/settings/users/AuthenticationRepository';
import { AuthController } from './authController';
import { LoginCooldownError } from '../../models/auth/LoginAttemptSecurity';

const SECRET = 'device-manager-test-secret';
beforeAll(() => { process.env.ACCESS_TOKEN_SECRET = SECRET; });
afterEach(() => vi.restoreAllMocks());

async function login(body: Record<string, unknown>, headers: Record<string, string> = {}, failure?: Error) {
  vi.spyOn(AuthenticationRepository.prototype, 'validatePassword').mockResolvedValue({
    role: 'scientist', username: 'Ops User', employeeid: 7, activation: 1, email: 'ops@lab.test',
  });
  if (failure) vi.mocked(AuthenticationRepository.prototype.validatePassword).mockRejectedValue(failure);
  mocks.initSession.mockResolvedValue({ loginSessionId: 'device-manager:abc', logoutTime: '2026-10-17 21:00:00' });
  const app = express();
  app.use(express.json());
  const controller = new AuthController();
  app.post('/login', (req, res) => { void controller.login(req, res); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/login?tenantId=3`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    });
    return { status: response.status, retryAfter: response.headers.get('Retry-After'), body: await response.json() };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe('Device Manager login token expiry', () => {
  it('returns an actionable cooldown over HTTP without creating a session', async () => {
    mocks.initSession.mockClear();
    const result=await login({username:'S7',password:'wrong'}, {}, new LoginCooldownError(60));
    expect(result.status).toBe(429);expect(result.retryAfter).toBe('60');
    expect(result.body).toMatchObject({status:false,code:'LOGIN_COOLDOWN',retryAfter:60});
    expect(mocks.initSession).not.toHaveBeenCalled();
  });
  it('does not expose database errors in failed sign-in responses', async () => {
    const result=await login({username:'S7',password:'wrong'}, {}, new Error('SELECT secret FROM credentials'));
    expect(result.status).toBe(503);expect(JSON.stringify(result.body)).not.toContain('SELECT');
  });
  it('returns accessTokenExpiresAt equal to the signed JWT exp (3h)', async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await login({ username: 'S7', password: 'pw', clientType: 'device-manager' }, { 'x-device-id': 'dev-1' });
    const after = Math.floor(Date.now() / 1000);
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.accessToken, SECRET) as jwt.JwtPayload;
    expect(payload.clientType).toBe('device-manager');
    expect(res.body.accessTokenExpiresAt).toBe(new Date(payload.exp! * 1000).toISOString());
    expect(payload.exp! - payload.iat!).toBe(3 * 60 * 60);
    expect(payload.iat!).toBeGreaterThanOrEqual(before);
    expect(payload.iat!).toBeLessThanOrEqual(after);
  });

  it('leaves the standard login response unchanged', async () => {
    const res = await login({ username: 'S7', password: 'pw' });
    expect(res.status).toBe(200);
    expect(res.body.clientType).toBe('standard');
    expect(res.body).not.toHaveProperty('accessTokenExpiresAt');
  });
});
