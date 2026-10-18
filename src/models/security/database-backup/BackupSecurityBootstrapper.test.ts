import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), migrate: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../../../cron/command-line-tool-database/migrations/20260812_backup_security_settings_password', () => ({
     up: mocks.migrate,
}));

import { bootstrapBackupSecuritySettings } from './BackupSecurityBootstrapper';
import EncryptionManager from './encryption';

describe('backup security schema readiness', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.migrate.mockResolvedValue(undefined);
     });

     it('shares migration work for concurrent requests on one tenant connection', async () => {
          const connection = vi.fn();
          mocks.connect.mockResolvedValue(connection);
          await Promise.all([bootstrapBackupSecuritySettings(7), bootstrapBackupSecuritySettings(7)]);
          await bootstrapBackupSecuritySettings(7);
          expect(mocks.migrate).toHaveBeenCalledTimes(1);
          expect(mocks.migrate).toHaveBeenCalledWith(connection);
     });

     it('migrates separate tenant connections independently', async () => {
          const first = vi.fn(), second = vi.fn();
          mocks.connect.mockImplementation(async tenantId => tenantId === 7 ? first : second);
          await Promise.all([bootstrapBackupSecuritySettings(7), bootstrapBackupSecuritySettings(8)]);
          expect(mocks.migrate).toHaveBeenCalledTimes(2);
          expect(mocks.migrate).toHaveBeenCalledWith(first);
          expect(mocks.migrate).toHaveBeenCalledWith(second);
     });

     it('surfaces schema failures and retries instead of caching failure as success', async () => {
          mocks.connect.mockResolvedValue(vi.fn());
          mocks.migrate.mockRejectedValueOnce(new Error('Schema unavailable'));
          await expect(bootstrapBackupSecuritySettings(7)).rejects.toThrow('Schema unavailable');
          await expect(bootstrapBackupSecuritySettings(7)).resolves.toBeUndefined();
          expect(mocks.migrate).toHaveBeenCalledTimes(2);
     });

     it('upgrades schema before inserting settings with an encryption password', async () => {
          let ready = false;
          const insert = vi.fn(async () => [1]);
          const query = { where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(undefined), insert };
          const connection = vi.fn(() => {
               expect(ready).toBe(true);
               return query;
          });
          mocks.connect.mockResolvedValue(connection);
          mocks.migrate.mockImplementation(async () => { ready = true; });
          await expect(EncryptionManager.updateSecuritySettings(7, { encryption_password: 'test-only-password' })).resolves.toBe(true);
          expect(insert).toHaveBeenCalledWith(expect.objectContaining({ encryption_password: 'test-only-password' }));
     });

     it('upgrades schema before reading existing settings', async () => {
          const query = {
               where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
               first: vi.fn().mockResolvedValue({ id: 1, encryption_password: null }),
          };
          const connection = vi.fn(() => query);
          mocks.connect.mockResolvedValue(connection);
          await expect(EncryptionManager.getSecuritySettings(7)).resolves.toEqual({ id: 1, encryption_password: null });
          expect(mocks.migrate.mock.invocationCallOrder[0]).toBeLessThan(connection.mock.invocationCallOrder[0]);
     });
});
