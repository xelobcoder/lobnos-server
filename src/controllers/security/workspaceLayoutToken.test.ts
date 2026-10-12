import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), decode: vi.fn(), role: vi.fn() }));
vi.mock('../../hooks/helper', () => ({ promisifyQuery: mocks.query, customError: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../models/application/appsettings/services/regions-districts-service', () => ({ default: class {} }));
vi.mock('../../middleware/validateTenancy', () => ({
     hashDeviceFingerprint: vi.fn(),
     parseCookies: () => ({ 'pls-prime-tenant-session': 'test-token' }),
}));
vi.mock('../../models/settings/users/TokenValidator', () => ({
     default: class {
          decodeAccessToken = mocks.decode;
          validateAccessToken = vi.fn(async () => ({ expired: false }));
     },
}));
vi.mock('../../models/settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn(async () => ({ name: 'Test Facility' })) }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class { getRoleByEmail = mocks.role; } }));
vi.mock('../../models/application/appsettings/result-settings/resultSettings', () => ({
     default: class { static getResultEntrySettings = vi.fn(async () => ({ keyid: 1 })); },
}));
vi.mock('../../models/settings/users/PrimeWindowAccessRepository', () => ({
     default: class { calculateDaysToExpiry = vi.fn(async () => 30); },
}));
vi.mock('../../models/settings/users/AuthenticationRepository', () => ({ default: class {} }));
vi.mock('../../models/security/services/ApplicationLoginLoggging.services', () => ({ ApplicationLoginLoggingService: class {} }));
vi.mock('../../accountingModule/services/FinancialPinVerificationService', () => ({ FinancialPinVerificationService: class {} }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: vi.fn() }));

import { AuthController } from './authController';

describe('validate-token workspace layout settings', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.decode.mockResolvedValue({ email: 'admin@example.test', role: 'admin' });
          mocks.role.mockResolvedValue({ role: 'admin', employeeid: 9, username: 'Admin', branch: 1 });
     });
     it.each(['classic', 'zoho', 'claude', undefined])('returns persisted %j in the normal settings object', async value => {
          mocks.query.mockResolvedValue([{ keyid: 1, workspaceLayout: value }]);
          const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
          await new AuthController().validateToken({ query: { tenantId: '42' }, headers: { cookie: 'test' } } as any, res as any);
          expect(mocks.query).toHaveBeenCalledWith(42, 'SELECT * FROM applicationsettings');
          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
               status: true, settings: expect.objectContaining({ keyid: 1, workspaceLayout: value ?? 'classic' }),
          }));
     });
});
