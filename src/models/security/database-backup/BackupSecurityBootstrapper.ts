import { up as migrateBackupKeys } from '../../../cron/command-line-tool-database/migrations/20261104_backup_encryption_keys';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { up as migrateBackupSecuritySettings } from '../../../cron/command-line-tool-database/migrations/20260812_backup_security_settings_password';

const readiness = new WeakMap<Knex, Promise<void>>();

export async function bootstrapBackupSecuritySettings(tenantId: number): Promise<void> {
     const connection = await KnexConnection(tenantId);
     let ready = readiness.get(connection);
     if (!ready) {
          ready = migrateBackupSecuritySettings(connection).then(() => migrateBackupKeys(connection)).catch(error => {
               readiness.delete(connection);
               throw error;
          });
          readiness.set(connection, ready);
     }
     await ready;
}
