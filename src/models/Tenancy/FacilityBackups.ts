import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { configuration } from '../../hooks/configuration';
import BackupManager from '../security/database-backup/backup';
import EncryptionManager from '../security/database-backup/encryption';
import { restoreIsolatedBackup, RestoreError } from '../../scripts/restore-backup';
import { FacilityError } from './FacilityInput';
import { TenantRegistry } from './TenantRegistry';

type Backup = NonNullable<Awaited<ReturnType<typeof BackupManager.findById>>>;
const busyFacilities = new Set<number>();
const pageSize = 25;

async function facility(tenantId: number) {
     if (!configuration.isMultiTenant) throw new FacilityError('Facility backups require multi-tenant mode', 409);
     const tenant = await new TenantRegistry().getTenant(tenantId);
     if (!tenant || ['deleted', 'provisioning', 'provision_failed'].includes(tenant.status)) {
          throw new FacilityError('The facility database is unavailable', 404);
     }
     return tenant;
}

async function storage(tenantId: number) {
     const settings = await EncryptionManager.getSecuritySettings(tenantId);
     const configured = settings?.storage_path?.trim();
     if (configured) return path.resolve(configured);
     const root = process.env.BACKUP_DIRECTORY?.trim();
     return root ? path.resolve(root, 'platform', String(tenantId)) : null;
}

async function fileInfo(backup: Backup, root: string | null) {
     if (!Number(backup.is_successful) || !backup.backup_path) return { available: false, restorePath: null };
     const resolved = await fs.realpath(backup.backup_path).catch(() => null);
     if (!resolved || !await fs.stat(resolved).then(stat => stat.isFile()).catch(() => false)) {
          return { available: false, restorePath: null };
     }
     const canonicalRoot = root ? await fs.realpath(root).catch(() => null) : null;
     const relative = canonicalRoot ? path.relative(canonicalRoot, resolved) : null;
     const restorePath = relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) &&
          /\.sql(?:\.encrypted)?$/i.test(resolved) ? resolved : null;
     return { available: true, restorePath };
}

async function exclusive<T>(tenantId: number, run: () => Promise<T>): Promise<T> {
     if (busyFacilities.has(tenantId)) throw new FacilityError('A backup or restore is already running for this facility', 409);
     busyFacilities.add(tenantId);
     try { return await run(); }
     finally { busyFacilities.delete(tenantId); }
}

export class FacilityBackups {
     async list(tenantId: number, page: number) {
          await facility(tenantId);
          const directory = await storage(tenantId);
          const records = await BackupManager.findAll(tenantId, { backup_type: 'database', page, count: pageSize });
          const backups = await Promise.all(records.map(async record => {
               const info = await fileInfo(record, directory);
               return {
                    id: record.id, name: record.backup_name, date: record.backup_date,
                    bytes: record.backup_size_bytes ?? null, path: record.backup_path ?? null,
                    duration: record.duration_seconds ?? null, mode: record.backup_mode,
                    encrypted: Boolean(record.encryption_key_id), successful: Boolean(Number(record.is_successful)),
                    full: Boolean(Number(record.is_full_backup)), available: info.available, canRestore: Boolean(info.restorePath),
               };
          }));
          return { directory, backups, hasNext: records.length === pageSize };
     }

     async create(tenantId: number) {
          await facility(tenantId);
          return exclusive(tenantId, async () => {
               const directory = await storage(tenantId);
               if (!directory) throw new FacilityError('Configure a backup storage directory for this facility or set BACKUP_DIRECTORY on the server', 409);
               const name = 'platform-' + randomUUID();
               const result = await BackupManager.performDatabaseBackup(tenantId, name, directory, true, 'manual', null, undefined, true, true);
               if (!result.success) throw new FacilityError('Backup failed. Check the facility backup log and server backup configuration', 503);
               return { name, location: result.backupPath, bytes: result.size };
          });
     }

     async restore(tenantId: number, backupId: number, confirmation: unknown) {
          const tenant = await facility(tenantId);
          if (confirmation !== tenant.platformId) throw new FacilityError('Enter the facility organization identifier to confirm the restore', 400);
          return exclusive(tenantId, async () => {
               const backup = await BackupManager.findById(tenantId, backupId);
               if (!backup || backup.backup_type !== 'database') throw new FacilityError('Database backup not found for this facility', 404);
               const { restorePath } = await fileInfo(backup, await storage(tenantId));
               if (!restorePath) throw new FacilityError('The backup must be available in the facility’s configured backup directory', 409);
               try {
                    return await restoreIsolatedBackup(tenantId, { ...backup, id: backupId, backup_path: restorePath });
               } catch (error) {
                    if (error instanceof RestoreError) throw new FacilityError(error.message, 409);
                    throw error;
               }
          });
     }
}
