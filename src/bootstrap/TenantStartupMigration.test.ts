import { afterEach, describe, expect, it } from 'vitest';
import { accountingSqlDatabase } from '../testSupport/accountingSqlDatabase';
import {
     hasCurrentTenantBootstrap, recordTenantBootstrapCompletion, TENANT_BOOTSTRAP_STATE_TABLE,
     TENANT_BOOTSTRAP_STATE_VERSION, tenantStartupMigrationEnabled,
} from './TenantStartupMigration';

describe('tenant startup migration mode', () => {
     it('accepts explicit true/false values and rejects invalid configuration', () => {
          expect(tenantStartupMigrationEnabled('true')).toBe(true);
          expect(tenantStartupMigrationEnabled(' FALSE ')).toBe(false);
          expect(tenantStartupMigrationEnabled('')).toBe(false);
          expect(() => tenantStartupMigrationEnabled('yes')).toThrow('TENANT_STARTUP_MIGRATION must be set to true or false');
     });

     it('requires a current completion marker and records it only after migration', async () => {
          const fixture = accountingSqlDatabase();
          try {
               expect(await hasCurrentTenantBootstrap(fixture.db)).toBe(false);

               await recordTenantBootstrapCompletion(fixture.db);

               expect(await hasCurrentTenantBootstrap(fixture.db)).toBe(true);
               await fixture.db(TENANT_BOOTSTRAP_STATE_TABLE).where({ id: 1 }).update({ version: TENANT_BOOTSTRAP_STATE_VERSION - 1 });
               expect(await hasCurrentTenantBootstrap(fixture.db)).toBe(false);
               await fixture.db(TENANT_BOOTSTRAP_STATE_TABLE).where({ id: 1 }).update({ version: TENANT_BOOTSTRAP_STATE_VERSION + 1 });
               await expect(hasCurrentTenantBootstrap(fixture.db)).rejects.toThrow('newer than this application supports');
          } finally {
               await fixture.db.destroy();
          }
     });
});
