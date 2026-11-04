import 'dotenv/config';
import { configuration } from '../hooks/configuration';
import { TenantRegistry } from '../models/Tenancy/TenantRegistry';
import EncryptionManager from '../models/security/database-backup/encryption';
import BackupManager from '../models/security/database-backup/backup';
import { releaseTenantConnection } from '../models/Tenancy/tenantConnections';
import { systemConfigConnection, singleTenantKnexInstance, databaseConnectionPool } from '../database/connection';

const tenantId = Number(process.argv[2] || process.env.BACKUP_TENANT_ID);
async function main() {
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new Error('Specify the registered tenant ID for this backup');
     if (configuration.isMultiTenant) await new TenantRegistry().requireTenant(tenantId);
     else if (tenantId !== configuration.defaultTenantId) throw new Error('Backup tenant does not match this standalone installation');
     const storage = await EncryptionManager.getEffectiveStoragePath(tenantId);
     const result = await BackupManager.performDatabaseBackup(tenantId, 'database', storage, true, 'manual', null, undefined, true);
     if (!result.success) throw new Error(result.error);
     console.log('Encrypted database backup completed', { backupPath: result.backupPath, keyId: result.encryptionKeyId });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
     await Promise.allSettled([Number.isSafeInteger(tenantId) && tenantId > 0 ? releaseTenantConnection(tenantId) : Promise.resolve(), systemConfigConnection.destroy(), singleTenantKnexInstance.destroy(), databaseConnectionPool.end()]);
});
