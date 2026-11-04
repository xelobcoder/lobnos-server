import { assertEncryptedPaths } from '../../../security/storageEncryption';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { withDatabaseDump, runBackupProcess } from './backupProcess';
import KnexConnection from "../../../database/KnexConnections";
import * as fs from 'fs';
import * as path from 'path';
import EncryptionManager from './encryption';



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
     created_by: number | null;
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
          createdBy: number | null = null,
          scheduleId?: number,
          encryptBackup: boolean = false
     ): Promise<{ success: boolean; backupPath?: string; size?: number; error?: string; duration?: number; encryptionKeyId?: string }> {
          const startTime = Date.now();

          try {
               encryptBackup = encryptBackup || await EncryptionManager.shouldEncryptBackups(tenantId);
               if (!fs.existsSync(backupPath)) {
                    fs.mkdirSync(backupPath, { recursive: true });
               }

               if (process.env.STORAGE_ENCRYPTION_REQUIRED === 'true') {
                    await assertEncryptedPaths([path.resolve(backupPath), path.resolve(process.env.BACKUP_TEMP_DIRECTORY || tmpdir())]);
               }
               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
               const filename = `${backupName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${timestamp}_${randomUUID()}.sql${encryptBackup ? ".encrypted" : ""}`;
               const fullPath = path.join(backupPath, filename);

               const connection = await KnexConnection(tenantId);
               const config = connection.client.config;

               const encryptionKeyId = await withDatabaseDump(config, (binary, args, env) =>
                    runBackupProcess(binary, args, tenantId, fullPath, encryptBackup, env));
               const size = fs.statSync(fullPath).size;
               const duration = Math.floor((Date.now() - startTime) / 1000);
               const finalBackupPath = fullPath;

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
                    created_by: createdBy ?? null,
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
                    created_by: createdBy ?? null,
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
          createdBy?: number,
          scheduleId?: number,
          encryptBackup: boolean = false
     ): Promise<{ success: boolean; backupPath?: string; size?: number; error?: string; duration?: number; encryptionKeyId?: string }> {
          const startTime = Date.now();

          try {
               encryptBackup = encryptBackup || await EncryptionManager.shouldEncryptBackups(tenantId);
               if (!fs.existsSync(backupPath)) {
                    fs.mkdirSync(backupPath, { recursive: true });
               }

               if (process.env.STORAGE_ENCRYPTION_REQUIRED === 'true') {
                    await assertEncryptedPaths([path.resolve(backupPath), path.resolve(process.env.BACKUP_TEMP_DIRECTORY || tmpdir())]);
               }
               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
               const filename = `${backupName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${timestamp}_${randomUUID()}.tar.gz${encryptBackup ? ".encrypted" : ""}`;
               const fullPath = path.join(backupPath, filename);

               const relativeDestination = path.relative(path.resolve(sourcePath), path.resolve(backupPath));
               if (!relativeDestination) throw new Error('Backup source and destination must be different directories');
               const exclusions = !relativeDestination.startsWith('..') && !path.isAbsolute(relativeDestination)
                    ? [`--exclude=./${relativeDestination.split(path.sep).join('/')}`] : [];
               const encryptionKeyId = await runBackupProcess('tar', [...exclusions, '-czf', '-', '-C', sourcePath, '.'], tenantId, fullPath, encryptBackup);
               const size = fs.statSync(fullPath).size;
               const duration = Math.floor((Date.now() - startTime) / 1000);
               const finalBackupPath = fullPath;

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
                    created_by: createdBy ?? null,
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
                    created_by: createdBy ?? null,
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
          const currentTime = now.toTimeString().slice(0, 5);
          const currentDay = now.getDay();
          const currentDate = now.getDate();

          const schedules = await connection(this.SCHEDULES_TABLE_NAME).where('is_active', true);

          const dueSchedules = schedules.filter(schedule => {
               const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;
               const scheduleTime = String(schedule.backup_time || '').slice(0, 5);
               const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map((v) => parseInt(v, 10));

               if (Number.isNaN(scheduleHour) || Number.isNaN(scheduleMinute)) {
                    return false;
               }

               let isDue = false;

               const timeMatches = scheduleTime === currentTime;
               const timeHasPassed = scheduleTime < currentTime;

               const scheduledThisHour = new Date(now);
               scheduledThisHour.setSeconds(0, 0);
               scheduledThisHour.setMinutes(scheduleMinute, 0, 0);

               const scheduledToday = new Date(now);
               scheduledToday.setSeconds(0, 0);
               scheduledToday.setHours(scheduleHour, scheduleMinute, 0, 0);

               switch (schedule.frequency) {
                    case 'hourly':
                         if (now.getTime() < scheduledThisHour.getTime()) {
                              isDue = false;
                         } else if (!lastRun) {
                              isDue = true;
                         } else {
                              isDue = lastRun.getTime() < scheduledThisHour.getTime();
                         }
                         break;

                    case 'daily':
                         if (now.getTime() < scheduledToday.getTime()) {
                              isDue = false;
                         } else if (!lastRun) {
                              isDue = true;
                         } else {
                              isDue = lastRun.getTime() < scheduledToday.getTime();
                         }
                         break;

                    case 'weekly':
                         if (!lastRun) {
                              isDue = timeMatches || timeHasPassed;
                         } else {
                              const daysSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
                              const lastRunDay = lastRun.getDay();

                              if (lastRunDay === currentDay && daysSinceLastRun < 7) {
                                   isDue = false;
                              } else {
                                   isDue = (daysSinceLastRun >= 7 && lastRunDay === currentDay) && (timeMatches || timeHasPassed);
                              }
                         }
                         break;

                    case 'monthly':
                         if (!lastRun) {
                              isDue = timeMatches || timeHasPassed;
                         } else {
                              const lastRunMonth = lastRun.getMonth();
                              const lastRunDate = lastRun.getDate();
                              const currentMonth = now.getMonth();

                              if (lastRunMonth === currentMonth && lastRunDate === currentDate) {
                                   isDue = false;
                              } else {
                                   isDue = (lastRunMonth !== currentMonth && lastRunDate === currentDate) && (timeMatches || timeHasPassed);
                              }
                         }
                         break;

                    default:
                         isDue = false;
               }

               return isDue;
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
               const backupPath = await EncryptionManager.getEffectiveStoragePath(tenantId);
               const encryptBackup = await EncryptionManager.shouldEncryptBackups(tenantId);

               if (schedule.backup_type === 'files') {
                    if (!schedule.source_path) {
                         return { success: false, error: 'source_path is required for files backup schedule' };
                    }

                    result = await this.performFileBackup(
                         tenantId,
                         backupName,
                         schedule.source_path,
                         backupPath,
                         mode,
                         schedule.employeeid,
                         scheduleId,
                         encryptBackup
                    );
               } else {
                    result = await this.performDatabaseBackup(
                         tenantId,
                         backupName,
                         backupPath,
                         true,
                         mode,
                         schedule.employeeid,
                         scheduleId,
                         encryptBackup
                    );
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

          } catch (error: any) {
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
                    } catch (error: any) {
                         console.error(`Failed to cleanup backup ${backup.id}:`, error);
                    }
               }
          } catch (error: any) {
               console.error('Error during backup cleanup:', error);
          }
     }

     static async cleanupExcessBackupsByCount(tenantId: number, backupPath: string, retainCount: number): Promise<void> {
          try {
               const connection = await KnexConnection(tenantId);

               const backups = await connection(this.TABLE_NAME)
                    .where('backup_path', 'like', `${backupPath}%`)
                    .andWhere('is_successful', true)
                    .orderBy('backup_date', 'desc');

               if (!backups || backups.length <= retainCount) {
                    return;
               }

               const toDelete = backups.slice(retainCount);

               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const useSecureDeletion = securitySettings?.secure_deletion_enabled || false;
               const deletionPasses = securitySettings?.deletion_passes || 3;

               for (const backup of toDelete) {
                    try {
                         if (backup.backup_path && fs.existsSync(backup.backup_path)) {
                              if (useSecureDeletion) {
                                   await EncryptionManager.secureDeleteFile(backup.backup_path, deletionPasses);
                              } else {
                                   fs.unlinkSync(backup.backup_path);
                              }
                         }
                         await this.delete(tenantId, backup.id);
                    } catch (error: any) {
                         console.error(`Failed to cleanup excess backup ${backup.id}:`, error);
                    }
               }
          } catch (error: any) {
               console.error('Error during count-based backup cleanup:', error);
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
