import KnexConnection from "../../../database/KnexConnections";
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import EncryptionManager from './encryption';

const execAsync = promisify(exec);

interface BackupLog {
     id?: number;
     backup_name: string;
     is_successful: boolean;
     is_full_backup: boolean;
     backup_size_bytes?: number;
     backup_type: 'database' | 'files' | 'full_system';
     backup_mode: 'automated' | 'manual';
     backup_date: Date;
     backup_path?: string;
     error_message?: string;
     duration_seconds?: number;
     created_by?: string;
     schedule_id?: number;
     encryption_key_id?: string;
}

interface BackupSchedule {
     id?: number;
     schedule_name: string;
     frequency: 'daily' | 'weekly' | 'monthly' | 'hourly' | 'daily';
     backup_time: string; // HH:MM format
     retention_days: number;
     employeeid: number;
     backup_path?: string;
     backup_type: 'database' | 'files' | 'full_system';
     is_active: boolean;
     database_name?: string;
     source_path?: string;
     last_run?: Date;
     created_at?: Date;
     updated_at?: Date;
}

export default class BackupManager {
     private static readonly TABLE_NAME = 'backup_logs';
     private static readonly SCHEDULES_TABLE_NAME = 'backup_schedules';

     static async create(tenantId: number, backup: Omit<BackupLog, 'id'>): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const [id] = await connection(this.TABLE_NAME).insert(backup);
          return id;
     }

     static async findById(tenantId: number, id: number): Promise<BackupLog | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.TABLE_NAME).where({ id }).first();
     }

     static async findAll(tenantId: number, filters?: {
          is_successful?: boolean;
          backup_type?: string;
          backup_mode?: string;
          count?: number;
          page?: number;
          sortby?: "DESC" | "ASC";
     }): Promise<BackupLog[]> {
          const connection = await KnexConnection(tenantId);
          let query = connection(this.TABLE_NAME);

          if (filters) {
               if (filters.is_successful !== undefined) {
                    query = query.where('is_successful', filters.is_successful);
               }
               if (filters.backup_type) {
                    query = query.where('backup_type', filters.backup_type);
               }
               if (filters.backup_mode) {
                    query = query.where('backup_mode', filters.backup_mode);
               }
               if (filters.count && filters.page) {
                    query = query.limit(filters.count).offset((filters.page - 1) * filters.count);
               }
               if (filters.sortby) {
                    query = query.orderBy('backup_date', filters.sortby);
               } else {
                    query = query.orderBy('backup_date', 'desc');
               }
          } else {
               query = query.orderBy('backup_date', 'desc');
          }

          return await query;
     }

     static async update(tenantId: number, id: number, updates: Partial<BackupLog>): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
          return updated > 0;
     }

     static async delete(tenantId: number, id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const deleted = await connection(this.TABLE_NAME).where({ id }).del();
          return deleted > 0;
     }

     static async deleteBackupWithFile(tenantId: number, id: number): Promise<{ success: boolean; error?: string }> {
          try {
               const backup = await this.findById(tenantId, id);
               if (!backup) {
                    return { success: false, error: 'Backup not found' };
               }

               // Check if secure deletion is enabled
               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const useSecureDeletion = securitySettings?.secure_deletion_enabled || false;
               const deletionPasses = securitySettings?.deletion_passes || 3;

               // Delete physical file if it exists
               if (backup.backup_path && fs.existsSync(backup.backup_path)) {
                    if (useSecureDeletion) {
                         const result = await EncryptionManager.secureDeleteFile(backup.backup_path, deletionPasses);
                         if (!result.success) {
                              console.warn(`Secure deletion failed for backup ${id}:`, result.error);
                              // Continue with database deletion even if file deletion fails
                         }
                    } else {
                         fs.unlinkSync(backup.backup_path);
                    }
               }

               // Delete database record
               const deleted = await this.delete(tenantId, id);
               if (!deleted) {
                    return { success: false, error: 'Failed to delete backup record' };
               }

               return { success: true };
          } catch (error) {
               return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
               };
          }
     }

     static async performDatabaseBackup(
          tenantId: number,
          backupName: string,
          backupPath: string,
          isFullBackup: boolean = true,
          backupMode: 'automated' | 'manual' = 'manual',
          createdBy?: string,
          scheduleId?: number,
          encryptBackup: boolean = false
     ): Promise<{ success: boolean; backupPath?: string; size?: number; error?: string; duration?: number; encryptionKeyId?: string }> {
          const startTime = Date.now();

          try {
               if (!fs.existsSync(backupPath)) {
                    fs.mkdirSync(backupPath, { recursive: true });
               }

               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
               const filename = `${backupName}_${timestamp}.sql`;
               const fullPath = path.join(backupPath, filename);

               const connection = await KnexConnection(tenantId);
               const config = connection.client.config;

               let command: string;

               console.log(config, 'CONFIG')

               if (config.client === 'mysql' || config.client === 'mysql2') {
                    const host = config.connection.host;
                    const port = config.connection.port;
                    const user = config.connection.user;
                    const password = config.connection.password;
                    const database = config.connection.database;

                    // Use full path to mysqldump in XAMPP
                    const mysqldumpPath = '"C:\\xampp\\mysql\\bin\\mysqldump.exe"';
                    command = `${mysqldumpPath} -h ${host} -P ${port} -u ${user} --password=${password} ${database} > "${fullPath}"`;
               } else if (config.client === 'postgresql') {
                    const host = config.connection.host;
                    const port = config.connection.port;
                    const user = config.connection.user;
                    const password = config.connection.password;
                    const database = config.connection.database;

                    const env = password ? { ...process.env, PGPASSWORD: password } : process.env;
                    command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${fullPath}"`;
               } else {
                    throw new Error(`Unsupported database client: ${config.client}`);
               }

               await execAsync(command);

               const stats = fs.statSync(fullPath);
               let size = stats.size;
               const duration = Math.floor((Date.now() - startTime) / 1000);

               let finalBackupPath = fullPath;
               let encryptionKeyId: string | undefined;

               // Encrypt the backup if requested
               if (encryptBackup) {
                    const encryptedPath = `${fullPath}.encrypted`;
                    const encryptionResult = await EncryptionManager.encryptFile(tenantId, fullPath, encryptedPath);

                    if (encryptionResult.success) {
                         // Securely delete the unencrypted file
                         await EncryptionManager.secureDeleteFile(fullPath);
                         finalBackupPath = encryptedPath;
                         encryptionKeyId = encryptionResult.keyId;

                         // Update file size to encrypted size
                         const encryptedStats = fs.statSync(finalBackupPath);
                         size = encryptedStats.size;
                    } else {
                         console.warn('Backup encryption failed, proceeding with unencrypted backup:', encryptionResult.error);
                    }
               }

               await this.create(tenantId, {
                    backup_name: backupName,
                    is_successful: true,
                    is_full_backup: isFullBackup,
                    backup_size_bytes: size,
                    backup_type: 'database',
                    backup_mode: backupMode,
                    backup_date: new Date(),
                    backup_path: finalBackupPath,
                    duration_seconds: duration,
                    created_by: createdBy,
                    schedule_id: scheduleId,
                    encryption_key_id: encryptionKeyId
               });

               return {
                    success: true,
                    backupPath: finalBackupPath,
                    size: size,
                    duration: duration,
                    encryptionKeyId: encryptionKeyId
               };

          } catch (error) {
               const duration = Math.floor((Date.now() - startTime) / 1000);
               const errorMessage = error instanceof Error ? error.message : 'Unknown error';

               await this.create(tenantId, {
                    backup_name: backupName,
                    is_successful: false,
                    is_full_backup: isFullBackup,
                    backup_type: 'database',
                    backup_mode: backupMode,
                    backup_date: new Date(),
                    error_message: errorMessage,
                    duration_seconds: duration,
                    created_by: createdBy,
                    schedule_id: scheduleId
               });

               return {
                    success: false,
                    error: errorMessage,
                    duration: duration
               };
          }
     }

     static async performFileBackup(
          tenantId: number,
          backupName: string,
          sourcePath: string,
          backupPath: string,
          backupMode: 'automated' | 'manual' = 'manual',
          createdBy?: string,
          scheduleId?: number,
          encryptBackup: boolean = false
     ): Promise<{ success: boolean; backupPath?: string; size?: number; error?: string; duration?: number; encryptionKeyId?: string }> {
          const startTime = Date.now();

          try {
               if (!fs.existsSync(backupPath)) {
                    fs.mkdirSync(backupPath, { recursive: true });
               }

               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
               const filename = `${backupName}_${timestamp}.tar.gz`;
               const fullPath = path.join(backupPath, filename);

               const command = `tar -czf "${fullPath}" -C "${sourcePath}" .`;
               await execAsync(command);

               const stats = fs.statSync(fullPath);
               let size = stats.size;
               const duration = Math.floor((Date.now() - startTime) / 1000);

               let finalBackupPath = fullPath;
               let encryptionKeyId: string | undefined;

               // Encrypt the backup if requested
               if (encryptBackup) {
                    const encryptedPath = `${fullPath}.encrypted`;
                    const encryptionResult = await EncryptionManager.encryptFile(tenantId, fullPath, encryptedPath);

                    if (encryptionResult.success) {
                         // Securely delete the unencrypted file
                         await EncryptionManager.secureDeleteFile(fullPath);
                         finalBackupPath = encryptedPath;
                         encryptionKeyId = encryptionResult.keyId;

                         // Update file size to encrypted size
                         const encryptedStats = fs.statSync(finalBackupPath);
                         size = encryptedStats.size;
                    } else {
                         console.warn('Backup encryption failed, proceeding with unencrypted backup:', encryptionResult.error);
                    }
               }

               await this.create(tenantId, {
                    backup_name: backupName,
                    is_successful: true,
                    is_full_backup: false,
                    backup_size_bytes: size,
                    backup_type: 'files',
                    backup_mode: backupMode,
                    backup_date: new Date(),
                    backup_path: finalBackupPath,
                    duration_seconds: duration,
                    created_by: createdBy,
                    schedule_id: scheduleId,
                    encryption_key_id: encryptionKeyId
               });

               return {
                    success: true,
                    backupPath: finalBackupPath,
                    size: size,
                    duration: duration,
                    encryptionKeyId: encryptionKeyId
               };

          } catch (error) {
               const duration = Math.floor((Date.now() - startTime) / 1000);
               const errorMessage = error instanceof Error ? error.message : 'Unknown error';

               await this.create(tenantId, {
                    backup_name: backupName,
                    is_successful: false,
                    is_full_backup: false,
                    backup_type: 'files',
                    backup_mode: backupMode,
                    backup_date: new Date(),
                    error_message: errorMessage,
                    duration_seconds: duration,
                    created_by: createdBy,
                    schedule_id: scheduleId
               });

               return {
                    success: false,
                    error: errorMessage,
                    duration: duration
               };
          }
     }

     static async getBackupStats(tenantId: number): Promise<{
          total_backups: number;
          successful_backups: number;
          failed_backups: number;
          total_size: number;
          last_backup_date?: Date;
     }> {
          const connection = await KnexConnection(tenantId);
          const stats = await connection(this.TABLE_NAME)
               .select(
                    connection.raw('COUNT(*) as total_backups'),
                    connection.raw('SUM(CASE WHEN is_successful = 1 THEN 1 ELSE 0 END) as successful_backups'),
                    connection.raw('SUM(CASE WHEN is_successful = 0 THEN 1 ELSE 0 END) as failed_backups'),
                    connection.raw('COALESCE(SUM(CASE WHEN is_successful = 1 THEN backup_size_bytes ELSE 0 END), 0) as total_size'),
                    connection.raw('MAX(backup_date) as last_backup_date')
               )
               .first() as any;

          return {
               total_backups: parseInt(stats.total_backups) || 0,
               successful_backups: parseInt(stats.successful_backups) || 0,
               failed_backups: parseInt(stats.failed_backups) || 0,
               total_size: parseInt(stats.total_size) || 0,
               last_backup_date: stats.last_backup_date ? new Date(stats.last_backup_date) : undefined
          };
     }

     // Backup Schedule Management
     static async createBackupSchedule(tenantId: number, schedule: Omit<BackupSchedule, 'id'>): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const [id] = await connection(this.SCHEDULES_TABLE_NAME).insert(schedule);
          return id;
     }

     static async findBackupScheduleById(tenantId: number, id: number): Promise<BackupSchedule | undefined> {
          const connection = await KnexConnection(tenantId);
          return await connection(this.SCHEDULES_TABLE_NAME)
               .select([
                    `${this.SCHEDULES_TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email'
               ])
               .leftJoin('roles', `${this.SCHEDULES_TABLE_NAME}.employeeid`, 'roles.employeeid')
               .where({ [`${this.SCHEDULES_TABLE_NAME}.id`]: id })
               .first();
     }

     static async findAllBackupSchedules(tenantId: number, filters?: {
          employeeid?: number;
          is_active?: boolean;
          backup_type?: string;
          count?: number;
          page?: number;
          sortby?: "DESC" | "ASC";
     }): Promise<BackupSchedule[]> {
          const connection = await KnexConnection(tenantId);
          let query = connection(this.SCHEDULES_TABLE_NAME)
               .select([
                    `${this.SCHEDULES_TABLE_NAME}.*`,
                    'roles.username',
                    'roles.email'
               ])
               .leftJoin('roles', `${this.SCHEDULES_TABLE_NAME}.employeeid`, 'roles.employeeid')
               .orderBy(`${this.SCHEDULES_TABLE_NAME}.created_at`, 'desc');

          if (filters) {
               if (filters.employeeid) {
                    query = query.where(`${this.SCHEDULES_TABLE_NAME}.employeeid`, filters.employeeid);
               }
               if (filters.is_active !== undefined) {
                    query = query.where(`${this.SCHEDULES_TABLE_NAME}.is_active`, filters.is_active);
               }
               if (filters.backup_type) {
                    query = query.where(`${this.SCHEDULES_TABLE_NAME}.backup_type`, filters.backup_type);
               }
               if (filters.count && filters.page) {
                    query = query.limit(filters.count).offset((filters.page - 1) * filters.count);
               }
               if (filters.sortby) {
                    query = query.orderBy(`${this.SCHEDULES_TABLE_NAME}.created_at`, filters.sortby);
               }
          }
          return await query;
     }

     static async updateBackupSchedule(tenantId: number, id: number, updates: Partial<BackupSchedule>): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.SCHEDULES_TABLE_NAME).where({ id }).update(updates);
          return updated > 0;
     }

     static async deleteBackupSchedule(tenantId: number, id: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const deleted = await connection(this.SCHEDULES_TABLE_NAME).where({ id }).del();
          return deleted > 0;
     }

     static async getDueSchedules(tenantId: number): Promise<BackupSchedule[]> {
          const connection = await KnexConnection(tenantId);
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
          const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const currentDate = now.getDate();

          // Get schedules that are due
          const schedules = await connection(this.SCHEDULES_TABLE_NAME)
               .where('is_active', true)
               .andWhere('backup_time', '<=', currentTime);

          // Filter based on frequency
          const dueSchedules = schedules.filter(schedule => {
               const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;

               switch (schedule.frequency) {
                    case 'hourly':
                         // Run if not run in the current hour
                         if (!lastRun) return true;
                         const lastRunHour = lastRun.getHours();
                         const currentHour = now.getHours();
                         return lastRunHour !== currentHour;

                    case 'daily':
                         // Run if not run today
                         if (!lastRun) return true;
                         const lastRunDate = lastRun.toDateString();
                         const todayDate = now.toDateString();
                         return lastRunDate !== todayDate;

                    case 'weekly':
                         // Run if not run this week (same day of week)
                         if (!lastRun) return true;
                         const daysSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
                         return daysSinceLastRun >= 7 && lastRun.getDay() === currentDay;

                    case 'monthly':
                         // Run if not run this month (same date)
                         if (!lastRun) return true;
                         return lastRun.getMonth() !== now.getMonth() && lastRun.getDate() === currentDate;

                    default:
                         return false;
               }
          });

          return dueSchedules;
     }

     static async executeScheduledBackup(tenantId: number, mode: "manual" | "automated", scheduleId: number): Promise<{ success: boolean; backupPath?: string; error?: string }> {
          const schedule = await this.findBackupScheduleById(tenantId, scheduleId);
          if (!schedule) {
               return { success: false, error: 'Schedule not found' };
          }

          try {
               let result: { success: boolean; backupPath?: string; size?: number; error?: string; duration?: number; encryptionKeyId?: string };

               const backupName = `${schedule.schedule_name}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

               // Use provided backup_path or default to backups directory in current working directory
               const backupPath = schedule.backup_path || path.resolve('backups');

               // Check if encryption is enabled
               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const encryptBackup = securitySettings?.encryption_enabled || false;

               if (schedule.backup_type === 'database') {
                    result = await this.performDatabaseBackup(
                         tenantId,
                         backupName,
                         backupPath,
                         true,
                         mode,
                         `schedule_${scheduleId}`,
                         scheduleId,
                         encryptBackup
                    );
               } else if (schedule.backup_type === 'files') {
                    if (!schedule.source_path) {
                         return { success: false, error: 'Source path not specified for file backup' };
                    }
                    result = await this.performFileBackup(
                         tenantId,
                         backupName,
                         schedule.source_path,
                         backupPath,
                         'automated',
                         `schedule_${scheduleId}`,
                         scheduleId,
                         encryptBackup
                    );
               } else {
                    return { success: false, error: 'Unsupported backup type' };
               }

               // Update last run time
               await this.updateBackupSchedule(tenantId, scheduleId, {
                    last_run: new Date()
               } as any);

               // Clean up old backups
               await this.cleanupOldBackups(tenantId, backupPath, schedule.retention_days);

               return {
                    success: result.success,
                    backupPath: result.backupPath,
                    error: result.error
               };

          } catch (error) {
               return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
               };
          }
     }

     static async cleanupOldBackups(tenantId: number, backupPath: string, retentionDays: number): Promise<void> {
          try {
               const connection = await KnexConnection(tenantId);
               const cutoffDate = new Date();
               cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

               // Get old backup logs
               const oldBackups = await connection(this.TABLE_NAME)
                    .where('backup_path', 'like', `${backupPath}%`)
                    .andWhere('backup_date', '<', cutoffDate)
                    .andWhere('is_successful', true);

               // Check if secure deletion is enabled
               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const useSecureDeletion = securitySettings?.secure_deletion_enabled || false;
               const deletionPasses = securitySettings?.deletion_passes || 3;

               // Delete physical files and database records
               for (const backup of oldBackups) {
                    try {
                         if (backup.backup_path && fs.existsSync(backup.backup_path)) {
                              if (useSecureDeletion) {
                                   await EncryptionManager.secureDeleteFile(backup.backup_path, deletionPasses);
                              } else {
                                   fs.unlinkSync(backup.backup_path);
                              }
                         }
                         await this.delete(tenantId, backup.id);
                    } catch (error) {
                         console.error(`Failed to cleanup backup ${backup.id}:`, error);
                    }
               }
          } catch (error) {
               console.error('Error during backup cleanup:', error);
          }
     }

     static async runScheduledBackups(tenantId: number, mode: "automated" | "manual"): Promise<{
          processed: number;
          successful: number;
          failed: number;
          results: Array<{ scheduleId: number; success: boolean; error?: string }>
     }> {
          const dueSchedules = await this.getDueSchedules(tenantId);
          const results: Array<{ scheduleId: number; success: boolean; error?: string }> = [];

          let successful = 0;
          let failed = 0;

          for (const schedule of dueSchedules) {
               const result = await this.executeScheduledBackup(tenantId, mode, schedule.id!);
               results.push({
                    scheduleId: schedule.id!,
                    success: result.success,
                    error: result.error
               });

               if (result.success) {
                    successful++;
               } else {
                    failed++;
               }
          }

          return {
               processed: dueSchedules.length,
               successful,
               failed,
               results
          };
     }
}
