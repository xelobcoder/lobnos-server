import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(),
     tenant: vi.fn(),
     generateAccessToken: vi.fn(),
     recordDeveloperSession: vi.fn(),
     ensureSupportColumn: vi.fn(),
     ensureDeveloperSupportIdentity: vi.fn(),
}));

vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../database/connection', () => ({
     singleTenantKnexInstance: { client: { config: { connection: { database: 'local_database' } } } },
}));
vi.mock('../settings/users/AuthenticationRepository', () => ({
     default: class { generateAccessToken = mocks.generateAccessToken; },
}));
vi.mock('./TenantRegistry', () => ({
     TenantRegistry: class { getTenant = mocks.tenant; },
}));
vi.mock('./DeveloperSupportIdentity', () => ({
     ensureSupportColumn: mocks.ensureSupportColumn,
     ensureDeveloperSupportIdentity: mocks.ensureDeveloperSupportIdentity,
}));
vi.mock('./FacilityManagementService', () => ({
     FacilityManagementService: class { recordDeveloperSession = mocks.recordDeveloperSession; },
}));

import { configuration } from '../../hooks/configuration';
import { DeveloperTenantSessionService } from './DeveloperTenantSessionService';
import { DEVELOPER_SUPPORT_EMAIL } from './DeveloperSessionPolicy';

let originalMode: boolean;
let originalTenantId: number;

function fakeDatabase() {
     const loginLogQuery = {
          where: vi.fn(() => ({ update: vi.fn().mockResolvedValue(1) })),
          insert: vi.fn().mockResolvedValue([1]),
     };
     const trx: any = (table: string) => {
          if (table !== 'loginlogs') throw new Error(`Unexpected table ${table}`);
          return loginLogQuery;
     };
     trx.fn = { now: () => new Date() };
     return Object.assign(vi.fn(() => loginLogQuery), {
          schema: { hasColumn: vi.fn().mockResolvedValue(true) },
          transaction: vi.fn(async (work: (trx: any) => Promise<unknown>) => work(trx)),
          fn: { now: () => new Date() },
     });
}

describe('developer tenant sessions', () => {
     beforeEach(() => {
          originalMode = configuration.isMultiTenant;
          originalTenantId = configuration.defaultTenantId;
          configuration.isMultiTenant = false;
          configuration.defaultTenantId = 42;
          vi.clearAllMocks();
          mocks.tenant.mockResolvedValue({ isActive: true, databaseName: 'local_database' });
          mocks.connection.mockResolvedValue(fakeDatabase());
          mocks.ensureDeveloperSupportIdentity.mockResolvedValue({
               employeeid: 7,
               email: DEVELOPER_SUPPORT_EMAIL,
               access_revision: 0,
          });
          mocks.generateAccessToken.mockResolvedValue('developer-access-token');
          mocks.recordDeveloperSession.mockResolvedValue(undefined);
     });

     afterEach(() => {
          configuration.isMultiTenant = originalMode;
          configuration.defaultTenantId = originalTenantId;
     });

     it('opens the registered local facility in single-tenant mode', async () => {
          const owner = {
               master: true,
               sid: 'master-session',
               tid: 0,
               employeeid: 1,
               exp: Math.floor(Date.now() / 1000) + 3600,
          };

          const session = await new DeveloperTenantSessionService().open(42, owner);

          expect(session).toMatchObject({
               tenantId: 42,
               accessToken: 'developer-access-token',
               loginsessionId: expect.any(String),
          });
          expect(mocks.recordDeveloperSession).toHaveBeenCalledOnce();
     });

     it('rejects a non-local tenant in single-tenant mode', async () => {
          mocks.tenant.mockResolvedValue({ isActive: true, databaseName: 'another_database' });
          const owner = {
               master: true,
               sid: 'master-session',
               exp: Math.floor(Date.now() / 1000) + 3600,
          };

          await expect(new DeveloperTenantSessionService().open(43, owner))
               .rejects.toThrow('limited to the registered local facility');
          expect(mocks.connection).not.toHaveBeenCalled();
     });

     it('rejects a default tenant whose registry entry points at another database', async () => {
          configuration.isMultiTenant = true;
          mocks.tenant.mockResolvedValue({ isActive: true, databaseName: 'another_database' });
          const owner = {
               master: true,
               sid: 'master-session',
               exp: Math.floor(Date.now() / 1000) + 3600,
          };

          await expect(new DeveloperTenantSessionService().open(42, owner))
               .rejects.toThrow('does not match its registered database');
          expect(mocks.connection).not.toHaveBeenCalled();
     });

     it('closes the local default-tenant session', async () => {
          const previousSecret = process.env.ACCESS_TOKEN_SECRET;
          const secret = 'developer-session-test-secret';
          process.env.ACCESS_TOKEN_SECRET = secret;
          const token = jwt.sign({
               email: DEVELOPER_SUPPORT_EMAIL,
               developerOwner: { masterSessionId: 'master-session' },
               tid: 42,
               employeeid: 7,
               sid: 'developer-session',
          }, secret);

          try {
               await new DeveloperTenantSessionService().close({
                    master: true,
                    sid: 'master-session',
                    tid: 0,
                    employeeid: 1,
               }, token);
               expect(mocks.recordDeveloperSession).toHaveBeenCalledOnce();
          } finally {
               if (previousSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET;
               else process.env.ACCESS_TOKEN_SECRET = previousSecret;
          }
     });
});
